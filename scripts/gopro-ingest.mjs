/**
 * gopro-ingest.mjs
 * Automatically detects GoPro footage from a mounted camera or a local
 * directory and copies frames into scripts/output/gopro-frames/ so that
 * subsequent pipeline steps can use them as image-to-video source material.
 *
 * Detection priority:
 *   1. GOPRO_PATH environment variable (explicit override)
 *   2. Standard GoPro SD-card mount points on macOS and Linux
 *   3. ./gopro-footage directory at the repository root
 *
 * Supported image formats: .jpg / .jpeg / .png
 * Supported video formats: .mp4 / .mov (first frame extraction requires ffmpeg)
 */

import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(__dirname, 'output', 'gopro-frames');

// GoPro cameras store footage under DCIM on their SD card.
const GOPRO_DCIM_SUBDIR = 'DCIM';

const CANDIDATE_MOUNT_POINTS = [
  // Explicit env override – highest priority
  ...(process.env.GOPRO_PATH ? [process.env.GOPRO_PATH] : []),
  // macOS – GoPro mounts as a volume named after the camera model
  '/Volumes/GoPro',
  '/Volumes/GOPRO',
  '/Volumes/NO NAME',
  // Linux automount locations
  '/media/gopro',
  '/media/GOPRO',
  '/run/media/gopro',
  // Repository-local fallback directory (useful in CI with pre-loaded footage)
  path.join(REPO_ROOT, 'gopro-footage'),
];

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png']);
const VIDEO_EXTS = new Set(['.mp4', '.mov']);
const MAX_FRAMES = 9; // match the number of scenes in the existing asset set

/**
 * Recursively collect file paths matching an extension set, up to a limit.
 */
function collectFiles(dir, extSet, limit = Infinity) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current) {
    if (results.length >= limit) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) break;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (extSet.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Attempt to extract the first frame from a video file using ffmpeg.
 * Returns the path to the extracted frame, or null if ffmpeg is unavailable.
 */
function extractFirstFrame(videoPath, destDir, index) {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.warn('[gopro] ffmpeg not found – skipping video frame extraction.');
    return null;
  }

  const outPath = path.join(destDir, `frame-${String(index).padStart(2, '0')}.jpg`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', videoPath, '-frames:v', '1', '-q:v', '2', outPath], {
      stdio: 'ignore',
    });
    return outPath;
  } catch (err) {
    console.warn(`[gopro] Failed to extract frame from ${videoPath}: ${err.message}`);
    return null;
  }
}

/**
 * Find the first accessible GoPro source directory from the candidate list.
 */
function detectGoProSource() {
  for (const candidate of CANDIDATE_MOUNT_POINTS) {
    if (!fs.existsSync(candidate)) continue;

    // If the candidate itself contains DCIM, it's a GoPro SD card root.
    const dcimPath = path.join(candidate, GOPRO_DCIM_SUBDIR);
    if (fs.existsSync(dcimPath)) {
      console.log(`[gopro] Detected GoPro SD card at: ${candidate}`);
      return dcimPath;
    }

    // Otherwise treat the candidate directory as a flat footage folder.
    const files = collectFiles(candidate, new Set([...IMAGE_EXTS, ...VIDEO_EXTS]), 1);
    if (files.length > 0) {
      console.log(`[gopro] Detected GoPro footage directory at: ${candidate}`);
      return candidate;
    }
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

const sourceDir = detectGoProSource();

if (!sourceDir) {
  console.log('[gopro] No GoPro source detected. Skipping ingest.');
  console.log('[gopro] To load footage manually, set GOPRO_PATH or place files in ./gopro-footage/');
  process.exit(0);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const images = collectFiles(sourceDir, IMAGE_EXTS, MAX_FRAMES);
const videos = images.length < MAX_FRAMES
  ? collectFiles(sourceDir, VIDEO_EXTS, MAX_FRAMES - images.length)
  : [];

console.log(`[gopro] Found ${images.length} image(s) and ${videos.length} video(s).`);

const manifest = [];

// Copy images directly.
for (const [i, src] of images.entries()) {
  const ext = path.extname(src).toLowerCase();
  const dest = path.join(OUTPUT_DIR, `frame-${String(i).padStart(2, '0')}${ext}`);
  fs.copyFileSync(src, dest);
  manifest.push({ index: i, type: 'image', source: src, dest });
  console.log(`[gopro] ✓ Copied image ${i + 1}/${images.length}: ${path.basename(src)}`);
}

// Extract first frames from videos.
let videoIndex = images.length;
for (const videoPath of videos) {
  const dest = extractFirstFrame(videoPath, OUTPUT_DIR, videoIndex);
  if (dest) {
    manifest.push({ index: videoIndex, type: 'video-frame', source: videoPath, dest });
    console.log(`[gopro] ✓ Extracted frame ${videoIndex + 1} from: ${path.basename(videoPath)}`);
    videoIndex++;
  }
}

const manifestPath = path.join(OUTPUT_DIR, 'gopro-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[gopro] Manifest written to ${manifestPath}`);
console.log(`[gopro] Ingest complete — ${manifest.length} frame(s) ready.`);
