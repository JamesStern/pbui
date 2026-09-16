#!/usr/bin/env python3
"""Extract the white line-art figures from photos of the poster.

Each figure is cropped from the sharpest source photo, the white silkscreen ink is
separated from the charcoal paper (and from the orange ink) with a local-contrast
threshold, and the result is written as a transparent PNG (white + alpha) into
assets/figures/. Run from the repo root:

    python3 tools/extract_figures.py

Needs Pillow + numpy. The source photos are not part of the repo.
"""
import os
import sys
import json
import numpy as np
from PIL import Image, ImageOps, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'Source Images')
OUT = os.path.join(ROOT, 'assets', 'figures')

# name -> (photo number, crop box in original photo pixels: left, top, right, bottom)
FIGURES = {
    'torso':    (4376, (1150, 1330, 2980, 2230)),
    'rings':    (4378, (1640, 120, 2370, 890)),
    'whole':    (4378, (1610, 1000, 2430, 1540)),
    'span':     (4378, (1660, 1750, 2370, 2440)),
    'peek':     (4379, (1640, 990, 2260, 1340)),
    'phalanx':  (4379, (1670, 1490, 2150, 1950)),
    'cubit':    (4380, (1440, 620, 2320, 1060)),
    'kneeling': (4380, (1360, 1330, 2300, 1840)),
    'foot':     (4381, (1840, 550, 2130, 1140)),
    'reach':    (4381, (1830, 1240, 2160, 2590)),
}

BLUR_RADIUS = 30      # background estimate radius (px)
T_LOW, T_HIGH = 28, 70  # luminance-above-background ramp for alpha (0..255 scale)
SAT_MAX = 0.30        # anything more saturated than this is orange ink / not white
MIN_COMPONENT = 200   # drop specks smaller than this many pixels


def components_filter(mask, min_size):
    """Remove connected components smaller than min_size (4-connectivity, pure numpy/BFS)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    keep = np.zeros_like(mask, dtype=bool)
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        comp = []
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(comp) >= min_size:
            for y, x in comp:
                keep[y, x] = True
    return keep


def extract(name, photo, box):
    img = ImageOps.exif_transpose(Image.open(os.path.join(SRC, f'IMG_{photo}.jpeg')))
    crop = img.crop(box).convert('RGB')
    rgb = np.asarray(crop).astype(np.float32)
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

    # local background: heavy blur of the luminance with the bright ink suppressed
    lum_img = Image.fromarray(lum.astype(np.uint8))
    bg = np.asarray(lum_img.filter(ImageFilter.GaussianBlur(BLUR_RADIUS))).astype(np.float32)
    # second pass: blur again with ink pixels replaced by background to reduce halo
    ink_guess = (lum - bg) > T_LOW
    lum2 = np.where(ink_guess, bg, lum)
    bg = np.asarray(Image.fromarray(lum2.astype(np.uint8)).filter(ImageFilter.GaussianBlur(BLUR_RADIUS))).astype(np.float32)

    diff = lum - bg
    alpha = np.clip((diff - T_LOW) / (T_HIGH - T_LOW), 0, 1)
    alpha[sat > SAT_MAX] = 0

    hard = alpha > 0.35
    kept = components_filter(hard, MIN_COMPONENT)
    alpha = alpha * kept
    # slight feather so edges are not jagged
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(alpha_img)

    ys, xs = np.nonzero(alpha > 20)
    pad = 6
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, alpha.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, alpha.shape[1])
    alpha = alpha[y0:y1, x0:x1]

    out = np.zeros((alpha.shape[0], alpha.shape[1], 4), dtype=np.uint8)
    out[..., 0:3] = 255
    out[..., 3] = alpha
    im = Image.fromarray(out, 'RGBA')
    # keep files small: figures are shown at <= ~120 px/in, photos are ~540 px/in
    scale = 0.5
    im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    path = os.path.join(OUT, f'{name}.png')
    im.save(path, optimize=True)
    return {'w': im.width, 'h': im.height, 'bytes': os.path.getsize(path)}


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    info = {}
    for name, (photo, box) in FIGURES.items():
        if only and name not in only:
            continue
        info[name] = extract(name, photo, box)
        print(f'{name:10s} {info[name]}')
    with open(os.path.join(OUT, 'figures.json'), 'w') as f:
        json.dump(info, f, indent=1)


if __name__ == '__main__':
    main()
