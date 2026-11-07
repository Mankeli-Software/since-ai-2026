#!/usr/bin/env python3
"""
scripts/clubs/prepare_assets.py
Deterministic asset processing for Takomo Golf irons suite.
Reads verified reference images from scripts/clubs/ref_images/<slug>/
and generates:
  - hero_back.webp (kept intact / regenerated identically)
  - photo_bag.webp (1200x1500 RGBA, normalized physical scale & hosel-aligned)
  - photo_upright.webp (1200x1500 RGBA, playing orientation at ~62° lie angle, sole horizontal)
  - ref_face.webp (1200x900 4:3 detail card)
  - ref_address.webp (1200x900 4:3 detail card)
  - ref_sole_or_toe.webp (1200x900 4:3 detail card)
  - ref_field.webp (1200x900 4:3 detail card)
  - assets/clubs/images/comparison_strip_photos.png
  - assets/clubs/qa/real_photos_row.png
"""

import os
import cv2
import numpy as np

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SLUGS = ['101-mkii', '201-mkii', '201t-mkii', '301-cb', '301-mb']

BLADE_LENGTHS_MM = {
    '101-mkii': 78.8,
    '201-mkii': 77.0,
    '201t-mkii': 74.8,
    '301-cb': 71.0,
    '301-mb': 71.0
}

LIE_ANGLES_DEG = {
    '101-mkii': 62.5,
    '201-mkii': 62.0,
    '201t-mkii': 62.5,
    '301-cb': 62.5,
    '301-mb': 62.5
}

# Target scale in pixels per mm for 1200x1500 canvas
# 78.8 mm * 10.406 = ~820 px blade width, leaving ~160 px left margin and ~220 px right margin
TARGET_PX_PER_MM = 10.406
X_HOSEL_TARGET = 960
TARGET_CENTER_Y = 560

