import fs from "fs";
import path from "path";
import { z } from "zod";

for (const line of fs.readFileSync(path.join(process.cwd(), ".dev.vars"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

async function main() {
  const { aiJson, getAiConfigStatus, aiChat } = await import("../src/lib/ai/providers");
  console.log(getAiConfigStatus());
  try {
    const chat = await aiChat("Reply with JSON {\"ok\":true}", "ping", { json: true });
    console.log("chat", chat.provider, chat.model, chat.content.slice(0, 120));
  } catch (e) {
    console.log("chat_fail", e instanceof Error ? e.message : e);
  }
  const schema = z.object({ ok: z.boolean(), note: z.string() });
  const r = await aiJson(
    "Reply JSON object with ok boolean and note string",
    { ping: true },
    schema,
    () => ({ ok: false, note: "heuristic" })
  );
  console.log({ provider: r.provider, model: r.model, data: r.data });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
