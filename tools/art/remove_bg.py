#!/usr/bin/env python3
"""Remove the baked-in checkerboard/light background from character PNGs.

The images were exported as RGB (no alpha): the "transparent" background is
actually painted as near-white / light-grey pixels. Characters have thick dark
outlines, so we can safely remove the light, low-saturation region that is
connected to the image border, then clean the anti-aliasing halo.
"""

import sys
import pathlib
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# Tunables
SAT_MAX = 18       # max (channel spread) to count as "grey/desaturated"
BRIGHT_MIN = 205   # min channel value to count as "light" background candidate
HALO_BRIGHT = 224  # light foreground pixels near the edge treated as halo
HALO_DIST = 3      # px radius around background to hunt halo pixels

SRC_DIR = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.cwd()
RAW_DIR = SRC_DIR / "_raw"


def remove_background(path: pathlib.Path) -> None:
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype(np.int16)
    h, w, _ = rgb.shape

    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = mx - mn

    # Background candidate: light AND desaturated
    candidate = (sat <= SAT_MAX) & (mn >= BRIGHT_MIN)

    # Keep only the candidate region connected to the image border
    labels, n = ndimage.label(candidate)
    border_labels = set(labels[0, :]) | set(labels[-1, :]) | \
        set(labels[:, 0]) | set(labels[:, -1])
    border_labels.discard(0)
    bg = np.isin(labels, list(border_labels))

    # Halo: light, desaturated foreground pixels hugging the background edge
    near_bg = ndimage.binary_dilation(bg, iterations=HALO_DIST)
    halo = near_bg & (~bg) & (sat <= SAT_MAX) & (mn >= HALO_BRIGHT)
    bg = bg | halo

    # Build alpha and soften the edge slightly
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))

    out = np.dstack([np.asarray(img), np.asarray(alpha_img)])
    Image.fromarray(out, "RGBA").save(path)

    removed = bg.mean() * 100
    print(f"  {path.name}: {w}x{h}  fondo eliminado {removed:4.1f}%")


def main() -> None:
    pngs = sorted(SRC_DIR.glob("*.png"))
    if not pngs:
        print("No PNGs found."); return
    RAW_DIR.mkdir(exist_ok=True)
    for p in pngs:
        backup = RAW_DIR / p.name
        if not backup.exists():
            backup.write_bytes(p.read_bytes())
        remove_background(p)
    print(f"Listo. Originales guardados en {RAW_DIR}")


if __name__ == "__main__":
    main()
