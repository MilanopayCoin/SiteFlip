import fs from "fs";
import OpenAI from "openai";

for (const line of fs.readFileSync(".dev.vars", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no key");
  const client = new OpenAI({
    apiKey: key,
    baseURL: "https://api.groq.com/openai/v1",
  });
  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON object with ok true" },
        { role: "user", content: "ping" },
      ],
    });
    console.log("ok", completion.choices[0]?.message?.content);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("ERR", err.status, err.message);
  }

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Say pong" },
        { role: "user", content: "ping" },
      ],
    });
    console.log("plain", completion.choices[0]?.message?.content);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.error("ERR2", err.status, err.message);
  }
}

main();
