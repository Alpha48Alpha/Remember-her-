/**
 * generate-runway-assets.mjs
 * Uses the Runway ML SDK to generate video clips for the trailer.
 * Requires RUNWAYML_API_SECRET environment variable.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const ASSETS_DIR = path.join(__dirname, '..', 'impact-machine-runway');

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

/**
 * Reads a local image file and returns a base64 data URI.
 */
function imageToDataUri(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[ai:video] ERROR: Required image not found: ${filePath}`);
    process.exit(1);
  }
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const SUPPORTED = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const mimeType = SUPPORTED[ext];
  if (!mimeType) {
    console.error(`[ai:video] ERROR: Unsupported image format ".${ext}" for ${filePath}. Use jpg, jpeg, png, or webp.`);
    process.exit(1);
  }
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${data}`;
}

const scenes = [
  {
    id: 'scene_01',
    imagePath: path.join(ASSETS_DIR, 'scene-1.jpg'),
    promptText: 'A woman standing alone in a sun-lit field, cinematic, 4K',
  },
  {
    id: 'scene_02',
    imagePath: path.join(ASSETS_DIR, 'scene-2.jpg'),
    promptText: 'Old photographs scattered on a wooden table, slow zoom, cinematic',
  },
];

const manifest = [];

for (const scene of scenes) {
  console.log(`[ai:video] Generating clip for "${scene.id}"…`);

  const promptImage = imageToDataUri(scene.imagePath);

  const task = await client.imageToVideo.create({
    model: 'gen3a_turbo',
    promptImage,
    promptText: scene.promptText,
    duration: 5,
    ratio: '1280:768',
  });

  // Poll until the task completes, with a timeout guard.
  let result = await client.tasks.retrieve(task.id);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (result.status === 'RUNNING' || result.status === 'PENDING' || result.status === 'THROTTLED') {
    if (Date.now() > deadline) {
      console.error(`[ai:video] Timed out waiting for task ${result.id}.`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    result = await client.tasks.retrieve(result.id);
  }

  if (result.status !== 'SUCCEEDED') {
    console.error(`[ai:video] Task ${result.id} failed with status: ${result.status}`);
    process.exit(1);
  }

  const videoUrl = result.output?.[0];
  manifest.push({ id: scene.id, url: videoUrl });
  console.log(`[ai:video] ✓ ${scene.id}: ${videoUrl}`);
}

const manifestPath = path.join(OUTPUT_DIR, 'video-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[ai:video] Manifest written to ${manifestPath}`);
