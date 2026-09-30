"""Draws the Aura-Slide icon: a bold white "A" on a slide card, lit by aurora ribbons on a night-sky tile.
Writes setup/icon/aura-slide.ico (16-256 px, each size resampled from a 1024 px master) and a 512 px PNG preview.
Run once when the design changes:  python tools/make_icon.py"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

S = 1024
OUT = os.path.join(os.path.dirname(__file__), '..', 'setup', 'icon')
os.makedirs(OUT, exist_ok=True)

def rounded_mask(size, r):
    m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), r, fill=255); return m

# night-sky tile
tile = Image.new('RGB', (S, S))
px = tile.load()
for y in range(S):
    for x in range(S):
        k = (x * 0.35 + y * 0.65) / S
        px[x, y] = (int(10 + 22 * k), int(12 + 8 * k), int(38 + 40 * k))

# aurora ribbons: soft sine bands, blurred, screened over the sky
aur = Image.new('RGB', (S, S), (0, 0, 0))
d = ImageDraw.Draw(aur)
bands = [((46, 230, 197), 0.30, 90, 0.0), ((77, 124, 255), 0.42, 80, 1.3), ((164, 92, 255), 0.55, 85, 2.4), ((255, 111, 181), 0.68, 60, 3.3)]
for col, yc, thick, ph in bands:
    pts = [(x, S * yc + math.sin(x / S * 2 * math.pi * 1.1 + ph) * S * 0.07 - (x / S) * S * 0.16) for x in range(-20, S + 21, 8)]
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=col, width=thick)
aur = aur.filter(ImageFilter.GaussianBlur(S * 0.045))
tile = ImageChops.screen(tile, aur)
glow = Image.new('RGB', (S, S), (0, 0, 0)); ImageDraw.Draw(glow).ellipse((S * 0.18, S * 0.12, S * 0.82, S * 0.76), fill=(70, 60, 140))
tile = ImageChops.screen(tile, glow.filter(ImageFilter.GaussianBlur(S * 0.12)))

# slide card (frosted) + the "A"
card = Image.new('RGBA', (S, S), (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
box = (S * 0.17, S * 0.24, S * 0.83, S * 0.76)
cd.rounded_rectangle(box, S * 0.06, fill=(255, 255, 255, 46), outline=(255, 255, 255, 215), width=int(S * 0.022))
cd.rounded_rectangle((S * 0.42, S * 0.76, S * 0.58, S * 0.80), S * 0.01, fill=(255, 255, 255, 190))   # stand
cd.rounded_rectangle((S * 0.33, S * 0.80, S * 0.67, S * 0.835), S * 0.015, fill=(255, 255, 255, 190))
font = ImageFont.truetype(r'C:\Windows\Fonts\seguibl.ttf', int(S * 0.52))
ad = ImageDraw.Draw(card)
bb = ad.textbbox((0, 0), 'A', font=font); w, h = bb[2] - bb[0], bb[3] - bb[1]
pos = (S / 2 - w / 2 - bb[0], S * 0.50 - h / 2 - bb[1])
halo = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(halo).text(pos, 'A', font=font, fill=(160, 240, 255, 200))
card = Image.alpha_composite(halo.filter(ImageFilter.GaussianBlur(S * 0.03)), card)
ImageDraw.Draw(card).text(pos, 'A', font=font, fill=(255, 255, 255, 255))

img = Image.alpha_composite(tile.convert('RGBA'), card)
img.putalpha(rounded_mask(S, int(S * 0.22)))
img.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'aura-slide.png'))
sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
frames = [img.resize((z, z), Image.LANCZOS) for z in sizes]
frames[-1].save(os.path.join(OUT, 'aura-slide.ico'), format='ICO', sizes=[(z, z) for z in sizes], append_images=frames[:-1])
print('icon written to', os.path.abspath(OUT))
