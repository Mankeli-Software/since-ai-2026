"""
Procedural PBR texture map generator for Takomo Golf 7-Iron heads.
Generates high-resolution deterministic albedo, roughness, normal, and metallic maps for:
- 101-mkii
- 201-mkii
- 201t-mkii
- 301-cb
- 301-mb
"""

import os
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

MODELS = ["101-mkii", "201-mkii", "201t-mkii", "301-cb", "301-mb"]
TEX_SIZE = 2048
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")

FONT_SANS = "/System/Library/Fonts/HelveticaNeue.ttc"
if not os.path.exists(FONT_SANS):
    FONT_SANS = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

def get_font(size, index=1):
    try:
        return ImageFont.truetype(FONT_SANS, size, index=index)
    except Exception:
        try:
            return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
        except Exception:
            return ImageFont.load_default()

def create_flying_t_image(size=(140, 90), scale=1.0, fill=(12, 13, 15)):
    """
    Renders the Takomo flying-T geometric emblem into a standalone RGBA image.
    """
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, size[1] // 2
    
    pts = [
        (-50, -25),
        (12, -7),
        (52, 16),
        (16, 6),
        (-46, 25),
        (-14, 0),
    ]
    transformed_pts = [(cx + int(x * scale), cy + int(y * scale)) for (x, y) in pts]
    draw.polygon(transformed_pts, fill=fill + (255,))
    
    # Inner cutout to hollow chevron
    cutout = [
        (-34, -13),
        (2, -3),
        (-30, 13),
    ]
    transformed_cutout = [(cx + int(x * scale), cy + int(y * scale)) for (x, y) in cutout]
    draw.polygon(transformed_cutout, fill=(0, 0, 0, 0))
    return img

def create_circle_t_image(size=(140, 140), radius=48, fill=(12, 13, 15), width=6):
    """
    Renders the Takomo 301 forged circle-T monogram into a standalone RGBA image.
    """
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, size[1] // 2
    
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.ellipse(bbox, outline=fill + (255,), width=width)
    
    y_bar = cy - int(radius * 0.22)
    x_left = cx - int(radius * 0.78)
    x_right = cx + int(radius * 1.18)
    draw.line([(x_left, y_bar), (x_right, y_bar)], fill=fill + (255,), width=width)
    
    x_bot = cx - int(radius * 0.58)
    y_bot = cy + int(radius * 0.72)
    draw.line([(cx + int(radius * 0.28), y_bar), (x_bot, y_bot)], fill=fill + (255,), width=width)
    draw.line([(x_left + int(radius * 0.18), y_bar), (x_bot + int(radius * 0.22), cy)], fill=fill + (255,), width=width - 1)
    return img

def render_stamp_180(text_or_img, font=None, fill=(12, 13, 15), stroke_width=0):
    """
    Renders text or image rotated 180 degrees (upside down at address / upright in bag view).
    """
    if isinstance(text_or_img, str):
        # Render text into RGBA canvas, then rotate 180
        dummy = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        d_dummy = ImageDraw.Draw(dummy)
        bbox = d_dummy.textbbox((0, 0), text_or_img, font=font, stroke_width=stroke_width)
        tw = bbox[2] - bbox[0] + 40
        th = bbox[3] - bbox[1] + 30
        txt_img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        d_txt = ImageDraw.Draw(txt_img)
        d_txt.text((20, 15), text_or_img, font=font, fill=fill + (255,), stroke_width=stroke_width)
        return txt_img.rotate(180, expand=True)
    else:
        return text_or_img.rotate(180, expand=True)

