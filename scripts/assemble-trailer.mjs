import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const FADE_IN_START = 0;
const FADE_IN_DURATION = 0.8;
const FADE_OUT_DURATION = 1.2;

const VOICE_VOLUME = 1.0;
const MUSIC_VOLUME_MIX = 0.18;
const MUSIC_VOLUME_SOLO = 0.20;

const root = process.cwd();
const publicDir = path.join(root, "public");
const generatedDir = path.join(publicDir, "generated-clips");
const manifestPath = path.join(generatedDir, "manifest.json");
const concatPath = path.join(generatedDir, "concat.txt");
const joinedPath = path.join(generatedDir, "joined-silent.mp4");
const fadedPath = path.join(generatedDir, "joined-faded.mp4");
const finalPath = path.join(publicDir, "final-trailer.mp4");

const voiceoverPath = path.join(publicDir, "assets", "voiceover.mp3");
const musicPath = path.join(publicDir, "assets", "music-bed.mp3");

if (!fs.existsSync(manifestPath)) throw new Error("Missing generated-clips/manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const clips = (manifest.clips || []).filter((c) => c.status === "ok" && c.file);

if (!clips.length) throw new Error("No successful clips found in manifest.");

const concatText = clips.map((clip) => {
  const abs = path.join(publicDir, clip.file);
  return `file '${abs.replace(/'/g, "'\\''")}'`;
}).join("\n");

fs.writeFileSync(concatPath, concatText + "\n");

let r = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", joinedPath], { stdio: "inherit" });
if (r.status !== 0) throw new Error("ffmpeg concat failed");

// Determine video duration so the fade-out can be positioned at the end.
const probe = spawnSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration",
  "-of", "default=noprint_wrappers=1:nokey=1", joinedPath
], { encoding: "utf8" });
if (probe.status !== 0) throw new Error("ffprobe duration check failed");
const totalDuration = parseFloat(probe.stdout.trim());
const fadeOutStart = Math.max(0, totalDuration - FADE_OUT_DURATION);

r = spawnSync("ffmpeg", ["-y", "-i", joinedPath, "-vf",
  `fade=t=in:st=${FADE_IN_START}:d=${FADE_IN_DURATION},fade=t=out:st=${fadeOutStart}:d=${FADE_OUT_DURATION}`,
  "-c:a", "copy", fadedPath], { stdio: "inherit" });
if (r.status !== 0) throw new Error("ffmpeg fade pass failed");

const hasVoice = fs.existsSync(voiceoverPath);
const hasMusic = fs.existsSync(musicPath);

if (!hasVoice && !hasMusic) {
  fs.copyFileSync(fadedPath, finalPath);
  console.log(`Saved silent trailer: ${finalPath}`);
  process.exit(0);
}

if (hasVoice && hasMusic) {
  r = spawnSync("ffmpeg", [
    "-y", "-i", fadedPath, "-i", voiceoverPath, "-i", musicPath,
    "-filter_complex", `[2:a]volume=${MUSIC_VOLUME_MIX}[music];[1:a]volume=${VOICE_VOLUME}[voice];[music][voice]amix=inputs=2:duration=longest[aout]`,
    "-map", "0:v:0", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-shortest", finalPath
  ], { stdio: "inherit" });
} else if (hasVoice) {
  r = spawnSync("ffmpeg", [
    "-y", "-i", fadedPath, "-i", voiceoverPath,
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-shortest", finalPath
  ], { stdio: "inherit" });
} else {
  r = spawnSync("ffmpeg", [
    "-y", "-i", fadedPath, "-i", musicPath,
    "-filter_complex", `[1:a]volume=${MUSIC_VOLUME_SOLO}[aout]`,
    "-map", "0:v:0", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-shortest", finalPath
  ], { stdio: "inherit" });
}

if (r.status !== 0) throw new Error("ffmpeg final assembly failed");
console.log(`Saved final trailer: ${finalPath}`);
