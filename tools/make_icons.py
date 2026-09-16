#!/usr/bin/env python3
"""Generate the PWA icons: a charcoal square with an orange dimension line and a white
label bar, in the language of the poster. Run from the repo root:

    python3 tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
PAPER = (74, 74, 72)
ORANGE = (255, 106, 19)
BAR = (233, 233, 228)


def draw_icon(size, maskable=False):
    im = Image.new('RGBA', (size, size), PAPER)
    d = ImageDraw.Draw(im)
    s = size / 100.0
    inset = 12 if maskable else 6
    # dimension line with end ticks
    y = (32 + inset * 0.3) * s
    x0, x1 = (20 + inset) * s, (80 - inset) * s
    lw = max(2, int(2.2 * s))
    d.line([(x0, y), (x1, y)], fill=ORANGE, width=lw)
    for x in (x0, x1):
        d.line([(x, y - 9 * s), (x, y + 9 * s)], fill=ORANGE, width=lw)
        r = 3.2 * s
        d.ellipse([x - r, y - r, x + r, y + r], fill=ORANGE)
    # leader down to the bar
    bx0, bx1 = (26 + inset) * s, (74 - inset) * s
    by0, by1 = (58 + inset * 0.2) * s, (70 + inset * 0.2) * s
    mid = (x0 + x1) / 2
    d.line([(mid, y), (mid, by0 - 10 * s), (mid + 10 * s, by0)], fill=ORANGE, width=lw)
    # label bar with orange tab
    d.rectangle([bx0, by0, bx1, by1], fill=BAR)
    d.rectangle([bx1 - 7 * s, by0, bx1, by1], fill=ORANGE)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    draw_icon(512).save(os.path.join(OUT, 'icon-512.png'))
    draw_icon(192).save(os.path.join(OUT, 'icon-192.png'))
    draw_icon(512, maskable=True).save(os.path.join(OUT, 'icon-512-maskable.png'))
    draw_icon(180).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    draw_icon(64).resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, 'favicon-32.png'))
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