def make_dirs():
    for slug in SLUGS:
        os.makedirs(os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', slug), exist_ok=True)
    os.makedirs(os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa'), exist_ok=True)

def crop_transparent(img, pad=25):
    """Crop transparent 4-channel image to tightly fitted bounding box with padding."""
    if len(img.shape) < 3 or img.shape[2] != 4:
        raise ValueError(f"Image must have 4 channels (RGBA/BGRA), got shape {img.shape}")
    alpha = img[:, :, 3]
    coords = cv2.findNonZero((alpha > 15).astype(np.uint8))
    if coords is None:
        return img
    x, y, bw, bh = cv2.boundingRect(coords)
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(img.shape[1], x + bw + pad)
    y1 = min(img.shape[0], y + bh + pad)
    return img[y0:y1, x0:x1]

def ensure_hero_back():
    """Ensure hero_back.webp is present and kept intact."""
    for slug in SLUGS:
        dst_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', slug, 'hero_back.webp')
        if os.path.exists(dst_path):
            continue
        src_path = os.path.join(PROJECT_ROOT, 'scripts', 'clubs', 'ref_images', slug, 'back_studio.png')
        if not os.path.exists(src_path):
            continue
        img = cv2.imread(src_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            continue
        cropped = crop_transparent(img, pad=25)
        cv2.imwrite(dst_path, cropped, [cv2.IMWRITE_WEBP_QUALITY, 95])
        print(f"Generated hero_back.webp for {slug}")

def generate_normalized_bag_and_upright():
    """Generate normalized photo_bag.webp and photo_upright.webp across all 5 clubs."""
    bag_images = {}
    upright_images = {}

    for slug in SLUGS:
        src_path = os.path.join(PROJECT_ROOT, 'scripts', 'clubs', 'ref_images', slug, 'back_studio.png')
        if not os.path.exists(src_path):
            print(f"ERROR: missing {src_path}")
            continue

        raw = cv2.imread(src_path, cv2.IMREAD_UNCHANGED)
        if raw is None:
            print(f"ERROR: cannot read {src_path}")
            continue

        # For 301-mb, the original studio shot is rotated by ~17.46 deg.
        # Rotate back so hosel is perfectly vertical (pointing straight down).
        if slug == '301-mb':
            h, w = raw.shape[:2]
            diag = int(np.ceil(np.sqrt(w*w + h*h)))
            canvas = np.zeros((diag, diag, 4), dtype=np.uint8)
            ox = (diag - w) // 2
            oy = (diag - h) // 2
            canvas[oy:oy+h, ox:ox+w] = raw
            M = cv2.getRotationMatrix2D((diag/2, diag/2), 17.46, 1.0)
            img = cv2.warpAffine(canvas, M, (diag, diag), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))
            
            # Subtle color balance to match cool neutral satin chrome
            b, g, r, a = cv2.split(img)
            mask = a > 20
            r_adj = np.clip(r.astype(np.float32) * 0.94, 0, 255).astype(np.uint8)
            g_adj = np.clip(g.astype(np.float32) * 0.97, 0, 255).astype(np.uint8)
            b_adj = np.clip(b.astype(np.float32) * 1.01, 0, 255).astype(np.uint8)
            r = np.where(mask, r_adj, r)
            g = np.where(mask, g_adj, g)
            b = np.where(mask, b_adj, b)
            img = cv2.merge([b, g, r, a])
        else:
            img = raw.copy()

        # Measure raw blade pixel length from hosel axis to toe tip
        alpha = img[:, :, 3]
        pts = np.argwhere(alpha > 128)
        y_max = np.max(pts[:, 0])
        hosel_xs = pts[pts[:, 0] == y_max - 50, 1]
        hosel_x = np.mean(hosel_xs)
        min_x = np.min(pts[:, 1])
        raw_blade_px = hosel_x - min_x

        # Calculate exact scale factor
        target_blade_px = BLADE_LENGTHS_MM[slug] * TARGET_PX_PER_MM
        scale = target_blade_px / raw_blade_px

        scaled_w = int(round(img.shape[1] * scale))
        scaled_h = int(round(img.shape[0] * scale))
        scaled = cv2.resize(img, (scaled_w, scaled_h), interpolation=cv2.INTER_LANCZOS4)

        # Detect scaled features
        sc_alpha = scaled[:, :, 3]
        sc_pts = np.argwhere(sc_alpha > 128)
        sc_ymax = np.max(sc_pts[:, 0])
        sc_min_x = np.min(sc_pts[:, 1])
        sc_hosel_xs = sc_pts[sc_pts[:, 0] == sc_ymax - int(50 * scale), 1]
        sc_hosel_x = np.mean(sc_hosel_xs)

        # Pure blade region: from toe to 60% towards hosel (strictly excludes hosel and shaft)
        blade_limit_x = sc_min_x + 0.60 * (sc_hosel_x - sc_min_x)
        blade_pts = sc_pts[sc_pts[:, 1] < blade_limit_x]
        b_min_y = np.min(blade_pts[:, 0])
        b_max_y = np.max(blade_pts[:, 0])
        head_center_y = (b_min_y + b_max_y) / 2.0

        # Construct normalized 1200x1500 canvas for photo_bag.webp
        bag_canvas = np.zeros((1500, 1200, 4), dtype=np.uint8)
        dst_x = int(round(X_HOSEL_TARGET - sc_hosel_x))
        dst_y = int(round(TARGET_CENTER_Y - head_center_y))

        src_x0 = max(0, -dst_x)
        src_y0 = max(0, -dst_y)
        src_x1 = min(scaled_w, 1200 - dst_x)
        src_y1 = min(scaled_h, 1500 - dst_y)

        cdst_x0 = max(0, dst_x)
        cdst_y0 = max(0, dst_y)
        cdst_x1 = cdst_x0 + (src_x1 - src_x0)
        cdst_y1 = cdst_y0 + (src_y1 - src_y0)

        bag_canvas[cdst_y0:cdst_y1, cdst_x0:cdst_x1] = scaled[src_y0:src_y1, src_x0:src_x1]

        # Save photo_bag.webp
        bag_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', slug, 'photo_bag.webp')
        cv2.imwrite(bag_path, bag_canvas, [cv2.IMWRITE_WEBP_QUALITY, 95])
        bag_images[slug] = bag_canvas
        print(f"Generated {bag_path} (1200x1500, {os.path.getsize(bag_path):,} bytes)")

        # Generate photo_upright.webp
        # Rotate playing orientation: hosel points up-left at lie angle
        lie_deg = LIE_ANGLES_DEG[slug]
        rot_angle = 180.0 + (90.0 - lie_deg)  # ~207.5 deg
        M_rot = cv2.getRotationMatrix2D((600, 750), rot_angle, 1.0)
        upright_rot = cv2.warpAffine(bag_canvas, M_rot, (1200, 1500), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))

        # Position cleanly inside 1200x1500 canvas
        up_alpha = upright_rot[:, :, 3]
        up_coords = cv2.findNonZero((up_alpha > 15).astype(np.uint8))
        ux, uy, ubw, ubh = cv2.boundingRect(up_coords)

        # Shift sole baseline to Y = 1140, center X shifted slightly right to leave room for shaft tip
        target_bottom_y = 1140
        shift_y = int(round(target_bottom_y - (uy + ubh)))
        shift_x = int(round(50 - ux)) if ux < 50 else 0  # ensure shaft tip doesn't clip left edge
        if shift_x == 0:
            target_cx = 600
            shift_x = int(round(target_cx - (ux + ubw / 2.0)))
            if ux + shift_x < 40:
                shift_x = 40 - ux

        M_shift = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
        upright_canvas = cv2.warpAffine(upright_rot, M_shift, (1200, 1500), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0,0))

        upright_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', slug, 'photo_upright.webp')
        cv2.imwrite(upright_path, upright_canvas, [cv2.IMWRITE_WEBP_QUALITY, 95])
        upright_images[slug] = upright_canvas
        print(f"Generated {upright_path} (1200x1500, {os.path.getsize(upright_path):,} bytes)")

    # Build side-by-side comparison strips
    bag_strip_tiles = []
    upright_strip_tiles = []
    for slug in SLUGS:
        bag_strip_tiles.append(cv2.resize(bag_images[slug], (600, 750), interpolation=cv2.INTER_AREA))
        upright_strip_tiles.append(cv2.resize(upright_images[slug], (600, 750), interpolation=cv2.INTER_AREA))

    bag_strip = np.hstack(bag_strip_tiles)
    upright_strip = np.hstack(upright_strip_tiles)

    # Save comparison strips
    p_comp = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', 'comparison_strip_photos.png')
    p_qa_row = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa', 'real_photos_row.png')
    p_qa_up = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa', 'real_photos_upright_row.png')

    cv2.imwrite(p_comp, bag_strip)
    cv2.imwrite(p_qa_row, bag_strip)
    cv2.imwrite(p_qa_up, upright_strip)
    print(f"Saved comparison strips to {p_comp} and {p_qa_row}")

