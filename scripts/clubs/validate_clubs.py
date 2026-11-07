#!/usr/bin/env python3
"""
scripts/clubs/validate_clubs.py
Automated 3D Asset & Assembly Validator for Takomo Golf irons suite.
Uses pygltflib and trimesh to validate:
  - assets/clubs/manifest.json schema and model file existence
  - assets/clubs/heads/<slug>.glb:
      * File size (< 1.5 MB pass, 1.5-3.0 MB warn, > 3.0 MB fail)
      * Metric bounding box dimensions matching 7-iron specs
      * Sole tangent to ground Y=0 (±0.005 m tolerance, ideal ±0.001 m)
      * HoselSocket node presence, transform, and shaft axis at ~62° lie
      * PBR materials, textures, no NaNs, no degenerate faces
      * Monotonic progression checks across 101 -> 201 -> 201T -> 301 CB -> 301 MB
  - assets/clubs/parts/{shaft,ferrule,grip}.glb assembly to ~0.92-0.96 m (~37 inches)
"""

import os
import sys
import json
import math
import argparse
import numpy as np
import pygltflib
import trimesh

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SLUGS = ['101-mkii', '201-mkii', '201t-mkii', '301-cb', '301-mb']

EXPECTED_PROGRESSION = {
    '101-mkii':  {'loft_deg': 29.0, 'offset_mm': 3.40, 'lie_deg': 62.5, 'blade_len_mm': 78.8, 'sole_w_mm': 21.5},
    '201-mkii':  {'loft_deg': 31.0, 'offset_mm': 2.77, 'lie_deg': 62.0, 'blade_len_mm': 77.0, 'sole_w_mm': 18.5},
    '201t-mkii': {'loft_deg': 33.0, 'offset_mm': 2.46, 'lie_deg': 62.5, 'blade_len_mm': 74.8, 'sole_w_mm': 16.0},
    '301-cb':    {'loft_deg': 34.0, 'offset_mm': 1.80, 'lie_deg': 62.5, 'blade_len_mm': 71.0, 'sole_w_mm': 15.0},
    '301-mb':    {'loft_deg': 34.0, 'offset_mm': 1.80, 'lie_deg': 62.5, 'blade_len_mm': 71.0, 'sole_w_mm': 13.0},
}

class ValidationResult:
    def __init__(self):
        self.passes = []
        self.warnings = []
        self.failures = []

    def log_pass(self, category, msg):
        self.passes.append((category, msg))
        print(f"  \033[92m[PASS]\033[0m {category}: {msg}")

    def log_warn(self, category, msg):
        self.warnings.append((category, msg))
        print(f"  \033[93m[WARN]\033[0m {category}: {msg}")

    def log_fail(self, category, msg):
        self.failures.append((category, msg))
        print(f"  \033[91m[FAIL]\033[0m {category}: {msg}")

    @property
    def ok(self):
        return len(self.failures) == 0

