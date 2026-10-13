#!/usr/bin/env python3
"""Generate assets/icon.png — the Heros PDF app icon (512x512).

Run:  python3 assets/make-icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

S = 512
img = Image.new('RGB', (S, S), '#0e1014')
d = ImageDraw.Draw(img)
# backdrop gradient feel: two soft circles
d.ellipse([-120, -120, 300, 300], fill='#16233f')
d.ellipse([280, 280, 660, 660], fill='#241b3a')
# document sheet
d.rounded_rectangle([150, 70, 362, 442], radius=36, fill='white')
# folded corner
d.polygon([(302, 70), (362, 130), (302, 130)], fill='#c9d2dd')
# accent H tile
d.rounded_rectangle([186, 190, 326, 330], radius=30, fill='#4c8dff')
d.text((256, 258), 'H', font=ImageFont.truetype(FONTB, 110), fill='white', anchor='mm')
# text lines on sheet
for i, w in enumerate((150, 150, 110)):
    y = 356 + i * 18
    d.rectangle([186, y, 186 + w, y + 9], fill='#c9d2dd')
d.text((256, 478), 'HEROS PDF', font=ImageFont.truetype(FONTB, 30), fill='#e7eaf0', anchor='mm')

out = os.path.join(ROOT, 'assets', 'icon.png')
img.save(out, 'PNG', optimize=True)
print('wrote', out)
