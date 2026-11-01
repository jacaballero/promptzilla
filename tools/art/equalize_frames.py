#!/usr/bin/env python3
"""Equalize exposure/color across animation frames using a pose-stable region.

Full-figure statistics are biased by pose (spread legs show more dark jeans),
so we measure the mean color of the TOP region (head + torso, stable across a
walk cycle) and apply a per-channel gain to the whole frame so every frame
matches the group's average torso color. Preserves relative shading.

Usage:
    python3 equalize_frames.py <frame1.png> <frame2.png> ...

Originals are backed up to ./_raw/ before overwriting.
"""

import sys
import pathlib
import numpy as np
from PIL import Image

TOP_FRACTION = 0.45  # portion of the figure height treated as head + torso


def torso_mean(arr, alpha):
    ys, _ = np.where(alpha)
    y0, y1 = ys.min(), ys.max()
    cut = y0 + int((y1 - y0) * TOP_FRACTION)
    mask = alpha.copy()
    mask[cut:, :] = False
    px = arr[..., :3][mask]
    return px.mean(axis=0)


def main(paths):
    imgs, alphas, means = [], [], []
    for p in paths:
        a = np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)
        al = a[..., 3] > 128
        imgs.append(a)
        alphas.append(al)
        means.append(torso_mean(a, al))

    target = np.mean(means, axis=0)  # common torso color for the whole set

    for p, a, m in zip(paths, imgs, means):
        gain = target / np.maximum(m, 1e-6)
        out = a.copy()
        out[..., :3] = np.clip(a[..., :3] * gain, 0, 255)

        path = pathlib.Path(p)
        backup_dir = path.parent / "_raw"
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / path.name
        if not backup.exists():
            Image.open(path).save(backup)

        Image.fromarray(out.astype(np.uint8), "RGBA").save(path)
        print(f"  {path.name}: gain R={gain[0]:.3f} G={gain[1]:.3f} B={gain[2]:.3f}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
