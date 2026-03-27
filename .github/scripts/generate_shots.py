"""
Generate video shots using the Runway ML Gen-3 Alpha API.

Reads shot definitions from shots.json, submits each prompt to Runway,
polls for completion, and saves the resulting video files to output/.
"""

import json
import os
import sys
import time
import requests

RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1"
SHOTS_FILE = "shots.json"
OUTPUT_DIR = "output"
POLL_INTERVAL = 10  # seconds between status checks
MAX_WAIT = 600  # maximum seconds to wait per shot


def get_headers():
    api_key = os.environ.get("RUNWAY_API_KEY")
    if not api_key:
        print("ERROR: RUNWAY_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
    }


def submit_generation(shot: dict, headers: dict) -> str:
    """Submit a text-to-video generation task and return the task ID."""
    payload = {
        "model": "gen3a_turbo",
        "promptText": shot["prompt"],
        "ratio": "16:9",
        "duration": 5,
    }
    response = requests.post(
        f"{RUNWAY_API_BASE}/text_to_video",
        headers=headers,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    task_id = response.json()["id"]
    print(f"  Submitted {shot['id']} → task {task_id}")
    return task_id


def poll_task(task_id: str, headers: dict) -> str:
    """Poll until the task succeeds and return the output video URL."""
    deadline = time.time() + MAX_WAIT
    while time.time() < deadline:
        response = requests.get(
            f"{RUNWAY_API_BASE}/tasks/{task_id}",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        status = data.get("status")
        print(f"    status: {status}")
        if status == "SUCCEEDED":
            outputs = data.get("output", [])
            if outputs:
                return outputs[0]
            raise RuntimeError(f"Task {task_id} succeeded but returned no output.")
        if status in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"Task {task_id} ended with status: {status}")
        time.sleep(POLL_INTERVAL)
    raise TimeoutError(f"Task {task_id} did not complete within {MAX_WAIT} seconds.")


def download_video(url: str, dest_path: str, headers: dict) -> None:
    """Download a video file from the given URL."""
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(SHOTS_FILE, "r") as f:
        shots = json.load(f)

    shot_id_filter = os.environ.get("SHOT_ID_FILTER", "").strip()
    if shot_id_filter:
        shots = [s for s in shots if s["id"] == shot_id_filter]
        if not shots:
            print(f"ERROR: No shot found with id '{shot_id_filter}'.", file=sys.stderr)
            sys.exit(1)

    headers = get_headers()
    errors = []

    for shot in shots:
        print(f"\n[{shot['id']}] {shot['label']} ({shot['timecode']})")
        dest = os.path.join(OUTPUT_DIR, f"{shot['id']}.mp4")

        if os.path.exists(dest):
            print(f"  Already exists, skipping: {dest}")
            continue

        try:
            task_id = submit_generation(shot, headers)
            video_url = poll_task(task_id, headers)
            print(f"  Downloading → {dest}")
            download_video(video_url, dest, headers)
            print(f"  ✓ Saved {dest}")
        except Exception as exc:
            print(f"  ✗ Failed: {exc}", file=sys.stderr)
            errors.append((shot["id"], str(exc)))

    if errors:
        print("\nThe following shots failed:", file=sys.stderr)
        for shot_id, msg in errors:
            print(f"  {shot_id}: {msg}", file=sys.stderr)
        sys.exit(1)

    print(f"\nAll shots generated. Files are in '{OUTPUT_DIR}/'.")


if __name__ == "__main__":
    main()
