#!/usr/bin/env python3
"""Build a transparent FOREGROUND cutout from a scene background.

Adventure scenes need some props (a desk, chairs…) to render ABOVE the
character so it can walk behind them. Instead of a hard rectangular crop, we
keep only the pixels inside hand-defined polygons (feathered edges) and make
everything else transparent. Because it is the same source art, the overlay
aligns pixel-perfectly with the background.

Usage:
    python3 make_foreground.py <scene_key>

Output: <source>_fg.png next to the source image.
"""

import sys
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCENES_DIR = pathlib.Path(__file__).parent / "scenes"

# Polygons in normalized [0..1] coordinates (x, y), one list per prop.
POLYS = {
    "scene_corridor": [
        # Reception desk (left counter): clip at the counter top so the head
        # above the counter stays visible.
        [(0.16, 0.63), (0.165, 0.56), (0.275, 0.455), (0.335, 0.475),
         (0.365, 0.505), (0.365, 0.61), (0.325, 0.65), (0.16, 0.65)],
        # Right cluster: cork board + waiting chairs + plant.
        [(0.705, 0.70), (0.705, 0.47), (0.75, 0.435), (0.905, 0.42),
         (0.905, 0.60), (0.85, 0.70)],
    ],
}


def build(scene_key: str) -> None:
    src = SCENES_DIR / f"{scene_key}.png"
    img = Image.open(src).convert("RGBA")
    w, h = img.size

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for poly in POLYS[scene_key]:
        pts = [(x * w, y * h) for x, y in poly]
        draw.polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2))

    out = np.dstack([np.asarray(img)[..., :3], np.asarray(mask)])
    dst = SCENES_DIR / f"{scene_key}_fg.png"
    Image.fromarray(out, "RGBA").save(dst)
    print(f"  {dst.name}: {w}x{h}  props={len(POLYS[scene_key])}")


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else "scene_corridor"
    build(key)
