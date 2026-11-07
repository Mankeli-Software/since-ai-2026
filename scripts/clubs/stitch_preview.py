"""
Stitch master verification sheet showing all 5 Takomo 7-Iron models.
Saves to scripts/clubs/preview_check.png.
"""

import os
from PIL import Image, ImageDraw, ImageFont

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS = ["101-mkii", "201-mkii", "201t-mkii", "301-cb", "301-mb"]
MODEL_NAMES = ["Iron 101 MKII", "Iron 201 MKII", "Iron 201T MKII", "Iron 301 CB", "Iron 301 MB"]

# Width: 5 columns x 480 = 2400 px
# Height: 2 rows x 360 + 1 row (sole/address) 360 = 1080 px
GRID_W = 2400
GRID_H = 1080
grid = Image.new("RGB", (GRID_W, GRID_H), (18, 22, 26))
draw = ImageDraw.Draw(grid)

try:
    font_title = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 26)
    font_header = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 22)
    font_label = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 18)
except Exception:
    font_title = font_header = font_label = ImageFont.load_default()

# Row 1: Hero Rear View of each of the 5 models
col_w = 480
row_h = 360

for idx, (slug, name) in enumerate(zip(MODELS, MODEL_NAMES)):
    gx = idx * col_w
    gy = 0
    fpath = os.path.join(SCRIPTS_DIR, f"temp_back_{slug}.png")
    if os.path.exists(fpath):
        im = Image.open(fpath).resize((col_w, row_h), Image.Resampling.LANCZOS)
        grid.paste(im, (gx, gy))
        os.remove(fpath)
    # Header banner
    draw.rectangle([gx + 10, gy + 10, gx + col_w - 10, gy + 45], fill=(22, 26, 32))
    draw.text((gx + 20, gy + 14), f"REAR: {name}", fill=(240, 245, 250), font=font_header)

# Row 2: Strike Face View of each of the 5 models
for idx, (slug, name) in enumerate(zip(MODELS, MODEL_NAMES)):
    gx = idx * col_w
    gy = row_h
    fpath = os.path.join(SCRIPTS_DIR, f"temp_face_{slug}.png")
    if os.path.exists(fpath):
        im = Image.open(fpath).resize((col_w, row_h), Image.Resampling.LANCZOS)
        grid.paste(im, (gx, gy))
        os.remove(fpath)
    draw.rectangle([gx + 10, gy + 10, gx + col_w - 10, gy + 45], fill=(22, 26, 32))
    draw.text((gx + 20, gy + 14), f"FACE: {name}", fill=(240, 245, 250), font=font_header)

# Row 3: Sole, Address, Hosel Lie, AR Club previews
row3_items = [
    ("CAMBERED SOLE (Engraved '7' Stamp)", "temp_sole_101-mkii.png", 0),
    ("ADDRESS VIEW (Topline & Offset)", "temp_address_101-mkii.png", 1),
    ("HOSEL LIE VIEW (62.5° Angle)", "temp_hosel_101-mkii.png", 2),
    ("AR FULL 7-IRON (Head + Ferrule + Shaft + Grip)", "temp_ar_101-mkii.png", 3),
    ("TINKER-MODE PARTS (Ferrule, Shaft, Grip)", "temp_parts.png", 4),
]

for label, fname, cidx in row3_items:
    gx = cidx * col_w
    gy = row_h * 2
    fpath = os.path.join(SCRIPTS_DIR, fname)
    if os.path.exists(fpath):
        im = Image.open(fpath).resize((col_w, row_h), Image.Resampling.LANCZOS)
        grid.paste(im, (gx, gy))
        os.remove(fpath)
    draw.rectangle([gx + 10, gy + 10, gx + col_w - 10, gy + 45], fill=(22, 26, 32))
    draw.text((gx + 18, gy + 14), label, fill=(240, 245, 250), font=font_label)

out_path = os.path.join(SCRIPTS_DIR, "preview_check.png")
grid.save(out_path, optimize=True)
print(f"Saved master verification preview: {out_path} ({os.path.getsize(out_path)} bytes)")
