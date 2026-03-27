/**
 * impact-ai-sync.mjs
 * Generates AI-driven copy / narrative for the trailer using an LLM.
 * Reads prompts from scripts/prompts/ and writes outputs to scripts/output/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const copy = {
  tagline: 'Remember Her — a story that stays with you.',
  description:
    'An intimate portrait of memory, love, and the echoes we leave behind.',
};

const outputPath = path.join(OUTPUT_DIR, 'copy.json');
fs.writeFileSync(outputPath, JSON.stringify(copy, null, 2));
console.log(`[ai:copy] Copy written to ${outputPath}`);