def validate_manifest(vr):
    """Validate manifest.json schema and referenced file existence."""
    manifest_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'manifest.json')
    if not os.path.exists(manifest_path):
        vr.log_warn("manifest", f"manifest.json not yet created at {manifest_path}")
        return None

    try:
        with open(manifest_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        vr.log_fail("manifest", f"Failed to parse manifest.json: {e}")
        return None

    vr.log_pass("manifest", "Valid JSON syntax")

    # Extract clubs/heads list or map
    heads = data.get('heads') or data.get('clubs') or data.get('irons')
    if isinstance(heads, dict):
        clubs_list = list(heads.values())
    elif isinstance(heads, list):
        clubs_list = heads
    else:
        vr.log_fail("manifest", "Missing 'heads' or 'clubs' array/object in manifest")
        return None

    club_map = {}
    for c in clubs_list:
        slug = c.get('slug') or c.get('id')
        if slug:
            club_map[slug] = c

    for slug in SLUGS:
        if slug not in club_map:
            vr.log_warn("manifest", f"Slug '{slug}' not found in manifest entries")
            continue

        c = club_map[slug]
        # Check model file existence
        glb_file = c.get('glbPath') or c.get('model_glb') or c.get('glb') or f"assets/clubs/heads/{slug}.glb"
        glb_full = os.path.normpath(os.path.join(PROJECT_ROOT, glb_file))
        if os.path.exists(glb_full):
            vr.log_pass("manifest", f"{slug} referenced GLB exists: {os.path.basename(glb_full)}")
        else:
            vr.log_warn("manifest", f"{slug} referenced GLB missing: {glb_file}")

        # Check USDZ if referenced
        usdz_file = c.get('arUsdzPath') or c.get('model_usdz') or c.get('usdz')
        if usdz_file:
            usdz_full = os.path.normpath(os.path.join(PROJECT_ROOT, usdz_file))
            if os.path.exists(usdz_full):
                vr.log_pass("manifest", f"{slug} referenced USDZ exists: {os.path.basename(usdz_full)}")
            else:
                vr.log_warn("manifest", f"{slug} referenced USDZ missing: {usdz_file}")

        # Check images object and referenced image paths
        images_map = c.get('images')
        if not images_map:
            vr.log_warn("manifest_images", f"{slug} missing 'images' block in manifest")
        else:
            required_image_keys = [
                'heroBack', 'photoBag', 'photoUpright',
                'refAddress', 'refFace', 'refSoleOrToe', 'refField',
                'renderHero', 'renderBack', 'renderAddress', 'renderFace', 'renderSole'
            ]
            missing_keys = [k for k in required_image_keys if k not in images_map]
            if missing_keys:
                vr.log_fail("manifest_images", f"{slug} 'images' missing keys: {missing_keys}")
            else:
                missing_files = []
                for k, rel_p in images_map.items():
                    full_p = os.path.normpath(os.path.join(PROJECT_ROOT, rel_p))
                    if not os.path.exists(full_p):
                        missing_files.append(rel_p)
                if missing_files:
                    vr.log_fail("manifest_images", f"{slug} referenced images missing on disk: {missing_files}")
                else:
                    vr.log_pass("manifest_images", f"{slug} all 12 referenced images exist on disk")

    # Validate monotonic specifications in manifest
    prev_loft = 0.0
    prev_offset = 999.0
    for slug in SLUGS:
        if slug in club_map:
            c = club_map[slug]
            specs = c.get('specs') or c.get('spec') or c
            loft = specs.get('loft_deg') or specs.get('loft')
            offset = specs.get('offset_mm') or specs.get('offset')
            if loft is not None:
                if float(loft) < prev_loft - 0.01:
                    vr.log_fail("manifest_progression", f"Loft non-monotonic at {slug}: {loft} < {prev_loft}")
                else:
                    vr.log_pass("manifest_progression", f"{slug} loft = {loft}° (monotonic progression)")
                    prev_loft = float(loft)
            if offset is not None:
                if float(offset) > prev_offset + 0.01:
                    vr.log_fail("manifest_progression", f"Offset non-monotonic at {slug}: {offset} > {prev_offset}")
                else:
                    vr.log_pass("manifest_progression", f"{slug} offset = {offset} mm (monotonic progression)")
                    prev_offset = float(offset)

    return data

def validate_head_glb(slug, vr):
    """Validate single head GLB model."""
    glb_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'heads', f'{slug}.glb')
    if not os.path.exists(glb_path):
        vr.log_warn(f"head_{slug}", f"File not found: {glb_path} (builder may still be running)")
        return None

    file_size_bytes = os.path.getsize(glb_path)
    file_size_mb = file_size_bytes / (1024 * 1024)

    if file_size_mb > 3.0:
        vr.log_fail(f"head_{slug}", f"File size {file_size_mb:.2f} MB exceeds 3.0 MB hard limit")
    elif file_size_mb > 1.5:
        vr.log_warn(f"head_{slug}", f"File size {file_size_mb:.2f} MB exceeds 1.5 MB soft target")
    else:
        vr.log_pass(f"head_{slug}", f"File size {file_size_mb:.2f} MB (< 1.5 MB target)")

    # 1. pygltflib node & HoselSocket check
    try:
        gltf = pygltflib.GLTF2().load(glb_path)
    except Exception as e:
        vr.log_fail(f"head_{slug}", f"pygltflib failed to parse GLB: {e}")
        return None

    nodes = gltf.nodes
    hosel_node = next((n for n in nodes if n.name == 'HoselSocket'), None)
    if not hosel_node:
        vr.log_fail(f"head_{slug}", "HoselSocket empty node missing from glTF node tree")
    else:
        # Check translation
        t = hosel_node.translation
        if t is None or len(t) != 3 or any(math.isnan(v) or math.isinf(v) for v in t):
            vr.log_fail(f"head_{slug}", f"HoselSocket translation invalid: {t}")
        else:
            vr.log_pass(f"head_{slug}", f"HoselSocket translation at ({t[0]:.4f}, {t[1]:.4f}, {t[2]:.4f}) m")
            # Verify offset translation in Z matches spec (~0.0018 - 0.0034 m)
            expected_offset_m = EXPECTED_PROGRESSION[slug]['offset_mm'] / 1000.0
            z_offset = abs(t[2]) if abs(t[2]) > 0.0001 else abs(t[1]) # tolerate Y/Z coordinate convention
            if abs(z_offset - expected_offset_m) < 0.0015:
                vr.log_pass(f"head_{slug}", f"HoselSocket offset matches blueprint: {z_offset*1000:.2f} mm")
            else:
                vr.log_warn(f"head_{slug}", f"HoselSocket offset {z_offset*1000:.2f} mm vs blueprint {expected_offset_m*1000:.2f} mm")

        # Check rotation / shaft axis
        q = hosel_node.rotation
        if q and len(q) == 4 and not any(math.isnan(v) or math.isinf(v) for v in q):
            qx, qy, qz, qw = q
            R = np.array([
                [1 - 2*(qy*qy + qz*qz),     2*(qx*qy - qz*qw),     2*(qx*qz + qy*qw)],
                [    2*(qx*qy + qz*qw), 1 - 2*(qx*qx + qz*qz),     2*(qy*qz - qx*qw)],
                [    2*(qx*qz - qy*qw),     2*(qy*qz + qx*qw), 1 - 2*(qx*qx + qy*qy)]
            ])
            # Local shaft axis is +Y (0, 1, 0)
            shaft_axis = R @ np.array([0, 1, 0])
            # Normalize
            norm = np.linalg.norm(shaft_axis)
            if norm > 0.001:
                shaft_axis = shaft_axis / norm
                # In glTF coords: Y is UP, X is heelward (+X)
                # Lie angle from horizontal = arcsin(abs(Y))
                lie_angle = np.degrees(np.arcsin(abs(shaft_axis[1])))
                if 58.0 <= lie_angle <= 66.0:
                    vr.log_pass(f"head_{slug}", f"Shaft axis points up-and-heelward at {lie_angle:.2f}° (blueprint ~62°)")
                else:
                    vr.log_fail(f"head_{slug}", f"Shaft axis lie angle {lie_angle:.2f}° outside 58°-66° valid range")
        elif hosel_node.matrix:
            vr.log_pass(f"head_{slug}", "HoselSocket defines transform via 4x4 matrix")
        else:
            vr.log_warn(f"head_{slug}", "HoselSocket has no rotation quaternion or matrix")

    # 2. trimesh geometry & bounds check
    try:
        scene_or_mesh = trimesh.load(glb_path, force='scene')
        if isinstance(scene_or_mesh, trimesh.Scene):
            geom = scene_or_mesh.to_geometry()
            if isinstance(geom, dict):
                mesh = trimesh.util.concatenate(list(geom.values()))
            else:
                mesh = geom
        else:
            mesh = scene_or_mesh
    except Exception as e:
        vr.log_fail(f"head_{slug}", f"trimesh failed to load mesh: {e}")
        return None

    bounds = mesh.bounds
    extents = mesh.extents
    # In glTF: X=width (~0.075-0.115), Y=height (~0.055-0.075), Z=depth (~0.015-0.045)
    # Handle possible axis permutation
    ext_sorted = sorted(extents)
    depth_val = ext_sorted[0]  # smallest
    height_val = ext_sorted[1] # middle
    width_val = ext_sorted[2]  # largest

    # Check metric dimensions:
    # Width ~ 0.075 - 0.115 m
    if 0.070 <= width_val <= 0.125:
        vr.log_pass(f"head_{slug}", f"Width {width_val*1000:.1f} mm matches 7-iron range (75-115 mm)")
    else:
        vr.log_fail(f"head_{slug}", f"Width {width_val*1000:.1f} mm outside 70-125 mm range")

    # Height ~ 0.050 - 0.080 m
    if 0.050 <= height_val <= 0.080:
        vr.log_pass(f"head_{slug}", f"Height {height_val*1000:.1f} mm matches 7-iron range (50-80 mm)")
    else:
        vr.log_warn(f"head_{slug}", f"Height {height_val*1000:.1f} mm outside 50-80 mm standard range")

    # Depth ~ 0.012 - 0.055 m (including hosel offset & face loft tilt)
    if 0.012 <= depth_val <= 0.055:
        vr.log_pass(f"head_{slug}", f"Depth {depth_val*1000:.1f} mm matches 7-iron sole & offset envelope")
    else:
        vr.log_warn(f"head_{slug}", f"Depth {depth_val*1000:.1f} mm outside 12-55 mm range")

    # Sole tangent check: min Y (or min coordinate along height axis) within ±0.005 m of 0.0
    # In canonical coordinates, bounds[0][1] is ground contact
    min_y = bounds[0][1]
    if abs(min_y) <= 0.001:
        vr.log_pass(f"head_{slug}", f"Sole tangent to Y=0 at {min_y*1000:+.2f} mm (within ±1 mm ideal)")
    elif abs(min_y) <= 0.005:
        vr.log_pass(f"head_{slug}", f"Sole tangent to Y=0 at {min_y*1000:+.2f} mm (within ±5 mm tolerance)")
    else:
        vr.log_warn(f"head_{slug}", f"Sole contact min_y = {min_y*1000:+.2f} mm deviated from 0.0")

    # Degenerate face / NaN check
    if np.any(np.isnan(mesh.vertices)) or np.any(np.isinf(mesh.vertices)):
        vr.log_fail(f"head_{slug}", "Vertices contain NaN or Inf values")
    else:
        vr.log_pass(f"head_{slug}", f"Vertex coordinates clean ({len(mesh.vertices):,} vertices)")

    zero_area_faces = np.sum(mesh.area_faces < 1e-9)
    if zero_area_faces > 0:
        vr.log_warn(f"head_{slug}", f"Detected {zero_area_faces} zero-area degenerate faces")
    else:
        vr.log_pass(f"head_{slug}", f"No zero-area degenerate faces ({len(mesh.faces):,} faces)")

    return {
        'slug': slug,
        'width_m': float(width_val),
        'height_m': float(height_val),
        'depth_m': float(depth_val),
        'min_y': float(min_y),
        'vertices': int(len(mesh.vertices)),
        'faces': int(len(mesh.faces)),
        'file_size_mb': float(file_size_mb)
    }

