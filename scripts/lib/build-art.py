"""Builds games/dodge-drop/public/assets/art/*.png from the (untrusted, unzipped) Kenney CC0 packs.

Usage: python3 -I scripts/lib/build-art.py <extracted-packs-dir> <out-art-dir> <orbitron-ttf>
Needs Pillow. Packs dir holds kenney_simple-space, kenney_particle-pack, kenney_ui-pack-space-expansion.
All sprites are white/neutral so the game tints them in code (neon palette).
The logo is lettering rendered from Orbitron (SIL OFL 1.1); the font file itself is never shipped.
"""
import random
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

packs, out, font_path = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
out.mkdir(parents=True, exist_ok=True)
SS = packs / 'kenney_simple-space/PNG/Retina'
PP = packs / 'kenney_particle-pack/PNG (Transparent)'
UI = packs / 'kenney_ui-pack-space-expansion/PNG/Extra/Double'


def load(p): return Image.open(p).convert('RGBA')


def save(im, name, colors=128):
    q = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(out / name, optimize=True)


def fit(im, size):
    return im.resize(size, Image.Resampling.LANCZOS)


def tint(im, rgb, alpha=1.0):
    r, g, b, a = im.split()
    a = a.point(lambda v: int(v * alpha))
    return Image.merge('RGBA', (Image.new('L', im.size, rgb[0]), Image.new('L', im.size, rgb[1]), Image.new('L', im.size, rgb[2]), a))


def paste_wrap(canvas, sprite, x, y):
    w, h = canvas.size
    for dx in (-w, 0, w):
        for dy in (-h, 0, h):
            canvas.alpha_composite(sprite, (x + dx, y + dy)) if 0 <= x + dx and 0 <= y + dy and x + dx + sprite.width <= w and y + dy + sprite.height <= h else _clip(canvas, sprite, x + dx, y + dy)


def _clip(canvas, sprite, x, y):
    w, h = canvas.size
    if x >= w or y >= h or x + sprite.width <= 0 or y + sprite.height <= 0:
        return
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(sprite, (x, y))
    canvas.alpha_composite(layer)


# pickups / shield / ring (white, tinted in code)
save(fit(load(PP / 'star_06.png'), (128, 128)), 'star.png', 64)
save(fit(load(PP / 'circle_03.png'), (256, 256)), 'shield.png', 64)
save(fit(load(PP / 'circle_02.png'), (256, 256)), 'ring.png', 64)

# UI skin
save(load(UI / 'panel_glass.png'), 'ui-panel.png', 64)
save(load(UI / 'button_rectangle.png'), 'ui-button.png', 64)
save(load(UI / 'button_rectangle_depth.png'), 'ui-button-depth.png', 64)

# parallax layers: 512x512 seamless (wrap-around) transparent star fields
rnd = random.Random(7)
far = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
tiny = [load(SS / n) for n in ('star_tiny.png', 'star_small.png')]
for _ in range(70):
    s = rnd.choice(tiny)
    col = rnd.choice([(190, 170, 255), (150, 230, 255), (255, 255, 255)])
    paste_wrap(far, tint(s, col, rnd.uniform(0.35, 0.8)), rnd.randrange(512), rnd.randrange(512))
save(far, 'bg-far.png', 32)
mid = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
glow = [fit(load(PP / n), (48, 48)) for n in ('star_04.png', 'star_05.png', 'star_07.png')]
med = [load(SS / 'star_medium.png'), load(SS / 'star_large.png')]
for i in range(22):
    s = rnd.choice(glow + med)
    col = rnd.choice([(255, 120, 220), (90, 240, 255), (185, 140, 255)])
    paste_wrap(mid, tint(s, col, rnd.uniform(0.5, 0.95)), rnd.randrange(512), rnd.randrange(512))
save(mid, 'bg-mid.png', 48)

# side-panel decoration (landscape): faint tall composition, 400x900
panel = Image.new('RGBA', (400, 900), (0, 0, 0, 0))
items = [
    (PP / 'circle_01.png', 360, 40, 20, (90, 240, 255), 0.35),
    (PP / 'magic_03.png', 300, 50, 380, (255, 120, 220), 0.4),
    (PP / 'light_02.png', 340, 30, 640, (185, 140, 255), 0.35),
]
for p, size, x, y, col, a in items:
    panel.alpha_composite(tint(fit(load(p), (size, size)), col, a), (x, y))
for n, size, x, y, col in (('station_C.png', 110, 145, 150, (90, 240, 255)), ('satellite_A.png', 100, 150, 450, (255, 120, 220)), ('ship_sidesC.png', 120, 140, 700, (185, 140, 255))):
    panel.alpha_composite(tint(fit(load(SS / n), (size, size)), col, 0.5), (x, y))
save(panel, 'panel-art.png', 48)

# title logo: gradient lettering with neon glow (Orbitron Black, SIL OFL 1.1)
font = ImageFont.truetype(font_path, 150)
try:
    font.set_variation_by_axes([900])
except Exception:
    pass
W, H, pad = 1000, 340, 40
mask = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(mask)
for text, y in (('NEON', 20), ('RUSH', 175)):
    bb = d.textbbox((0, 0), text, font=font)
    d.text(((W - (bb[2] - bb[0])) // 2 - bb[0], y), text, font=font, fill=255)
grad = Image.new('RGBA', (W, H))
gd = ImageDraw.Draw(grad)
for yy in range(H):
    t = yy / (H - 1)
    gd.line([(0, yy), (W, yy)], fill=(int(70 + 185 * t), int(240 - 120 * t), int(255 - 35 * t), 255))
glow_l = Image.new('RGBA', (W, H), (255, 90, 220, 0))
halo = mask.filter(ImageFilter.GaussianBlur(14)).point(lambda v: min(255, int(v * 1.6)))
glow_l.putalpha(halo)
logo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
logo.alpha_composite(glow_l)
text_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
text_layer.paste(grad, (0, 0), mask)
logo.alpha_composite(text_layer)
logo = logo.crop(logo.getbbox())
logo = fit(logo, (logo.width * 640 // logo.width, logo.height * 640 // logo.width))
save(logo, 'logo.png', 128)
print('ok')
