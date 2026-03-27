/**
 * assemble-final-trailer.mjs
 * Reads the video manifest and copy produced by previous steps and assembles
 * a trailer data bundle consumed by the React front-end at build time.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

for (const dir of [OUTPUT_DIR, PUBLIC_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[ai:assemble] Missing required file: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const copy = readJSON(path.join(OUTPUT_DIR, 'copy.json'));
const videos = readJSON(path.join(OUTPUT_DIR, 'video-manifest.json'));

const trailer = {
  generatedAt: new Date().toISOString(),
  tagline: copy.tagline,
  description: copy.description,
  scenes: videos,
};

const outputPath = path.join(PUBLIC_DIR, 'trailer.json');
fs.writeFileSync(outputPath, JSON.stringify(trailer, null, 2));
console.log(`[ai:assemble] Trailer bundle written to ${outputPath}`);
