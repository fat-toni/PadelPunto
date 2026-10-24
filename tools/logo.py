# Draws the Padel Punto logo (racket + ball) at 4x and downsamples for smooth edges.
# Usage: python3 tools/logo.py assets/default.s [preview.png]  (writes icon.png and img/: logo, logo_small,
# racket, clock, clock_press, cone, cone_press and ball)
import math
import os
import sys
from PIL import Image, ImageDraw

# Outline of a diamond-shaped padel racket: round top, widest high up at
# the "shoulders", nearly straight sides down to a narrow tip where the neck starts.
# Right half from the top down, in the 560 grid; mirrored and smoothed (Catmull-Rom).
SHAPE = [(280, 22), (342, 30), (392, 55), (418, 92), (422, 122), (412, 168), (390, 222), (360, 278),
         (330, 330), (312, 362)]

def outline(shrink=0.0, n=8):
    right = [(280 + (x - 280) * (1 - shrink), 190 + (y - 190) * (1 - shrink)) for x, y in SHAPE]
    pts = right + [(560 - x, y) for x, y in reversed(right[1:])]
    out = []
    for i in range(len(pts)):
        p0, p1, p2, p3 = (pts[(i + k) % len(pts)] for k in (-1, 0, 1, 2))
        for j in range(n):
            t = j / n
            out.append(tuple(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t
                                    + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t ** 3) for c in (0, 1)))
    return out

def racket_layer(S, angle=30):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = S / 560
    def P(*pts): return [(x * u, y * u) for x, y in pts]
    rim, face, hole, grip, lime = (240, 243, 245, 255), (35, 39, 44, 255), (10, 12, 14, 255), (240, 243, 245, 255), (212, 245, 60, 255)
    clear = (0, 0, 0, 0)
    # frame, neck and the dark face; the face ends above the heart in a V
    d.polygon(P(*outline()), fill=rim)
    d.rectangle(P((262, 350), (298, 400)), fill=rim)
    inner = outline(0.09)
    face_pts = [(x, min(y, 300 - 0.35 * abs(x - 280))) for x, y in inner]
    d.polygon(P(*face_pts), fill=face)
    # the heart: two triangular openings below the face
    d.polygon(P((240, 304), (273, 316), (274, 354)), fill=clear)
    d.polygon(P((320, 304), (287, 316), (286, 354)), fill=clear)
    # holes in a staggered grid, only well inside the face
    inside = Image.new('L', (560, 560), 0)
    ImageDraw.Draw(inside).polygon([(x, min(y, 282 - 0.35 * abs(x - 280))) for x, y in outline(0.2)], fill=255)
    r = 9
    for row in range(-6, 6):
        for col in range(-5, 6):
            x = 280 + col * 34 + (17 if row % 2 else 0)
            y = 150 + row * 30
            if 0 <= x < 560 and 0 <= y < 560 and inside.getpixel((x, y)):
                d.ellipse(P((x - r, y - r), (x + r, y + r)), fill=hole)
    # handle with lime grip band and end cap
    d.rounded_rectangle(P((255, 395), (305, 530)), radius=14 * u, fill=grip)
    d.rectangle(P((255, 430), (305, 448)), fill=lime)
    d.rounded_rectangle(P((248, 516), (312, 540)), radius=10 * u, fill=lime)
    return img.rotate(angle, resample=Image.BICUBIC, center=(S * 0.5, S * 0.55))

def ball_layer(S, cx, cy, r):
    ball = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(ball)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(212, 245, 60, 255))
    w = max(2, round(r * 0.13))
    seam = (250, 252, 235, 255)
    # two seams curving in from opposite sides, clipped to the ball
    d.ellipse((cx - r * 2.1, cy - r * 0.9, cx - r * 0.35, cy + r * 0.9), outline=seam, width=w)
    d.ellipse((cx + r * 0.35, cy - r * 0.9, cx + r * 2.1, cy + r * 0.9), outline=seam, width=w)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(ball, (0, 0), mask)
    return out.rotate(-35, resample=Image.BICUBIC, center=(cx, cy))

