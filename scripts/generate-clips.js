import fs from "fs";
import path from "path";
import RunwayML, { TaskFailedError } from "@runwayml/sdk";

const root = process.cwd();
const shotlistPath = path.join(root, "production", "TRAILER_SHOTLIST.json");
const outDir = path.join(root, "public", "generated-clips");
const manifestPath = path.join(outDir, "manifest.json");

if (!process.env.RUNWAY_API_KEY) throw new Error("Missing RUNWAY_API_KEY");
if (!fs.existsSync(shotlistPath)) throw new Error("Missing production/TRAILER_SHOTLIST.json");

const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });
const shotlist = JSON.parse(fs.readFileSync(shotlistPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

function timecodeDurationSeconds(timecode) {
  if (!timecode || !timecode.includes("-")) return 5;
  const [a, b] = timecode.split("-");
  const parse = (t) => {
    const parts = String(t).trim().split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };
  const seconds = Math.max(2, Math.round(parse(b) - parse(a)));
  return Math.min(10, seconds);
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function generateClip(shot, index) {
  const duration = timecodeDurationSeconds(shot.timecode);
  const id = shot.id || `shot_${index + 1}`;
  const safeName = `${String(index + 1).padStart(2, "0")}-${id.replace(/[^a-zA-Z0-9_-]/g, "")}.mp4`;
  const localPath = path.join(outDir, safeName);

  console.log(`Generating ${id} (${duration}s)`);

  try {
    const task = await client.imageToVideo
      .create({
        model: "gen4_turbo",
        promptText: shot.prompt,
        ratio: "1280:720",
        duration,
      })
      .waitForTaskOutput();

    const outputUrl = task.output?.[0];
    if (!outputUrl) throw new Error(`No output URL returned for ${id}`);

    await downloadFile(outputUrl, localPath);

    return {
      id,
      label: shot.label || id,
      timecode: shot.timecode || "",
      prompt: shot.prompt,
      file: `generated-clips/${safeName}`,
      localPath,
      status: "ok",
    };
  } catch (error) {
    const message =
      error instanceof TaskFailedError
        ? `Runway task failed: ${error.message}`
        : String(error.message || error);
    return {
      id,
      label: shot.label || id,
      timecode: shot.timecode || "",
      prompt: shot.prompt,
      status: "error",
      error: message,
    };
  }
}

async function main() {
  const results = [];
  for (let i = 0; i < shotlist.length; i += 1) {
    results.push(await generateClip(shotlist[i], i));
  }
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      { createdAt: new Date().toISOString(), model: "gen4_turbo", clips: results },
      null,
      2
    )
  );
  console.log(`Saved manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
