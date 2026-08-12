/**
 * Multi-provider AI architecture.
 * Configure via AI_PROVIDER=openai|gemini|groq|ollama|heuristic
 */

import OpenAI from "openai";
import { z } from "zod";

export type AiProviderName = "openai" | "gemini" | "groq" | "ollama" | "heuristic";

export interface AiChatResult {
  content: string;
  provider: AiProviderName;
  model: string;
}

export interface AiJsonResult<T> {
  data: T;
  provider: AiProviderName;
  model: string;
  raw?: string;
}

function primaryProvider(): AiProviderName {
  const p = (process.env.AI_PROVIDER || "").toLowerCase();
  if (p === "gemini" || p === "groq" || p === "ollama" || p === "openai" || p === "heuristic") {
    return p;
  }
  // Prefer Groq when configured (fast marketplace AI tasks)
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OLLAMA_BASE_URL) return "ollama";
  return "heuristic";
}

function fallbackProvider(primary: AiProviderName): AiProviderName | null {
  const order: AiProviderName[] = ["openai", "groq", "gemini", "ollama", "heuristic"];
  for (const p of order) {
    if (p === primary) continue;
    if (p === "openai" && process.env.OPENAI_API_KEY) return p;
    if (p === "groq" && process.env.GROQ_API_KEY) return p;
    if (p === "gemini" && process.env.GEMINI_API_KEY) return p;
    if (p === "ollama" && process.env.OLLAMA_BASE_URL) return p;
    if (p === "heuristic") return p;
  }
  return "heuristic";
}

async function chatOpenAI(system: string, user: string, json = false): Promise<AiChatResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const completion = await client.chat.completions.create({
    model,
    response_format: json ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return {
    content: completion.choices[0]?.message?.content ?? "",
    provider: "openai",
    model,
  };
}

async function chatGroq(system: string, user: string, json = false): Promise<AiChatResult> {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: "https://api.groq.com/openai/v1",
  });
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const completion = await client.chat.completions.create({
    model,
    response_format: json ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return {
    content: completion.choices[0]?.message?.content ?? "",
    provider: "groq",
    model,
  };
}

async function chatGemini(system: string, user: string, json = false): Promise<AiChatResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: json
        ? { responseMimeType: "application/json" }
        : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { content, provider: "gemini", model };
}

async function chatOllama(system: string, user: string): Promise<AiChatResult> {
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return {
    content: data.message?.content ?? "",
    provider: "ollama",
    model,
  };
}

async function runProvider(
  provider: AiProviderName,
  system: string,
  user: string,
  json: boolean
): Promise<AiChatResult> {
  switch (provider) {
    case "openai":
      return chatOpenAI(system, user, json);
    case "groq":
      return chatGroq(system, user, json);
    case "gemini":
      return chatGemini(system, user, json);
    case "ollama":
      return chatOllama(system, user);
    case "heuristic":
    default:
      throw new Error("heuristic");
  }
}

export async function aiChat(
  system: string,
  user: string,
  opts?: { json?: boolean }
): Promise<AiChatResult> {
  const primary = primaryProvider();
  const json = opts?.json ?? false;
  if (primary === "heuristic") {
    return {
      content: JSON.stringify({
        note: "No AI provider configured — heuristic mode",
        echo: user.slice(0, 200),
      }),
      provider: "heuristic",
      model: "none",
    };
  }
  try {
    return await runProvider(primary, system, user, json);
  } catch {
    const fb = fallbackProvider(primary);
    if (!fb || fb === primary) throw new Error("All AI providers failed");
    if (fb === "heuristic") {
      return {
        content: JSON.stringify({ note: "Fallback heuristic", echo: user.slice(0, 200) }),
        provider: "heuristic",
        model: "none",
      };
    }
    return runProvider(fb, system, user, json);
  }
}

export async function aiJson<T>(
  system: string,
  user: unknown,
  schema: z.ZodType<T>,
  heuristic: () => T
): Promise<AiJsonResult<T>> {
  const primary = primaryProvider();
  if (primary === "heuristic") {
    return { data: heuristic(), provider: "heuristic", model: "none" };
  }
  try {
    const result = await aiChat(system, JSON.stringify(user), { json: true });
    const parsed = schema.safeParse(JSON.parse(result.content || "{}"));
    if (!parsed.success) {
      return { data: heuristic(), provider: "heuristic", model: "none", raw: result.content };
    }
    return {
      data: parsed.data,
      provider: result.provider,
      model: result.model,
      raw: result.content,
    };
  } catch {
    return { data: heuristic(), provider: "heuristic", model: "none" };
  }
}

export function getAiConfigStatus() {
  return {
    primary: primaryProvider(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    ollama: Boolean(process.env.OLLAMA_BASE_URL),
  };
}
