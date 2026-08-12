import fs from "fs";
import path from "path";
import { aiChat, aiJson } from "../src/lib/ai/providers";
import { z } from "zod";

const envPath = path.join(__dirname, "..", ".dev.vars");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.AI_PROVIDER = "groq";

async function main() {
  try {
    const chat = await aiChat("Reply with JSON {\"ok\":true}", "ping", {
      json: true,
    });
    console.log("chat", chat);
  } catch (e) {
    console.error("chat error", e);
  }

  const schema = z.object({ ok: z.boolean(), note: z.string().default("x") });
  const j = await aiJson(
    "Return JSON {\"ok\":true,\"note\":\"hi\"}",
    { test: 1 },
    schema,
    () => ({ ok: false, note: "heuristic" })
  );
  console.log("json", j);
}

main();