def crop_card(img, target_w=1200, target_h=900, cx_bias=0.5, cy_bias=0.5):
    """Crop 4:3 1200x900 card centered around feature point."""
    h, w = img.shape[:2]
    target_aspect = target_w / target_h
    current_aspect = w / h

    if current_aspect > target_aspect:
        new_w = int(h * target_aspect)
        new_h = h
    else:
        new_w = w
        new_h = int(w / target_aspect)

    cx = int(w * cx_bias)
    cy = int(h * cy_bias)

    x0 = max(0, min(w - new_w, cx - new_w // 2))
    y0 = max(0, min(h - new_h, cy - new_h // 2))

    crop = img[y0:y0+new_h, x0:x0+new_w]
    return cv2.resize(crop, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

def generate_detail_cards():
    """Generate cropped, color-balanced 1200x900 detail cards."""
    card_specs = {
        '101-mkii': {
            'ref_address.webp': ('address_7i.jpg', 0.50, 0.45),
            'ref_face.webp': ('face.jpg', 0.50, 0.50),
            'ref_sole_or_toe.webp': ('sole_7i.jpg', 0.50, 0.45),
            'ref_field.webp': ('back_field.jpg', 0.50, 0.50),
        },
        '201-mkii': {
            'ref_address.webp': ('address_7i_ball_golfalot.jpg', 0.55, 0.45),
            'ref_face.webp': ('face_gm.jpg', 0.50, 0.50),
            'ref_sole_or_toe.webp': ('toe_profile_gm.jpg', 0.50, 0.50),
            'ref_field.webp': ('hero_turf_golfalot.jpg', 0.50, 0.50),
        },
        '201t-mkii': {
            'ref_address.webp': ('address_7i.jpg', 0.50, 0.45),
            'ref_face.webp': ('face.jpg', 0.50, 0.50),
            'ref_sole_or_toe.webp': ('toe_profile.jpg', 0.50, 0.50),
            'ref_field.webp': ('back_field.jpg', 0.50, 0.50),
        },
        '301-cb': {
            'ref_address.webp': ('address_ball.jpg', 0.50, 0.50),
            'ref_face.webp': ('face.jpg', 0.50, 0.50),
            'ref_sole_or_toe.webp': ('hero_34.jpg', 0.50, 0.50),
            'ref_field.webp': ('back_field.jpg', 0.50, 0.50),
        },
        '301-mb': {
            'ref_address.webp': ('address_ball.jpg', 0.50, 0.50),
            'ref_face.webp': (os.path.join('..', '301-cb', 'face.jpg'), 0.50, 0.50),
            'ref_sole_or_toe.webp': ('bag_view.png', 0.45, 0.45),
            'ref_field.webp': ('compare_back_mb_cb.jpg', 0.50, 0.50),
        }
    }

    for slug, cards in card_specs.items():
        slug_ref_dir = os.path.join(PROJECT_ROOT, 'scripts', 'clubs', 'ref_images', slug)
        slug_out_dir = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', slug)

        for card_name, (src_rel, cx, cy) in cards.items():
            src_path = os.path.normpath(os.path.join(slug_ref_dir, src_rel))
            dst_path = os.path.join(slug_out_dir, card_name)

            if not os.path.exists(src_path):
                print(f"WARNING: detail source missing: {src_path}")
                continue

            img = cv2.imread(src_path, cv2.IMREAD_COLOR)
            if img is None:
                print(f"WARNING: cannot read {src_path}")
                continue

            cropped = crop_card(img, target_w=1200, target_h=900, cx_bias=cx, cy_bias=cy)
            cv2.imwrite(dst_path, cropped, [cv2.IMWRITE_WEBP_QUALITY, 92])
            print(f"Generated {dst_path} (1200x900, {os.path.getsize(dst_path):,} bytes)")

if __name__ == '__main__':
    make_dirs()
    ensure_hero_back()
    generate_normalized_bag_and_upright()
    generate_detail_cards()
    print("All image assets prepared successfully.")
