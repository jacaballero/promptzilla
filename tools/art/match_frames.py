#!/usr/bin/env python3
"""Match the color/exposure of idle frames to a reference frame.

The LLM-generated idle frames can drift slightly in brightness/saturation
between frames, which makes the idle loop "flicker". This aligns each target
frame to a reference frame using per-channel mean/std color transfer over the
non-transparent (alpha) pixels only, so the whole character keeps the exact
same palette across the loop.

Usage:
    python3 match_frames.py <reference.png> <target.png> [<target2.png> ...]

Originals are backed up to ./_raw/ before overwriting.
"""

import sys
import pathlib
import numpy as np
from PIL import Image

ALPHA_THRESHOLD = 128  # pixels with alpha above this count as "character"


def load_rgba(path: pathlib.Path):
    img = Image.open(path).convert("RGBA")
    return np.asarray(img).astype(np.float64)


def masked_stats(arr, mask):
    stats = []
    for c in range(3):
        vals = arr[..., c][mask]
        stats.append((vals.mean(), vals.std() if vals.std() > 1e-6 else 1.0))
    return stats


def match_frame(ref_path: pathlib.Path, tgt_path: pathlib.Path) -> None:
    ref = load_rgba(ref_path)
    tgt = load_rgba(tgt_path)

    ref_mask = ref[..., 3] > ALPHA_THRESHOLD
    tgt_mask = tgt[..., 3] > ALPHA_THRESHOLD

    ref_stats = masked_stats(ref, ref_mask)
    tgt_stats = masked_stats(tgt, tgt_mask)

    out = tgt.copy()
    for c in range(3):
        r_mean, r_std = ref_stats[c]
        t_mean, t_std = tgt_stats[c]
        channel = out[..., c]
        channel[tgt_mask] = (channel[tgt_mask] - t_mean) * (r_std / t_std) + r_mean
        out[..., c] = channel

    out[..., :3] = np.clip(out[..., :3], 0, 255)

    backup_dir = tgt_path.parent / "_raw"
    backup_dir.mkdir(exist_ok=True)
    backup = backup_dir / tgt_path.name
    if not backup.exists():
        Image.open(tgt_path).save(backup)

    Image.fromarray(out.astype(np.uint8), "RGBA").save(tgt_path)
    print(f"  {tgt_path.name}: igualado a {ref_path.name} (backup en _raw/)")


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    ref = pathlib.Path(sys.argv[1])
    for tgt in sys.argv[2:]:
        match_frame(ref, pathlib.Path(tgt))


if __name__ == "__main__":
    main()
