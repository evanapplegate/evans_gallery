#!/usr/bin/env python3
"""
Build WebP grid thumbnails for everything listed in fallback.json, then write
their sizes back into fallback.json so the gallery can set width/height/srcset.

  thumbs/400/<name>.webp   400 wide (or the source width, if narrower)
  thumbs/600/<name>.webp   only when the source is wider than the 400 slot
  thumbs/800/<name>.webp   only when the source is wider than the 600 slot

Images are converted to sRGB first (some sources are Adobe RGB / Display P3).
Videos use their first frame. GIFs are skipped so the grid keeps animating them. Thumbs newer than their source are skipped, and
thumbs for files no longer listed are removed.

Usage: python3 scripts/build_thumbs.py   (from anywhere)
"""
import io
import json
import os
import subprocess
import sys

from PIL import Image, ImageCms

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'images')
DEST = os.path.join(ROOT, 'thumbs')
MANIFEST = os.path.join(ROOT, 'fallback.json')
SLOTS = [400, 600, 800]
QUALITY = 80
VIDEO_EXT = ('.mp4', '.mov')

SRGB = ImageCms.createProfile('sRGB')


def load_source(path):
    if path.lower().endswith(VIDEO_EXT):
        png = subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path,
             '-frames:v', '1', '-vf', 'scale=in_color_matrix=auto:in_range=auto,format=rgb24',
             '-f', 'image2pipe', '-c:v', 'png', '-'],
            check=True, capture_output=True).stdout
        return Image.open(io.BytesIO(png)).convert('RGB')

    img = Image.open(path)
    icc = img.info.get('icc_profile')
    if img.mode not in ('RGB', 'RGBA', 'L'):
        img = img.convert('RGB')
    if icc:
        try:
            img = ImageCms.profileToProfile(
                img, ImageCms.ImageCmsProfile(io.BytesIO(icc)), SRGB,
                renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC, outputMode='RGB')
        except ImageCms.PyCMSError as e:
            print(f'  warning: ICC convert failed for {os.path.basename(path)}: {e}', file=sys.stderr)
    return img.convert('RGB')


def slot_widths(src_w):
    """Real pixel width for each slot that gets a file."""
    widths = []
    for slot in SLOTS:
        if widths and widths[-1] >= src_w:
            break
        widths.append(min(slot, src_w))
    return widths


def build(name):
    src = os.path.join(SRC, name)
    base = os.path.splitext(name)[0] + '.webp'
    first = os.path.join(DEST, str(SLOTS[0]), base)
    src_mtime = os.path.getmtime(src)

    if os.path.exists(first) and os.path.getmtime(first) >= src_mtime:
        widths, h = [], 0
        for slot in SLOTS:
            p = os.path.join(DEST, str(slot), base)
            if not os.path.exists(p):
                break
            with Image.open(p) as t:
                widths.append(t.width)
                h = t.height
        return {'w': widths, 'h': h}, False

    img = load_source(src)
    widths = slot_widths(img.width)
    h = 0
    for slot, w in zip(SLOTS, widths):
        h = round(img.height * w / img.width)
        out = img if w == img.width else img.resize((w, h), Image.LANCZOS)
        out.save(os.path.join(DEST, str(slot), base), 'WEBP', quality=QUALITY, method=6)
    for slot in SLOTS[len(widths):]:
        stale = os.path.join(DEST, str(slot), base)
        if os.path.exists(stale):
            os.remove(stale)
    return {'w': widths, 'h': h}, True


def main():
    for slot in SLOTS:
        os.makedirs(os.path.join(DEST, str(slot)), exist_ok=True)

    with open(MANIFEST) as f:
        files = json.load(f)['files']

    thumbs, made = {}, 0
    for name in files:
        if name.lower().endswith('.gif'):
            continue
        if not os.path.exists(os.path.join(SRC, name)):
            print(f'  missing source: {name}', file=sys.stderr)
            continue
        thumbs[name], built = build(name)
        if built:
            made += 1
            print(f'  thumb: {name} {thumbs[name]["w"]}')

    keep = {os.path.splitext(n)[0] + '.webp' for n in thumbs}
    for slot in SLOTS:
        d = os.path.join(DEST, str(slot))
        for f in os.listdir(d):
            if f.endswith('.webp') and f not in keep:
                os.remove(os.path.join(d, f))
                print(f'  removed orphan: {slot}/{f}')

    with open(MANIFEST, 'w') as f:
        f.write('{"files":[\n')
        f.write(',\n'.join(json.dumps(n) for n in files))
        f.write('\n],\n"thumbs":{\n')
        f.write(',\n'.join(f'{json.dumps(n)}:{json.dumps(t, separators=(",", ":"))}'
                           for n, t in thumbs.items()))
        f.write('\n}}\n')

    print(f'Built {made} thumbs, {len(thumbs)} listed.')


if __name__ == '__main__':
    main()
