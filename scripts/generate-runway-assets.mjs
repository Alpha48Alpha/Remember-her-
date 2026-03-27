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

const prompts = [
  { id: 'scene_01', text: 'A woman standing alone in a sun-lit field, cinematic, 4K' },
  { id: 'scene_02', text: 'Old photographs scattered on a wooden table, slow zoom, cinematic' },
];

const manifest = [];

for (const prompt of prompts) {
  console.log(`[ai:video] Generating clip for "${prompt.id}"…`);

  const task = await client.textToVideo.create({
    model: 'gen3a_turbo',
    promptText: prompt.text,
    duration: 5,
    ratio: '1280:720',
  });

  // Poll until the task completes, with a timeout guard.
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

  if (result.status !== 'SUCCEEDED') {
    console.error(`[ai:video] Task ${result.id} failed with status: ${result.status}`);
    process.exit(1);
  }

  const videoUrl = result.output?.[0];
  manifest.push({ id: prompt.id, url: videoUrl });
  console.log(`[ai:video] ✓ ${prompt.id}: ${videoUrl}`);
}

const manifestPath = path.join(OUTPUT_DIR, 'video-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[ai:video] Manifest written to ${manifestPath}`);
