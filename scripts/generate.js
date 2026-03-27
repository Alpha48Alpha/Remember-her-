import fs from "fs";
import path from "path";

const root = process.cwd();
const promptPath = path.join(root, "production", "TRAILER_PRODUCTION_PROMPTS.md");
const shotlistPath = path.join(root, "production", "TRAILER_SHOTLIST.json");
const voicePath = path.join(root, "production", "VOICEOVER_SCRIPT.txt");
const outDir = path.join(root, "public", "ai");
const statusPath = path.join(root, "public", "production-status.json");
const key = process.env.OPENAI_API_KEY;

fs.mkdirSync(outDir, { recursive: true });

function readFileSafe(filePath, fallback = "") {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : fallback;
}

const prompts = readFileSafe(promptPath);
const shotlist = readFileSafe(shotlistPath, "[]");
const voice = readFileSafe(voicePath);

function fallbackOutputs() {
  return {
    updatedAt: new Date().toISOString(),
    mode: "fallback",
    trailer_summary: "Prestige global thriller trailer built from local production docs.",
    homepage_hook: "She went there to help. Then she disappeared. When she came back, she didn't exist.",
    investor_blurb: "A humanitarian returns from a conflict zone erased from every system, while a decoder uncovers a hidden signal meant for all of humanity.",
    trailer_captions: [
      "She went there to help.",
      "Then she disappeared.",
      "When she came back\u2026",
      "\u2026she didn't exist.",
      "The signal was never lost.",
      "We were."
    ],
    shot_prompts: JSON.parse(shotlist || "[]"),
    voiceover_script: voice
  };
}

async function generateWithOpenAI() {
  if (!key) return fallbackOutputs();

  const input = `
You are an elite film marketing system.
Use the production materials below to create a JSON object with these exact keys:
- trailer_summary
- homepage_hook
- investor_blurb
- trailer_captions (array of 6 strings max)
- voiceover_script

Requirements:
- premium streaming tone
- clear, concise, commercially strong
- no markdown
- output valid JSON only

PRODUCTION PROMPTS:
${prompts}

SHOTLIST:
${shotlist}

VOICEOVER:
${voice}
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input,
      text: { format: { type: "json_object" } }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const raw = data.output?.[0]?.content?.[0]?.text || "{}";
  const parsed = JSON.parse(raw);

  return {
    updatedAt: new Date().toISOString(),
    mode: "openai",
    shot_prompts: JSON.parse(shotlist || "[]"),
    ...parsed
  };
}

async function main() {
  let outputs;
  try {
    outputs = await generateWithOpenAI();
  } catch (err) {
    outputs = { ...fallbackOutputs(), mode: "fallback-after-error", error: String(err.message || err) };
  }

  fs.writeFileSync(path.join(outDir, "generated-copy.json"), JSON.stringify(outputs, null, 2));
  fs.writeFileSync(statusPath, JSON.stringify({
    updatedAt: outputs.updatedAt,
    mode: outputs.mode,
    hasOpenAIKey: Boolean(key)
  }, null, 2));

  console.log("AI pipeline complete:", outputs.mode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