def logo(size, bg=None):
    S = size * 4
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if bg:
        ImageDraw.Draw(base).ellipse((0, 0, S - 1, S - 1), fill=bg)
        inner = racket_layer(int(S * 0.86))
        base.alpha_composite(inner, (int(S * 0.04), int(S * 0.08)))
        base.alpha_composite(ball_layer(S, int(S * 0.7), int(S * 0.3), int(S * 0.115)))
    else:
        big = racket_layer(int(S * 1.12))
        base.alpha_composite(big, (-int(S * 0.1), -int(S * 0.06)))
        base.alpha_composite(ball_layer(S, int(S * 0.8), int(S * 0.2), int(S * 0.13)))
    return base.resize((size, size), Image.LANCZOS)

# The upright racket alone (head up) for the racket spin on page/serve, cut to its outline.
def racket(height):
    S = 2240
    img = racket_layer(S, angle=0)
    img = img.crop(img.getbbox())
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)

# The round clock button on the start screen (court time), in the colors of the "i" button
# (theme.js C.pill / C.tile, clock in C.muted), normal and pressed.
def clock_button(size, bg):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, S - 1, S - 1], fill=bg)
    c, r, w = S / 2, S * 0.27, max(2, round(S * 0.055))
    fg = (139, 147, 155, 255)
    d.ellipse([c - r, c - r, c + r, c + r], outline=fg, width=w)
    d.line([(c, c), (c, c - r * 0.62)], fill=fg, width=w)
    d.line([(c, c), (c + r * 0.48, c)], fill=fg, width=w)
    d.ellipse([c - w * 0.7, c - w * 0.7, c + w * 0.7, c + w * 0.7], fill=fg)
    return img.resize((size, size), Image.LANCZOS)

# The round training button on the start screen: a striped cone in the clock's colors.
def cone_button(size, bg):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, S - 1, S - 1], fill=bg)
    fg = (139, 147, 155, 255)
    c, top, base, hw, tw = S / 2, S * 0.22, S * 0.68, S * 0.20, S * 0.035
    d.polygon([(c - tw, top), (c + tw, top), (c + hw, base), (c - hw, base)], fill=fg)
    # the dark stripe across the middle, then the foot
    half = lambda y: tw + (hw - tw) * (y - top) / (base - top)
    y1, y2 = top + (base - top) * 0.42, top + (base - top) * 0.62
    d.polygon([(c - half(y1), y1), (c + half(y1), y1), (c + half(y2), y2), (c - half(y2), y2)], fill=bg)
    d.rounded_rectangle([c - S * 0.29, base, c + S * 0.29, base + S * 0.07], radius=S * 0.02, fill=fg)
    return img.resize((size, size), Image.LANCZOS)

# The ball alone, on the serving team's card in a training (page/match).
def ball(size):
    S = size * 4
    return ball_layer(S, S // 2, S // 2, S // 2 - 2).resize((size, size), Image.LANCZOS)

# (tools/readme_art.py imports logo() from here)
if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(f'{out}/img', exist_ok=True)
    logo(150).save(f'{out}/img/logo.png')
    logo(110).save(f'{out}/img/logo_small.png')  # start screen with "Weiter"
    logo(248, bg=(21, 24, 27, 255)).save(f'{out}/icon.png')
    racket(200).save(f'{out}/img/racket.png')
    clock_button(56, (28, 31, 34, 255)).save(f'{out}/img/clock.png')
    clock_button(56, (35, 39, 44, 255)).save(f'{out}/img/clock_press.png')
    cone_button(56, (28, 31, 34, 255)).save(f'{out}/img/cone.png')
    cone_button(56, (35, 39, 44, 255)).save(f'{out}/img/cone_press.png')
    ball(48).save(f'{out}/img/ball.png')
    if len(sys.argv) >= 3:
        # preview of both on black
        prev = Image.new('RGBA', (420, 260), (0, 0, 0, 255))
        prev.alpha_composite(logo(150), (20, 50))
        prev.alpha_composite(logo(248, bg=(21, 24, 27, 255)), (170, 6))
        prev.save(sys.argv[2])