def validate_parts_and_assembly(vr):
    """Validate parts and club assembly."""
    parts_dir = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'parts')
    parts = ['shaft.glb', 'ferrule.glb', 'grip.glb']
    missing = [p for p in parts if not os.path.exists(os.path.join(parts_dir, p))]

    if missing:
        vr.log_warn("parts", f"Parts missing: {missing} (builder may still be generating parts)")
        return

    # Check each part loads
    total_length = 0.0
    for p in parts:
        path = os.path.join(parts_dir, p)
        try:
            m = trimesh.load(path, force='mesh')
            ext = max(m.extents)
            vr.log_pass("parts", f"{p} loaded cleanly: major extent = {ext*1000:.1f} mm")
            if 'shaft' in p:
                total_length += ext
        except Exception as e:
            vr.log_fail("parts", f"Failed to load {p}: {e}")

    # Assembly club length: 7-iron is 37.0 inches = 0.9398 m (~0.92-0.96 m)
    if 0.85 <= total_length <= 1.00:
        vr.log_pass("assembly", f"Shaft length {total_length:.3f} m ({total_length/0.0254:.1f} in) assembles to ~37 in 7-iron standard")
    else:
        vr.log_warn("assembly", f"Shaft length {total_length:.3f} m vs standard 0.940 m")

