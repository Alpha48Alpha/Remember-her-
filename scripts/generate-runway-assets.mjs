/**
 * generate-runway-assets.mjs
 * Uses the Runway ML SDK to generate video clips for the trailer.
 * Requires RUNWAYML_API_SECRET environment variable.
 *
 * When GoPro footage has been ingested by gopro-ingest.mjs, this script
 * automatically uses those frames as image-to-video source material instead
 * of falling back to pure text-to-video generation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const GOPRO_FRAMES_DIR = path.join(OUTPUT_DIR, 'gopro-frames');
const GOPRO_MANIFEST_PATH = path.join(GOPRO_FRAMES_DIR, 'gopro-manifest.json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const apiKey = process.env.RUNWAYML_API_SECRET;
if (!apiKey) {
  console.error('[ai:video] ERROR: RUNWAYML_API_SECRET environment variable is not set.');
  process.exit(1);
}

// Dynamically import the SDK so the script fails gracefully when deps are absent.
const { default: RunwayML } = await import('@runwayml/sdk');

const client = new RunwayML({ apiKey });

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Load GoPro frames when the ingest step has already run.
let goProFrames = [];
if (fs.existsSync(GOPRO_MANIFEST_PATH)) {
  goProFrames = JSON.parse(fs.readFileSync(GOPRO_MANIFEST_PATH, 'utf8'));
  console.log(`[ai:video] GoPro back-load: ${goProFrames.length} frame(s) detected – using image-to-video mode.`);
} else {
  console.log('[ai:video] No GoPro footage detected – using text-to-video mode.');
}

const textPrompts = [
  { id: 'scene_01', text: 'A woman standing alone in a sun-lit field, cinematic, 4K' },
  { id: 'scene_02', text: 'Old photographs scattered on a wooden table, slow zoom, cinematic' },
];

/**
 * Read an image file and return a base-64 data URI suitable for the Runway
 * image-to-video API.
 */
function imageToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
  const mime = mimeMap[ext] ?? 'image/jpeg';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

/**
 * Poll a Runway task until it succeeds or times out.
 */
async function pollTask(task) {
  let result = task;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (result.status === 'RUNNING' || result.status === 'PENDING') {
    if (Date.now() > deadline) {
      console.error(`[ai:video] Timed out waiting for task ${result.id}.`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    result = await client.tasks.retrieve(result.id);
  }
  return result;
}

const manifest = [];

if (goProFrames.length > 0) {
  // ── Image-to-video mode: use GoPro frames as source images ──────────────
  for (const [i, frame] of goProFrames.entries()) {
    const sceneId = `scene_${String(i + 1).padStart(2, '0')}`;
    console.log(`[ai:video] Generating clip for "${sceneId}" from GoPro frame…`);

    const promptText = textPrompts[i]?.text ?? 'Cinematic slow motion, 4K, film grain';
    const imageDataUri = imageToDataUri(frame.dest);

    const task = await client.imageToVideo.create({
      model: 'gen3a_turbo',
      promptImage: imageDataUri,
      promptText,
      duration: 5,
      ratio: '1280:720',
    });

    const result = await pollTask(task);

    if (result.status !== 'SUCCEEDED') {
      console.error(`[ai:video] Task ${result.id} failed with status: ${result.status}`);
      process.exit(1);
    }

    const videoUrl = result.output?.[0];
    manifest.push({ id: sceneId, url: videoUrl, source: 'gopro' });
    console.log(`[ai:video] ✓ ${sceneId} (GoPro): ${videoUrl}`);
  }
} else {
  // ── Text-to-video mode: fall back to AI-generated visuals ───────────────
  for (const prompt of textPrompts) {
    console.log(`[ai:video] Generating clip for "${prompt.id}"…`);

    const task = await client.textToVideo.create({
      model: 'gen3a_turbo',
      promptText: prompt.text,
      duration: 5,
      ratio: '1280:720',
    });

    const result = await pollTask(task);

    if (result.status !== 'SUCCEEDED') {
      console.error(`[ai:video] Task ${result.id} failed with status: ${result.status}`);
      process.exit(1);
    }

    const videoUrl = result.output?.[0];
    manifest.push({ id: prompt.id, url: videoUrl, source: 'text-to-video' });
    console.log(`[ai:video] ✓ ${prompt.id}: ${videoUrl}`);
  }
}

const manifestPath = path.join(OUTPUT_DIR, 'video-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[ai:video] Manifest written to ${manifestPath}`);
