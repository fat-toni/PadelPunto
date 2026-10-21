# Draws the pictures for the GitHub README from the simulator screenshots in docs/images/screenshots:
# the banner (also used as the repo's social preview, with an Active 3 behind the Bip 6) and each
# screen in a Bip 6 watch frame.
# The racket spin (docs/images/watch/serve-spin.webp, animated) is drawn from the widgets
# that tools/serve_spin.mjs records on the simulated watch, in Roboto like the simulator's font
# (downloaded once into ~/.cache/padelpunto).
# Usage: python3 tools/readme_art.py   (writes docs/images/banner.png and docs/images/watch/*.png)
import json
import math
import os
import subprocess
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from logo import logo  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMAGES = os.path.join(ROOT, 'docs', 'images')
SHOTS = os.path.join(IMAGES, 'screenshots')
FONT = '/usr/share/fonts/truetype/ubuntu/Ubuntu[wdth,wght].ttf'
ROBOTO_URL = 'https://github.com/google/fonts/raw/main/ofl/roboto/Roboto%5Bwdth,wght%5D.ttf'
ROBOTO = os.path.expanduser('~/.cache/padelpunto/Roboto.ttf')
ASSETS = os.path.join(ROOT, 'assets', 'default.s')
# colors from utils/theme.js
BG, CARD, MUTED, BALL, WHITE = (14, 16, 18), (21, 24, 27), (139, 147, 155), (212, 245, 60), (240, 243, 245)

def font(size, style='Bold'):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(style)
    return f

# A screenshot (390x450) in a Bip 6 style case: graphite body, black bezel, side button,
# rounded screen corners. k scales the whole watch; the result has a transparent background.
def watch(shot, k=1.0):
    S = 4
    sw, sh = shot.size
    bez, body = 22, 26
    W, H = (sw + 2 * (bez + body)) * S, (sh + 2 * (bez + body)) * S
    img = Image.new('RGBA', (W + 16 * S, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # side button (right), drawn first so the body covers its inner end
    d.rounded_rectangle([W - 20 * S, H * 0.30, W + 12 * S, H * 0.30 + 70 * S], radius=8 * S, fill=(58, 62, 68))
    # body with a lighter rim
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=118 * S, fill=(74, 79, 86))
    d.rounded_rectangle([3 * S, 3 * S, W - 3 * S, H - 3 * S], radius=115 * S, fill=(44, 47, 52))
    # black glass with the screen inside
    g = body * S
    d.rounded_rectangle([g, g, W - g, H - g], radius=92 * S, fill=(0, 0, 0))
    shot = shot.convert('RGBA')
    ImageDraw.Draw(shot).rectangle([0, 0, sw - 1, sh - 1], outline=(0, 0, 0))  # simulator's 1 px frame
    screen = shot.resize((sw * S, sh * S), Image.LANCZOS)
    mask = Image.new('L', screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw * S - 1, sh * S - 1], radius=58 * S, fill=255)
    img.paste(screen, ((body + bez) * S, (body + bez) * S), mask)
    # faint glass reflection on the upper left
    shine = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shine).polygon([(g, g), (W * 0.55, g), (g, H * 0.42)], fill=(255, 255, 255, 10))
    # only on the glass, not over the rounded corner onto the body
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([g, g, W - g, H - g], radius=92 * S, fill=255)
    img.alpha_composite(Image.composite(shine, Image.new('RGBA', img.size, (0, 0, 0, 0)), m))
    return img.resize((round(img.width * k / S), round(img.height * k / S)), Image.LANCZOS)

