#!/usr/bin/env python3
"""Slice player_walk_sheet.png into 8 aligned, color-matched walk frames.

Removes the white background, segments the 8 figures, normalises each onto an
idle-sized canvas (common scale, feet on a shared ground line, centred by the
torso so the body bobs naturally), and colour-matches the jacket to the idle.
Current walk frames are backed up to characters/_prev/.
"""

import pathlib
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

CHARS = pathlib.Path(__file__).resolve().parent / "characters"
SHEET = CHARS / "player_walk_sheet.png"
N = 8
SCALE_ADJUST = 1.0   # tweak if the walk sprite looks bigger/smaller than idle


def jacket_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mn = np.minimum(r, g)
    sat = np.divide(b - mn, np.maximum(b, 1))
    return (a[..., 3] > 128) & (b > r + 20) & (b > g) & (b > 60) & (sat > 0.35)


def remove_white_bg(img):
    base = np.asarray(img.convert("RGBA"))
    if base[..., 3].min() < 10 and base[..., 3].max() > 200:
        return base  # sheet already has a transparent background
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    mx, mn = rgb.max(2), rgb.min(2)
    sat = mx - mn
    candidate = (sat <= 18) & (mn >= 205)
    lbl, _ = ndimage.label(candidate)
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border.discard(0)
    bg = np.isin(lbl, list(border))
    near = ndimage.binary_dilation(bg, iterations=3)
    halo = near & (~bg) & (sat <= 18) & (mn >= 224)
    bg = bg | halo
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
    return np.dstack([np.asarray(img.convert("RGB")), alpha])


def bbox(alpha):
    ys, xs = np.where(alpha > 128)
    return ys.min(), ys.max(), xs.min(), xs.max()


def split_run(prof, x0, x1, k):
    """Split a merged run into k sub-figures at the deepest valleys near the
    evenly-spaced boundaries (so a stray limb doesn't cause a bad cut)."""
    if k <= 1:
        return [(x0, x1)]
    width = x1 - x0
    cuts = []
    for i in range(1, k):
        center = x0 + round(width * i / k)
        win = max(5, round(width / k * 0.35))
        lo = max(x0 + 1, center - win)
        hi = min(x1 - 1, center + win)
        cuts.append(lo + int(np.argmin(prof[lo:hi + 1])))
    bounds = [x0 - 1] + cuts + [x1]
    return [(bounds[j] + 1, bounds[j + 1]) for j in range(len(bounds) - 1)]


def main():
    idle = np.asarray(Image.open(CHARS / "player_idle_1.png").convert("RGBA"))
    IH, IW = idle.shape[:2]
    iy0, iy1, _, _ = bbox(idle[..., 3])
    idle_char_h = iy1 - iy0
    idle_feet_from_bottom = IH - 1 - iy1

    tj = []
    for n in (1, 2, 3):
        a = np.asarray(Image.open(CHARS / f"player_idle_{n}.png").convert("RGBA")).astype(float)
        tj.append(a[..., :3][jacket_mask(a)].mean(0))
    target = np.mean(tj, 0)

    sheet = remove_white_bg(Image.open(SHEET))
    alpha = sheet[..., 3] > 128
    H, W = alpha.shape
    prof = alpha.sum(0)
    fg = prof > (H * 0.01)
    raw, start, inrun = [], 0, False
    for x in range(W):
        if fg[x] and not inrun:
            start, inrun = x, True
        elif not fg[x] and inrun:
            raw.append((start, x - 1)); inrun = False
    if inrun:
        raw.append((start, W - 1))

    # Drop noise runs, estimate a typical figure width, then split merged runs.
    typical = float(np.median([e - s for s, e in raw]))
    raw = [(s, e) for (s, e) in raw if (e - s) >= 0.25 * typical]
    typical = float(np.median([e - s for s, e in raw]))
    ks = [max(1, round((e - s) / typical)) for s, e in raw]
    while sum(ks) < N:
        i = max(range(len(raw)), key=lambda i: (raw[i][1] - raw[i][0]) / ks[i])
        ks[i] += 1
    while sum(ks) > N:
        cand = [i for i, k in enumerate(ks) if k > 1]
        i = min(cand, key=lambda i: (raw[i][1] - raw[i][0]) / ks[i])
        ks[i] -= 1
    runs = []
    for (s, e), k in zip(raw, ks):
        runs += split_run(prof, s, e, k)
    runs = sorted(runs)
    if len(runs) != N:
        raise SystemExit(f"Esperaba {N} figuras, encontre {len(runs)}. Revisa la hoja.")

    cells, heights = [], []
    for (x0, x1) in runs:
        sub = sheet[:, x0:x1 + 1]
        y0, y1, cx0, cx1 = bbox(sub[..., 3])
        cells.append(sub[y0:y1 + 1, cx0:cx1 + 1])
        heights.append(y1 - y0)
    scale = (idle_char_h / max(heights)) * SCALE_ADJUST

    prev = CHARS / "_prev"; prev.mkdir(exist_ok=True)
    for p in CHARS.glob("player_walk_[1-8].png"):
        (prev / p.name).write_bytes(p.read_bytes())

    feet_y = IH - 1 - idle_feet_from_bottom
    for i, crop in enumerate(cells, start=1):
        ch = Image.fromarray(crop.astype("uint8"), "RGBA")
        nw, nh = max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))
        ch = ch.resize((nw, nh), Image.LANCZOS)
        ca = np.asarray(ch)[..., 3] > 128
        cut = int(nh * 0.55)
        top = ca.copy(); top[cut:, :] = False
        txs = np.where(top)[1]
        torso_cx = txs.mean() if len(txs) else nw / 2

        canvas = Image.new("RGBA", (IW, IH), (0, 0, 0, 0))
        left = int(round(IW / 2 - torso_cx))
        top_y = int(round(feet_y - (nh - 1)))
        canvas.paste(ch, (left, top_y), ch)

        out = np.asarray(canvas).astype(float)
        m = jacket_mask(out)
        if m.any():
            off = target - out[..., :3][m].mean(0)
            for c in range(3):
                chn = out[..., c]; chn[m] = np.clip(chn[m] + off[c], 0, 255); out[..., c] = chn
        Image.fromarray(out.astype("uint8"), "RGBA").save(CHARS / f"player_walk_{i}.png")
        print(f"  player_walk_{i}.png  size={nw}x{nh}")

    print(f"OK. Escala={scale:.3f}  canvas={IW}x{IH}  (originales en characters/_prev/)")


if __name__ == "__main__":
    main()
