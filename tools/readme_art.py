# Draws the pictures for the GitHub README from the simulator screenshots in docs/images/screenshots:
# the banner (also used as the repo's social preview) and each screen in a Bip 6 watch frame.
# The racket spin (docs/images/watch/serve-spin.webp, animated) is drawn from the widgets
# that tools/serve_spin.mjs records on the simulated watch, in Roboto like the simulator's font
# (downloaded once into ~/.cache/padelpunto).
# Usage: python3 tools/readme_art.py   (writes docs/images/banner.png and docs/images/watch/*.png)
import json
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
    img.alpha_composite(shine)
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
    img.alpha_composite(logo(132), (x - 10, 78))
    d.text((x, 222), 'Padel Punto', font=font(96), fill=WHITE)
    d.text((x, 340), 'No more “wait,', font=font(46, 'Medium'), fill=BALL)
    d.text((x, 394), 'what’s the score?”', font=font(46, 'Medium'), fill=BALL)
    d.text((x, 470), 'Padel score counter for the Amazfit Bip 6', font=font(26, 'Regular'), fill=MUTED)
    # pills
    px, py, f = x, 524, font(22, 'Medium')
    for t in ('Golden Point', 'Score calls', 'Court timer', 'EN · DE · ES'):
        tw = d.textlength(t, font=f)
        d.rounded_rectangle([px, py, px + tw + 36, py + 42], radius=21, fill=(35, 39, 44), outline=(52, 57, 63), width=2)
        d.text((px + 18, py + 21), t, font=f, fill=WHITE, anchor='lm')
        px += tw + 50

    shot = lambda n: Image.open(os.path.join(SHOTS, f'{n}.png'))
    place(img, watch(shot('start'), 0.64), 700, 96, angle=9)
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