def generate_textures_for_model(slug):
    print(f"Generating deterministic PBR textures for {slug}...")
    
    # Base steel properties (Satin brushed Scandinavian stainless steel)
    # Richer, deeper steel tone for authentic metallic realism
    albedo = np.full((TEX_SIZE, TEX_SIZE, 3), 198, dtype=np.uint8)
    albedo[:, :, 0] = 196
    albedo[:, :, 1] = 200
    albedo[:, :, 2] = 205
    
    roughness = np.full((TEX_SIZE, TEX_SIZE), 0.24, dtype=np.float32)
    metallic = np.full((TEX_SIZE, TEX_SIZE), 0.96, dtype=np.float32)
    height = np.zeros((TEX_SIZE, TEX_SIZE), dtype=np.float32)
    
    # Fine horizontal brushed metal grain
    np.random.seed(42)
    grain_1d = np.random.normal(0, 0.015, (TEX_SIZE, 1)).astype(np.float32)
    roughness += grain_1d * 0.5
    
    # =========================================================================
    # QUADRANT 1: CLUBFACE (U: [0.0, 0.5], V: [0.5, 1.0] -> Img: [0..1024, 0..1024])
    # =========================================================================
    fx0, fy0, fx1, fy1 = 160, 200, 880, 860
    
    # Fill sandblast impact rectangle with two-tone contrast
    albedo[fy0:fy1, fx0:fx1] = [170, 174, 180]
    roughness[fy0:fy1, fx0:fx1] = 0.46
    metallic[fy0:fy1, fx0:fx1] = 0.90
    
    # Sandblast micro-texture
    sand_noise = np.random.normal(0, 0.035, (fy1 - fy0, fx1 - fx0)).astype(np.float32)
    height[fy0:fy1, fx0:fx1] += sand_noise * 0.12
    roughness[fy0:fy1, fx0:fx1] += sand_noise * 0.35
    
    # Vertical demarcation lines at toe side
    demarc_x = fx0 + 15
    for dx in [demarc_x, demarc_x + 8]:
        albedo[fy0+40:fy1-40, dx-1:dx+2] = [140, 143, 146]
        height[fy0+40:fy1-40, dx-1:dx+2] -= 0.3
        roughness[fy0+40:fy1-40, dx-1:dx+2] = 0.35
        
    # 13 Horizontal Scorelines
    num_grooves = 13
    groove_start_y = fy1 - 65
    groove_pitch = 44
    groove_x0 = fx0 + 35
    groove_x1 = fx1 - 25
    groove_h = 7
    
    for i in range(num_grooves):
        gy = groove_start_y - i * groove_pitch
        gx0 = groove_x0
        gx1 = groove_x1
        if i >= 9:
            gx1 = groove_x1 - int((i - 8) * 35)
        if i >= 11:
            gx0 = groove_x0 + int((i - 10) * 45)
            
        if i == 0:
            # Bottom groove: crisp bright white alignment paint fill!
            albedo[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = [255, 255, 255]
            roughness[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = 0.25
            metallic[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = 0.02
            height[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = -0.55
        else:
            # Upper grooves: dark metallic relief
            albedo[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = [45, 48, 52]
            roughness[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = 0.20
            metallic[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = 0.90
            height[gy-groove_h//2:gy+groove_h//2+1, gx0:gx1] = -0.7
            height[gy-groove_h//2-1:gy-groove_h//2, gx0:gx1] = -0.3
            height[gy+groove_h//2:gy+groove_h//2+2, gx0:gx1] = -0.3

    # =========================================================================
    # QUADRANT 2: REAR CAVITY & MUSCLE (U: [0.5, 1.0], V: [0.5, 1.0] -> Img: [1024..2048, 0..1024])
    # =========================================================================
    bx0, by0, bx1, by1 = 1024, 0, 2048, 1024
    
    # Model-specific back cavity & muscle textures
    if slug == "101-mkii":
        pocket_y0 = 460
        pocket_y1 = 920
        pocket_x0 = bx0 + 60
        pocket_x1 = bx1 - 60
        
        # Matte bead-blasted recessed pocket
        albedo[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = [152, 156, 162]
        roughness[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = 0.50
        height[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = -0.45
        height[pocket_y0-6:pocket_y0, pocket_x0:pocket_x1] = -0.2

    elif slug in ["201-mkii", "201t-mkii"]:
        pocket_y0 = 140
        pocket_y1 = 500
        pocket_x0 = bx0 + 80
        pocket_x1 = bx1 - 80
        
        # Shallow matte upper pocket
        albedo[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = [156, 160, 166]
        roughness[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = 0.46
        height[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = -0.35
        height[pocket_y1:pocket_y1+20, pocket_x0:pocket_x1] = np.linspace(-0.35, 0.0, 20)[:, None]

    elif slug == "301-cb":
        pocket_y0 = 160
        pocket_y1 = 560
        pocket_x0 = bx0 + 70
        pocket_x1 = bx1 - 70
        
        # CNC cavity floor with rich matte blasted sheen
        albedo[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = [150, 154, 160]
        roughness[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = 0.44
        height[pocket_y0:pocket_y1, pocket_x0:pocket_x1] = -0.5
        
        # CNC toolpath micro-grooves
        y_coords = np.arange(pocket_y0, pocket_y1)
        cnc_wave = np.sin(y_coords * (2 * np.pi / 7.0)).astype(np.float32) * 0.08
        height[pocket_y0:pocket_y1, pocket_x0:pocket_x1] += cnc_wave[:, None]
        roughness[pocket_y0:pocket_y1, pocket_x0:pocket_x1] += cnc_wave[:, None] * 0.05
        roughness[560:1000, bx0:bx1] = 0.24

    elif slug == "301-mb":
        step_y0, step_y1 = 480, 530
        height[step_y0:step_y1, bx0:bx1] = np.linspace(-0.35, 0.0, step_y1 - step_y0)[:, None]
        roughness[step_y0:step_y1, bx0:bx1] = 0.28
        roughness[step_y1:1000, bx0:bx1] = 0.22

    # =========================================================================
    # QUADRANT 3: SOLE (U: [0.0, 0.5], V: [0.0, 0.5] -> Img: [0..1024, 1024..2048])
    # =========================================================================
    sx0, sy0, sx1, sy1 = 0, 1024, 1024, 2048
    roughness[sy0:sy1, sx0:sx1] = 0.25
    metallic[sy0:sy1, sx0:sx1] = 0.96

    # =========================================================================
    # QUADRANT 4: HOSEL & TOPLINE (U: [0.5, 1.0], V: [0.0, 0.5] -> Img: [1024..2048, 1024..2048])
    # =========================================================================
    hx0, hy0, hx1, hy1 = 1024, 1024, 2048, 2048
    roughness[hy0:hy1, hx0:hx1] = 0.23
    metallic[hy0:hy1, hx0:hx1] = 0.96

    # PIL canvas for stamping vector graphics and typography
    albedo_pil = Image.fromarray(albedo)
    draw_albedo = ImageDraw.Draw(albedo_pil)

    # Pure jet-black enamel color for authentic Scandinavian engraving
    JET_BLACK = (12, 13, 15)

    # 1. Sole "7" - centered across sole width near toe end
    font_sole = get_font(125)
    draw_albedo.text((640, sy0 + 440), "7", font=font_sole, fill=JET_BLACK)

    # 2. Hosel Markings
    font_hosel = get_font(62)
    hosel_text = "TAKOMO"
    char_spacing = 75
    start_y = hy0 + 160
    for idx, ch in enumerate(hosel_text):
        draw_albedo.text((hx0 + 500, start_y + idx * char_spacing), ch, font=font_hosel, fill=JET_BLACK)
        
    if slug in ["301-cb", "301-mb"]:
        font_forged = get_font(30)
        forged_str = "FORGED S20C"
        for idx, ch in enumerate(forged_str):
            draw_albedo.text((hx0 + 440, start_y + idx * 45), ch, font=font_forged, fill=JET_BLACK)

    # 3. Rear Cavity Badging & Model Stamps
    # All 5 Takomo models orient rear cavity stamps upside down at address (so right-side-up in bag view!).
    # Heel is on LEFT (X ~ 1250), Toe is on RIGHT (X ~ 1750).
    if slug == "101-mkii":
        # Flying-T on toe side (rotated 180)
        ft_img = create_flying_t_image(scale=1.5, fill=JET_BLACK)
        ft_rot = render_stamp_180(ft_img)
        albedo_pil.paste(ft_rot, (bx0 + 660, 240), ft_rot)
        
        # 101 MKII on heel side (rotated 180)
        font_model = get_font(68, index=1)
        txt_rot = render_stamp_180("101 MKII", font=font_model, fill=JET_BLACK, stroke_width=1)
        albedo_pil.paste(txt_rot, (bx0 + 190, 230), txt_rot)

    elif slug in ["201-mkii", "201t-mkii"]:
        # Flying-T on toe side (rotated 180)
        ft_img = create_flying_t_image(scale=1.4, fill=JET_BLACK)
        ft_rot = render_stamp_180(ft_img)
        albedo_pil.paste(ft_rot, (bx0 + 660, 270), ft_rot)
        
        model_str = "201 MKII" if slug == "201-mkii" else "201T MKII"
        font_model = get_font(64, index=1)
        txt_rot = render_stamp_180(model_str, font=font_model, fill=JET_BLACK, stroke_width=1)
        albedo_pil.paste(txt_rot, (bx0 + 190, 255), txt_rot)

    elif slug == "301-cb":
        # Circle-T monogram on toe side (rotated 180)
        ct_img = create_circle_t_image(radius=54, fill=JET_BLACK, width=7)
        ct_rot = render_stamp_180(ct_img)
        albedo_pil.paste(ct_rot, (bx0 + 660, 290), ct_rot)
        
        font_model = get_font(66, index=1)
        txt_rot = render_stamp_180("301 CB", font=font_model, fill=JET_BLACK, stroke_width=1)
        albedo_pil.paste(txt_rot, (bx0 + 190, 285), txt_rot)

    elif slug == "301-mb":
        # Circle-T monogram on toe side (rotated 180)
        ct_img = create_circle_t_image(radius=52, fill=JET_BLACK, width=7)
        ct_rot = render_stamp_180(ct_img)
        albedo_pil.paste(ct_rot, (bx0 + 660, 260), ct_rot)
        
        font_model = get_font(66, index=1)
        txt_rot = render_stamp_180("301 MB", font=font_model, fill=JET_BLACK, stroke_width=1)
        albedo_pil.paste(txt_rot, (bx0 + 190, 255), txt_rot)

    albedo_final = np.array(albedo_pil)

    # Black enamel mask (pixels with dark values)
    raw_engrave_mask = (albedo_final[:, :, 0] < 35) & (albedo_final[:, :, 1] < 35) & (albedo_final[:, :, 2] < 35)
    
    # Dilate mask by 1px so metallic specular glare never washes out the black lettering!
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    engrave_mask = cv2.dilate(raw_engrave_mask.astype(np.uint8), kernel).astype(bool)
    
    # Apply engraved depth, matte dielectric roughness, and zero metallic
    # Subtle indentation for stamped enamel so specular glare does not wash out the black color
    height[engrave_mask] -= 0.08
    roughness[engrave_mask] = 0.45
    metallic[engrave_mask] = 0.0

    # Compute Tangent-Space Normal Map using Sobel filter
    print(f"Synthesizing tangent-space normal map for {slug}...")
    height_smooth = cv2.GaussianBlur(height, (3, 3), 0.5)
    dx = cv2.Sobel(height_smooth, cv2.CV_32F, 1, 0, ksize=3) * 2.2
    dy = cv2.Sobel(height_smooth, cv2.CV_32F, 0, 1, ksize=3) * 2.2
    
    nx = -dx
    ny = dy
    nz = np.ones_like(height)
    
    length = np.sqrt(nx**2 + ny**2 + nz**2)
    nx /= length
    ny /= length
    nz /= length
    
    normal_map = np.stack([
        (nx * 0.5 + 0.5) * 255,
        (ny * 0.5 + 0.5) * 255,
        (nz * 0.5 + 0.5) * 255
    ], axis=-1).astype(np.uint8)
    
    roughness_8bit = (np.clip(roughness, 0.0, 1.0) * 255).astype(np.uint8)
    metallic_8bit = (np.clip(metallic, 0.0, 1.0) * 255).astype(np.uint8)
    
    model_dir = os.path.join(OUTPUT_DIR, slug)
    os.makedirs(model_dir, exist_ok=True)
    
    Image.fromarray(albedo_final).save(os.path.join(model_dir, "albedo.png"), optimize=True)
    Image.fromarray(roughness_8bit).save(os.path.join(model_dir, "roughness.png"), optimize=True)
    Image.fromarray(normal_map).save(os.path.join(model_dir, "normal.png"), optimize=True)
    Image.fromarray(metallic_8bit).save(os.path.join(model_dir, "metallic.png"), optimize=True)
    print(f"Saved PBR maps to {model_dir}/")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for slug in MODELS:
        generate_textures_for_model(slug)
    print("All PBR textures generated successfully!")

if __name__ == "__main__":
    main()