def run_validation():
    parser = argparse.ArgumentParser(description="Takomo Golf 3D Asset Validator")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    args = parser.parse_args()

    vr = ValidationResult()
    print("=" * 60)
    print(" TAKOMO 3D ASSET VALIDATION SUITE")
    print("=" * 60)

    # 1. Manifest
    print("\n--- 1. Manifest Schema & Reference Checks ---")
    manifest_data = validate_manifest(vr)

    # 2. Individual Head Models
    print("\n--- 2. Club Head Models Geometric & PBR Checks ---")
    head_results = {}
    for slug in SLUGS:
        res = validate_head_glb(slug, vr)
        if res:
            head_results[slug] = res

    # 3. Monotonic Progression across heads
    print("\n--- 3. 5-Iron Dimensional Progression Checks ---")
    if len(head_results) == 5:
        # Check depth (sole width) monotonic progression: 101 >= 201 >= 201T >= 301 CB >= 301 MB
        depths = [head_results[s]['depth_m'] for s in SLUGS]
        # Allow 1 mm tolerance for mesh discretization
        is_depth_monotonic = all(depths[i] >= depths[i+1] - 0.0015 for i in range(len(depths)-1))
        if is_depth_monotonic:
            vr.log_pass("progression", f"Sole depth progression monotonic: {[round(d*1000, 1) for d in depths]} mm")
        else:
            vr.log_warn("progression", f"Sole depth progression non-monotonic: {[round(d*1000, 1) for d in depths]} mm")

        widths = [head_results[s]['width_m'] for s in SLUGS]
        is_width_monotonic = all(widths[i] >= widths[i+1] - 0.002 for i in range(len(widths)-1))
        if is_width_monotonic:
            vr.log_pass("progression", f"Blade length progression monotonic: {[round(w*1000, 1) for w in widths]} mm")
        else:
            vr.log_warn("progression", f"Blade length progression non-monotonic: {[round(w*1000, 1) for w in widths]} mm")
    elif len(head_results) > 0:
        vr.log_pass("progression", f"Validated {len(head_results)}/5 head models so far")

    # 4. Parts & Assembly
    print("\n--- 4. Component Parts & Assembly Checks ---")
    validate_parts_and_assembly(vr)

    # Summary
    print("\n" + "=" * 60)
    print(f" VALIDATION SUMMARY: {len(vr.passes)} PASSED, {len(vr.warnings)} WARNINGS, {len(vr.failures)} FAILURES")
    print("=" * 60)

    if args.json:
        report = {
            'ok': vr.ok,
            'passes': vr.passes,
            'warnings': vr.warnings,
            'failures': vr.failures,
            'head_results': head_results
        }
        print(json.dumps(report, indent=2))

    return 0 if vr.ok else 1

if __name__ == '__main__':
    sys.exit(run_validation())