# The same screenshot on a round screen (466 px) in an Active 3 style case: steel rim, dark bezel
# with minute ticks, two buttons on the right. The square screen is scaled down to fit the circle.
def round_watch(shot, k=1.0, fit=0.9):
    S = 4
    D, bez, body = 466, 20, 30
    W = (D + 2 * (bez + body)) * S
    c = W / 2
    img = Image.new('RGBA', (W + 18 * S, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # two buttons (right), drawn first so the body covers their inner ends
    for a in (-32, 32):
        x, y = c + math.cos(math.radians(a)) * c, c + math.sin(math.radians(a)) * c
        d.rounded_rectangle([x - 30 * S, y - 24 * S, x + 14 * S, y + 24 * S], radius=9 * S, fill=(58, 62, 68))
    # steel body with a lighter rim
    d.ellipse([0, 0, W - 1, W - 1], fill=(120, 126, 134))
    d.ellipse([4 * S, 4 * S, W - 4 * S, W - 4 * S], fill=(52, 56, 62))
    # bezel with minute ticks
    g = body * S
    d.ellipse([g - 6 * S, g - 6 * S, W - g + 6 * S, W - g + 6 * S], fill=(22, 24, 27))
    r0, r1 = c - g + 4 * S, c - g - 2 * S
    for i in range(60):
        a = math.radians(i * 6)
        r = r1 - (5 * S if i % 5 == 0 else 0)
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r, c + math.sin(a) * r)],
               fill=(150, 156, 164) if i % 5 == 0 else (80, 85, 92), width=(2 if i % 5 == 0 else 1) * S)
    # black glass with the round screen inside
    d.ellipse([g + bez * S - 8 * S, g + bez * S - 8 * S, W - g - bez * S + 8 * S, W - g - bez * S + 8 * S],
              fill=(0, 0, 0))
    shot = shot.convert('RGBA')
    sw, sh = shot.size
    ImageDraw.Draw(shot).rectangle([0, 0, sw - 1, sh - 1], outline=(0, 0, 0))  # simulator's 1 px frame
    screen = Image.new('RGBA', (D * S, D * S), (0, 0, 0, 255))
    fw, fh = round(sw * fit * S), round(sh * fit * S)
    screen.alpha_composite(shot.resize((fw, fh), Image.LANCZOS), ((D * S - fw) // 2, (D * S - fh) // 2))
    mask = Image.new('L', screen.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, D * S - 1, D * S - 1], fill=255)
    img.paste(screen, ((body + bez) * S, (body + bez) * S), mask)
    shine = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shine).polygon([(g, g), (W * 0.55, g), (g, W * 0.42)], fill=(255, 255, 255, 10))
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse([g, g, W - g, W - g], fill=255)
    img.alpha_composite(Image.composite(shine, Image.new('RGBA', img.size, (0, 0, 0, 0)), m))
    return img.resize((round(img.width * k / S), round(img.height * k / S)), Image.LANCZOS)

def shadow(im, blur=28, alpha=150):
    a = im.getchannel('A').point(lambda v: alpha if v else 0)
    pad = blur * 3
    sh = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 255), (pad, pad), a)
    sh.putalpha(sh.getchannel('A').filter(ImageFilter.GaussianBlur(blur)))
    return sh, pad

def place(canvas, im, x, y, angle=0):
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh, pad = shadow(im)
    canvas.alpha_composite(sh, (x - pad + 10, y - pad + 24))
    canvas.alpha_composite(im, (x, y))

def court(W, H):
    # top view of a padel court (20 x 10 m: net, service lines 3 m before the walls, centre line)
    # as faint lines, tilted, behind the watches
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    u, x0, y0 = 46, 0, 0
    cw, cl = 10 * u, 20 * u
    col, lw = (212, 245, 60, 46), 5
    d.rectangle([x0, y0, x0 + cw, y0 + cl], outline=col, width=lw)
    d.line([(x0, y0 + cl / 2), (x0 + cw, y0 + cl / 2)], fill=(240, 243, 245, 60), width=lw + 3)
    for y in (y0 + 3 * u, y0 + cl - 3 * u):
        d.line([(x0, y), (x0 + cw, y)], fill=col, width=lw)
    d.line([(x0 + cw / 2, y0 + 3 * u), (x0 + cw / 2, y0 + cl - 3 * u)], fill=col, width=lw)
    layer = layer.crop((0, 0, cw + lw, cl + lw)).rotate(62, resample=Image.BICUBIC, expand=True)
    return layer

