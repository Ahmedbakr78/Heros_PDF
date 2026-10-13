#!/usr/bin/env python3
"""Generate docs/screenshots/*.png mock captures for the Heros PDF repo.

Real captures can replace these files 1:1 (same names). Run:
    python3 assets/generate-screenshots.py
No emojis anywhere. Requires Pillow only.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'screenshots')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

THEMES = {
    'light': {
        'bg': '#e9ecf1', 'surface': '#ffffff', 'surface2': '#f3f5f8',
        'surface3': '#e8ebf0', 'border': '#dde2e9', 'text': '#14181f',
        'muted': '#7b8697', 'accent': '#2563eb', 'viewer': '#dfe3ea',
    },
    'dark': {
        'bg': '#0e1014', 'surface': '#191d24', 'surface2': '#21262e',
        'surface3': '#2a3038', 'border': '#2a303a', 'text': '#e7eaf0',
        'muted': '#79839a', 'accent': '#4c8dff', 'viewer': '#0a0c0f',
    },
}


def f(size, bold=False):
    return ImageFont.truetype(FONTB if bold else FONT, size)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def text_lines(d, x, y, w, n, color, h=7, gap=9, indent=0):
    for i in range(n):
        lw = w - indent - (40 if i % 3 == 2 else 0)
        d.rectangle([x + indent, y + i * gap, x + indent + max(30, lw), y + i * gap + h], fill=color)


def topbar(d, W, t, y=12, h=54, mobile=False):
    rr(d, [12, y, W - 12, y + h], 18, fill=t['surface'], outline=t['border'])
    # logo
    rr(d, [24, y + 12, 54, y + 42], 10, fill=t['accent'])
    d.text([64, y + 15], 'Heros PDF', font=f(17, True), fill=t['text'])
    if mobile:
        # icon-only buttons
        x = W - 24
        for _ in range(4):
            x -= 40
            rr(d, [x, y + 11, x + 32, y + 43], 10, fill=t['surface2'], outline=t['border'])
        return y + h
    # Open button
    rr(d, [190, y + 10, 280, y + 44], 12, fill=t['accent'])
    d.text([208, y + 18], 'Open', font=f(14, True), fill='white')
    # pagebox
    rr(d, [296, y + 10, 470, y + 44], 17, fill=t['surface2'])
    d.text([340, y + 18], '12 / 248', font=f(14, True), fill=t['text'])
    # zoom
    d.text([492, y + 18], '125%', font=f(14, True), fill=t['muted'])
    # right icons
    x = W - 24
    for _ in range(5):
        x -= 42
        rr(d, [x, y + 11, x + 34, y + 43], 11, fill=t['surface2'], outline=t['border'])
    return y + h


def statusbar(d, W, H, t):
    y = H - 42
    rr(d, [0, y, W, H], 0, fill=t['surface'], outline=t['border'])
    d.line([0, y, W, y], fill=t['border'], width=1)
    d.text([16, y + 8], 'Ready    248 pages    4.2 MB    Continuous', font=f(12), fill=t['muted'])
    d.text([W - 130, y + 8], '125%    12 / 248', font=f(12, True), fill=t['text'])


def page(d, box, t, num, annotate=False):
    x0, y0, x1, y1 = box
    d.rectangle([x0, y0, x1, y1], fill='white', outline=(0, 0, 0, 40), width=1)
    # title + body lines
    d.text([x0 + 28, y0 + 22], 'Chapter %d — Reading Mock' % num, font=f(15, True), fill='#111418')
    text_lines(d, x0 + 28, y0 + 56, (x1 - x0) - 56, 12, '#c9d2dd')
    if annotate:
        # yellow highlight stroke
        d.rectangle([x0 + 28, y0 + 150, x0 + 300, y0 + 168], fill='#ffd400')
        text_lines(d, x0 + 28, y0 + 190, (x1 - x0) - 56, 6, '#c9d2dd')
        # pen squiggle
        pts = [(x0 + 40 + i * 22, y0 + 300 + (20 if i % 2 else -12)) for i in range(12)]
        d.line(pts, fill='#ff6b6a', width=4, joint='curve')
        # blue rectangle
        d.rectangle([x0 + 300, y0 + 280, x0 + 480, y0 + 380], outline='#4c8dff', width=4)
        # stamp chip
        rr(d, [x0 + 28, y0 + 400, x0 + 170, y0 + 430], 15, fill='#e8eefc', outline='#4c8dff')
        d.text([x0 + 46, y0 + 406], 'APPROVED', font=f(12, True), fill='#2563eb')
    d.text([x1 - 52, y1 - 28], str(num), font=f(11, True), fill='white')
    rr(d, [x1 - 58, y1 - 32, x1 - 16, y1 - 12], 10, fill='#000000')


def thumbs_grid(d, x, y, w, t, cols=2, rows=3):
    cw = (w - 10 * (cols - 1)) // cols
    ch = int(cw * 1.3)
    for r in range(rows):
        for c in range(cols):
            x0 = x + c * (cw + 10)
            y0 = y + r * (ch + 10)
            rr(d, [x0, y0, x0 + cw, y0 + ch], 12, fill=t['surface2'], outline=t['border'])
            d.rectangle([x0 + 10, y0 + 10, x0 + cw - 10, y0 + 30], fill=t['surface3'])
            text_lines(d, x0 + 10, y0 + 40, cw - 20, 5, t['surface3'], h=5, gap=8)
            n = r * cols + c + 1
            rr(d, [x0 + cw - 40, y0 + ch - 24, x0 + cw - 8, y0 + ch - 8], 6, fill='#000000')
            d.text([x0 + cw - 32, y0 + ch - 23], str(n), font=f(10, True), fill='white')
    return y + rows * (ch + 10)


def side_tabs(d, x, y, w, t, active=0):
    labels = ['Pages', 'Edit', 'Search', 'Marks', 'Tools']
    bw = w // len(labels)
    fs = 11 if w < 320 else 12
    rr(d, [x, y, x + w, y + 52], 26, fill=t['surface2'], outline=t['border'])
    for i, lb in enumerate(labels):
        bx = x + 4 + i * bw
        if i == active:
            rr(d, [bx, y + 5, bx + bw - 8, y + 47], 22, fill=t['surface'], outline=t['border'])
        d.text([bx + 12, y + 18], lb, font=f(fs, True), fill=t['accent'] if i == active else t['muted'])
    return y + 62


def shot_light():
    W, H = 1280, 800
    t = THEMES['light']
    img = Image.new('RGB', (W, H), t['bg'])
    d = ImageDraw.Draw(img)
    tb = topbar(d, W, t)
    # sidebar
    rr(d, [12, tb + 12, 320, H - 54], 24, fill=t['surface'], outline=t['border'])
    side_tabs(d, 24, tb + 24, 272, t, 0)
    thumbs_grid(d, 24, tb + 96, 272, t, rows=2)
    d.text([24, tb + 96 + 2 * 200], 'Page thumbnails, outline, search, recents', font=f(12), fill=t['muted'])
    # viewer pages
    page(d, [360, tb + 12, 920, tb + 330], t, 12)
    page(d, [360, tb + 348, 920, tb + 560], t, 13)
    statusbar(d, W, H, t)
    d.text([360, H - 78], 'Light mode — Heros PDF viewer', font=f(13, True), fill=t['muted'])
    return img


def shot_dark():
    W, H = 1280, 800
    t = THEMES['dark']
    img = Image.new('RGB', (W, H), t['bg'])
    d = ImageDraw.Draw(img)
    tb = topbar(d, W, t)
    rr(d, [12, tb + 12, 320, H - 54], 24, fill=t['surface'], outline=t['border'])
    side_tabs(d, 24, tb + 24, 272, t, 0)
    thumbs_grid(d, 24, tb + 96, 272, t, rows=2)
    d.text([24, tb + 96 + 2 * 200], 'Page thumbnails, outline, search, recents', font=f(12), fill=t['muted'])
    page(d, [360, tb + 12, 920, tb + 330], t, 12)
    page(d, [360, tb + 348, 920, tb + 560], t, 13)
    statusbar(d, W, H, t)
    d.text([360, H - 78], 'Dark mode — Heros PDF viewer', font=f(13, True), fill=t['muted'])
    return img


def shot_sidebar():
    W, H = 1280, 800
    t = THEMES['dark']
    img = Image.new('RGB', (W, H), t['bg'])
    d = ImageDraw.Draw(img)
    tb = topbar(d, W, t)
    # wide sidebar focus
    rr(d, [12, tb + 12, 520, H - 54], 24, fill=t['surface'], outline=t['border'])
    side_tabs(d, 24, tb + 24, 472, t, 2)
    # search box
    rr(d, [24, tb + 96, 496, tb + 134], 19, fill=t['surface2'], outline=t['border'])
    d.text([44, tb + 106], 'Search in document…  “reading”  24 results', font=f(13), fill=t['muted'])
    y = tb + 146
    for i in range(4):
        rr(d, [24, y, 496, y + 86], 14, fill=t['surface2'] if i else '#16233f', outline=t['accent'] if not i else t['border'])
        d.text([40, y + 8], 'Page %d' % (12 + i * 3), font=f(11, True), fill=t['muted'])
        d.text([40, y + 28], '…effective …reading… speed with', font=f(13), fill=t['text'])
        d.text([40, y + 50], 'lazy rendering and capped search…', font=f(13), fill=t['text'])
        y += 96
    # viewer sliver
    page(d, [560, tb + 12, 1120, tb + 420], t, 12)
    statusbar(d, W, H, t)
    return img


def shot_annotate():
    W, H = 1280, 800
    t = THEMES['dark']
    img = Image.new('RGB', (W, H), t['bg'])
    d = ImageDraw.Draw(img)
    tb = topbar(d, W, t)
    # annotate floating toolbar
    rr(d, [300, tb + 12, 980, tb + 62], 18, fill=t['surface'], outline=t['border'])
    tools = ['Select', 'Mark', 'Pen', 'Rect', 'Text', 'Erase']
    x = 316
    for i, lb in enumerate(tools):
        rr(d, [x, tb + 20, x + 96, tb + 54], 10, fill=t['accent'] if i == 1 else t['surface2'])
        d.text([x + 16, tb + 28], lb, font=f(12, True), fill='white' if i == 1 else t['text'])
        x += 106
    # page with annotations
    rr(d, [12, tb + 74, 320, H - 54], 24, fill=t['surface'], outline=t['border'])
    side_tabs(d, 24, tb + 86, 272, t, 3)
    d.text([24, tb + 160], 'Markers list', font=f(12, True), fill=t['muted'])
    for i, lb in enumerate(['Marker — page 12', 'Pen — page 12', 'Note — page 13']):
        rr(d, [24, tb + 186 + i * 52, 296, tb + 230 + i * 52], 14, fill=t['surface2'], outline=t['border'])
        d.text([60, tb + 200 + i * 52], lb, font=f(12, True), fill=t['text'])
    page(d, [360, tb + 74, 920, tb + 620], t, 12, annotate=True)
    statusbar(d, W, H, t)
    return img


def shot_edit():
    W, H = 1280, 800
    t = THEMES['dark']
    img = Image.new('RGB', (W, H), t['bg'])
    d = ImageDraw.Draw(img)
    tb = topbar(d, W, t)
    rr(d, [12, tb + 12, 560, H - 54], 24, fill=t['surface'], outline=t['border'])
    side_tabs(d, 24, tb + 24, 512, t, 1)
    d.text([24, tb + 96], 'PDF Edit Studio — 100% free', font=f(13, True), fill=t['text'])
    # merge card
    rr(d, [24, tb + 122, 536, tb + 210], 18, fill=t['surface2'], outline=t['border'])
    d.text([40, tb + 132], 'Merge PDFs', font=f(13, True), fill=t['text'])
    d.text([40, tb + 154], 'Combine many PDFs into one. Unlimited, local.', font=f(12), fill=t['muted'])
    rr(d, [40, tb + 176, 220, tb + 202], 10, fill=t['accent'])
    d.text([58, tb + 181], 'Merge queued files', font=f(12, True), fill='white')
    # pages grid
    d.text([24, tb + 222], 'Pages — select then act', font=f(13, True), fill=t['text'])
    for r in range(2):
        for c in range(4):
            x0 = 24 + c * 130
            y0 = tb + 248 + r * 150
            sel = (r == 0 and c in (0, 2))
            rr(d, [x0, y0, x0 + 118, y0 + 138], 14, fill=t['surface2'], outline=t['accent'] if sel else t['border'], width=2 if sel else 1)
            d.rectangle([x0 + 12, y0 + 12, x0 + 106, y0 + 30], fill=t['surface3'])
            text_lines(d, x0 + 12, y0 + 38, 94, 6, t['surface3'], h=5, gap=9)
            d.text([x0 + 12, y0 + 116], 'p.%d' % (r * 4 + c + 1), font=f(11, True), fill=t['muted'])
    # viewer sliver
    page(d, [600, tb + 12, 1160, tb + 420], t, 12)
    statusbar(d, W, H, t)
    return img


def shot_mobile():
    W, H = 480, 900
    t = THEMES['dark']
    img = Image.new('RGB', (W, H), t['bg'])
    d = ImageDraw.Draw(img)
    # compact topbar
    rr(d, [8, 8, W - 8, 66], 16, fill=t['surface'], outline=t['border'])
    rr(d, [18, 20, 48, 54], 9, fill=t['accent'])
    d.text([58, 28], 'Heros PDF', font=f(14, True), fill=t['text'])
    x = W - 18
    for _ in range(3):
        x -= 38
        rr(d, [x, 20, x + 32, 54], 9, fill=t['surface2'], outline=t['border'])
    # pagebox pill
    rr(d, [18, 76, W - 18, 116], 20, fill=t['surface2'])
    d.text([150, 87], '12 / 248', font=f(13, True), fill=t['text'])
    # single page
    d.rectangle([24, 130, W - 24, 700], fill='white')
    d.text([48, 152], 'Chapter 12', font=f(13, True), fill='#111418')
    text_lines(d, 48, 182, W - 96, 22, '#c9d2dd', h=6, gap=14)
    # tools bar
    rr(d, [18, 716, W - 18, 762], 23, fill=t['surface'], outline=t['border'])
    d.text([60, 729], 'Stopwatch  04:32    Todo 3/5    Goal 80%', font=f(11, True), fill=t['text'])
    # status
    d.text([18, 776], 'Ready — 125% — 12 / 248', font=f(11), fill=t['muted'])
    rr(d, [18, 800, W - 18, 850], 12, fill=t['accent'])
    d.text([170, 814], 'Open PDF', font=f(13, True), fill='white')
    d.text([18, 862], 'Mobile — drawer sidebar, touch draw', font=f(11), fill=t['muted'])
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = {
        'light.png': shot_light(),
        'dark.png': shot_dark(),
        'sidebar.png': shot_sidebar(),
        'annotate.png': shot_annotate(),
        'edit.png': shot_edit(),
        'mobile.png': shot_mobile(),
    }
    for name, img in shots.items():
        p = os.path.join(OUT, name)
        img.save(p, 'PNG', optimize=True)
        print('wrote', p, img.size)


if __name__ == '__main__':
    main()
