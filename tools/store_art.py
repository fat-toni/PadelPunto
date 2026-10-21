# Draws the pictures for the Zepp App Store listing (docs.zepp.com/docs/distribute/):
# - store/icon.png: 240x240, transparent background, the round icon without margin
# - store/screenshots/*.png: 360x360, transparent background; a rectangular screen keeps equal
#   margins left and right and none at the top and bottom
# from the app icon and the simulator screenshots in docs/images/screenshots (390x450).
# Usage: python3 tools/store_art.py
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
SHOTS = os.path.join(ROOT, 'docs', 'images', 'screenshots')
ICON = os.path.join(ROOT, 'assets', 'default.s', 'icon.png')
OUT = os.path.join(ROOT, 'store')
# store order: the match first, it shows best what the app does
ORDER = ['match', 'serve', 'start', 'options']
SIZE = 360
RADIUS = 58  # Bip 6 screen corners at 390x450, as in readme_art.py

def icon():
    img = Image.open(ICON).convert('RGBA')
    # the watch icon is 248x248 with a 4 px transparent margin; the store wants none
    box = img.getbbox()
    img = img.crop(box).resize((240, 240), Image.LANCZOS)
    img.save(os.path.join(OUT, 'icon.png'))

def screenshot(name, n):
    S = 4  # draw the corner mask large for smooth edges
    shot = Image.open(os.path.join(SHOTS, name + '.png')).convert('RGBA')
    sw, sh = shot.size
    ImageDraw.Draw(shot).rectangle([0, 0, sw - 1, sh - 1], outline=(0, 0, 0))  # simulator's 1 px frame
    mask = Image.new('L', (sw * S, sh * S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw * S - 1, sh * S - 1], radius=RADIUS * S, fill=255)
    shot.putalpha(mask.resize((sw, sh), Image.LANCZOS))
    w = round(sw * SIZE / sh)
    shot = shot.resize((w, SIZE), Image.LANCZOS)
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    img.paste(shot, ((SIZE - w) // 2, 0), shot)
    img.save(os.path.join(OUT, 'screenshots', f'{n}-{name}.png'))

if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'screenshots'), exist_ok=True)
    icon()
    for n, name in enumerate(ORDER, 1):
        screenshot(name, n)
    print('written to', os.path.normpath(OUT))