def banner():
    W, H = 1280, 640
    img = Image.new('RGBA', (W, H), BG + (255,))
    # glow in court blue behind the watches, lime glow low on the left
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([620, -40, 1300, 640], fill=(32, 78, 140, 150))
    gd.ellipse([-260, 420, 420, 900], fill=(212, 245, 60, 40))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    c = court(W, H)
    img.alpha_composite(c, (560, (H - c.height) // 2 + 10))

    d = ImageDraw.Draw(img)
    x = 84
    img.alpha_composite(logo(132), (x - 10, 54))
    d.text((x, 198), 'Padel Punto', font=font(96), fill=WHITE)
    d.text((x, 316), 'No more “wait,', font=font(46, 'Medium'), fill=BALL)
    d.text((x, 370), 'what’s the score?”', font=font(46, 'Medium'), fill=BALL)
    d.text((x, 446), 'Padel score counter for Amazfit watches', font=font(26, 'Regular'), fill=MUTED)
    # pills in two rows, left of the watches: first what the watch does for you in the match,
    # then around it, and last why it is easy to try
    f = font(20, 'Medium')
    rows = (('One tap per point', 'Says the score out loud', 'Buzzes at change of ends'),
            ('Never overrun your booking', 'No phone needed', 'Free & open source'))
    for row, ts in enumerate(rows):
        px, py = x, 494 + row * 46
        for t in ts:
            tw = d.textlength(t, font=f)
            d.rounded_rectangle([px, py, px + tw + 30, py + 36], radius=18, fill=(35, 39, 44), outline=(52, 57, 63), width=2)
            d.text((px + 15, py + 18), t, font=f, fill=WHITE, anchor='lm')
            px += tw + 42
    # supported watches, small and quiet at the bottom
    d.text((x, 604), 'Bip 6 · Active 2 (Square) · Bip Max', font=font(19, 'Regular'), fill=(92, 99, 107))

    shot = lambda n: Image.open(os.path.join(SHOTS, f'{n}.png'))
    place(img, round_watch(shot('start'), 0.6), 660, 120, angle=9)
    place(img, watch(shot('match'), 0.8), 850, 82, angle=-5)
    return img.convert('RGB')

# ---- drawing recorded widgets like the watch (only the kinds page/serve uses) ----

def roboto(size, cache={}):
    if not os.path.exists(ROBOTO):
        os.makedirs(os.path.dirname(ROBOTO), exist_ok=True)
        urllib.request.urlretrieve(ROBOTO_URL, ROBOTO)
    if size not in cache:
        f = ImageFont.truetype(ROBOTO, size)
        f.set_variation_by_axes([500, 100])  # weight, width
        cache[size] = f
    return cache[size]

rgb = lambda c: ((c >> 16) & 255, (c >> 8) & 255, c & 255)

def draw_text(d, p, color):
    if not p.get('text'):
        return
    x, y, w, h, ah = p['x'], p['y'], p['w'], p['h'], p.get('align_h', 1)
    d.text(({0: x, 1: x + w / 2, 2: x + w}[ah], y + h / 2), str(p['text']), font=roboto(p.get('text_size', 24)),
           fill=rgb(color), anchor={0: 'l', 1: 'm', 2: 'r'}[ah] + 'm')

def draw_screen(widgets):
    img = Image.new('RGBA', (390, 450), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    for wd in widgets:
        t, p = wd['type'], wd['props']
        box = [p.get('x', 0), p.get('y', 0), p.get('x', 0) + p.get('w', 0) - 1, p.get('y', 0) + p.get('h', 0) - 1]
        if t == 'FILL_RECT':
            d.rounded_rectangle(box, radius=p.get('radius', 0), fill=rgb(p['color']))
        elif t == 'TEXT':
            draw_text(d, p, p.get('color', 0xffffff))
        elif t == 'BUTTON':
            d.rounded_rectangle(box, radius=p.get('radius', 0), fill=rgb(p['normal_color']))
            draw_text(d, p, p.get('color', 0xffffff))
        elif t == 'IMG':
            # placed at pos_x/pos_y in its box, turned clockwise by angle around center_x/center_y
            im = Image.open(os.path.join(ASSETS, p['src'])).convert('RGBA')
            layer = Image.new('RGBA', (p['w'], p['h']), (0, 0, 0, 0))
            layer.alpha_composite(im, (round(p.get('pos_x', 0)), round(p.get('pos_y', 0))))
            if p.get('angle'):
                layer = layer.rotate(-p['angle'], resample=Image.BICUBIC, center=(p['center_x'], p['center_y']))
            img.alpha_composite(layer, (p['x'], p['y']))
    return img

def tap(img, x, y):
    img = img.copy()
    o = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(o).ellipse([x - 30, y - 30, x + 30, y + 30], fill=(255, 255, 255, 70), outline=(255, 255, 255, 170), width=3)
    img.alpha_composite(o)
    return img

# The racket spin as animation frames: the serve page, a tap on "Random", a tap on "Spin", the spin
# and the result, then it starts over.
def serve_spin(k=0.8):
    rec = subprocess.run(['node', '--import', './test/mock/setup.mjs', 'tools/serve_spin.mjs'], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    out, ms = [], []
    for f in json.loads(rec.stdout):
        screen = draw_screen(f['widgets'])
        out.append(watch(screen, k))
        ms.append(f['ms'])
        if f['tap']:
            out.append(watch(tap(screen, *f['tap']), k))
            ms.append(260)
    return out, ms

if __name__ == '__main__':
    os.makedirs(os.path.join(IMAGES, 'watch'), exist_ok=True)
    banner().save(os.path.join(IMAGES, 'banner.png'), optimize=True)
    for n in ('start', 'serve', 'match', 'options'):
        watch(Image.open(os.path.join(SHOTS, f'{n}.png'))).save(os.path.join(IMAGES, 'watch', f'{n}.png'), optimize=True)
    frames, ms = serve_spin()
    # WebP: a tenth of the size of an animated PNG, with smooth (alpha) edges unlike a GIF
    frames[0].save(os.path.join(IMAGES, 'watch', 'serve-spin.webp'), save_all=True, append_images=frames[1:],
                   duration=ms, loop=0, quality=90, method=6)
