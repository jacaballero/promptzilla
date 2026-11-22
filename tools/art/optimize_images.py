#!/usr/bin/env python3
"""Shrink the game's PNGs for the web: resize to the largest on-screen size and
quantize with pngquant (lossy, visually equivalent at game size).

Originals are backed up once to assets/_raw/<same path> and every run starts
from them, so re-running never compounds the loss. Restore an original by
copying it back from assets/_raw/.

Usage (from the repo root; requires `pngquant`, e.g. `brew install pngquant`):
    python3 tools/art/optimize_images.py
"""

import pathlib
import shutil
import subprocess
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
RAW = ASSETS / "_raw"
DIRS = ["characters", "scenes", "logos"]

# Max height in px. The stage is at most 1120x630 CSS px; sprites take ~50% of
# its height times depth/scale (≤356 px; Promptzilla ≤520 px), so these keep
# ~2x for HiDPI screens. Scenes (1672 px wide) are already below 2x: no resize.
MAX_HEIGHT = {
    "characters/promptzilla_": 1024,
    "characters/students_group_": 640,
    "characters/": 768,
}
QUALITY = "75-95"


def max_height(rel):
    for prefix, h in MAX_HEIGHT.items():
        if rel.startswith(prefix):
            return h
    return None


def main():
    total_before = total_after = 0
    for d in DIRS:
        for src in sorted((ASSETS / d).glob("*.png")):
            if src.name.endswith("_sheet.png"):   # source sheets for slice_walk_sheet.py
                continue
            rel = src.relative_to(ASSETS).as_posix()
            raw = RAW / rel
            if not raw.exists():
                raw.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, raw)

            im = Image.open(raw)
            h = max_height(rel)
            if h and im.height > h:
                im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
            im.save(src, optimize=True)
            # Exit 99 = quality range not reachable: keep the lossless resized PNG.
            subprocess.run(["pngquant", "--force", "--skip-if-larger", f"--quality={QUALITY}",
                            "--speed", "1", "--strip", "--output", str(src), str(src)], check=False)

            before, after = raw.stat().st_size, src.stat().st_size
            total_before += before
            total_after += after
            print(f"{rel:50} {before / 1024:7.0f} KB -> {after / 1024:6.0f} KB  {im.width}x{im.height}")
    print(f"TOTAL {total_before / 1e6:.1f} MB -> {total_after / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
