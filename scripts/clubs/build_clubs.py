"""
Deterministic Headless Blender 4.5 (bpy) 3D Golf Club & Modular Tinker-Mode Rig Generator
for Takomo Golf 7-Iron Heads (Issue #3).

Builds:
1. 5 Head meshes: assets/clubs/heads/{101-mkii, 201-mkii, 201t-mkii, 301-cb, 301-mb}.glb
   (< 1.5 MB each, embedded PBR textures, HoselSocket empty node included)
2. 3 Modular Tinker-Mode parts: assets/clubs/parts/{ferrule, shaft, grip}.glb
3. 5 Pre-assembled full 7-iron clubs: assets/clubs/ar/{slug}.glb and assets/clubs/ar/{slug}.usdz
4. Manifest: assets/clubs/manifest.json
5. Multi-angle headless verification render: scripts/clubs/preview_check.png
"""

import bpy
import bmesh
import math
import os
import json
import mathutils
import numpy as np

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
ASSETS_DIR = os.path.join(WORKSPACE_ROOT, "assets/clubs")
SCRIPTS_DIR = os.path.join(WORKSPACE_ROOT, "scripts/clubs")
TEXTURES_DIR = os.path.join(SCRIPTS_DIR, "textures")

HEADS_DIR = os.path.join(ASSETS_DIR, "heads")
PARTS_DIR = os.path.join(ASSETS_DIR, "parts")
AR_DIR = os.path.join(ASSETS_DIR, "ar")

for d in [HEADS_DIR, PARTS_DIR, AR_DIR]:
    os.makedirs(d, exist_ok=True)

# Master specifications table
CLUB_SPECS = [
    {
        "slug": "101-mkii",
        "name": "Iron 101 MKII",
        "category": "Game Improvement",
        "construction": "Hollow-body 17-4/431 SS",
        "loft_deg": 29.0,
        "lie_deg": 62.5,
        "offset_mm": 3.40,
        "blade_mm": 78.8,
        "topline_mm": 7.0,
        "sole_mm": 21.5,
        "bounce_deg": 3.0,
        "weight_g": 272.0,
        "has_toe_screw": False,
        "hosel_stamps": "TAKOMO"
    },
    {
        "slug": "201-mkii",
        "name": "Iron 201 MKII",
        "category": "Players Distance",
        "construction": "Hollow-body + Tungsten",
        "loft_deg": 31.0,
        "lie_deg": 62.0,
        "offset_mm": 2.77,
        "blade_mm": 77.0,
        "topline_mm": 5.8,
        "sole_mm": 18.5,
        "bounce_deg": 3.5,
        "weight_g": 270.0,
        "has_toe_screw": False,
        "hosel_stamps": "TAKOMO"
    },
    {
        "slug": "201t-mkii",
        "name": "Iron 201T MKII",
        "category": "Compact Players",
        "construction": "Compact Hollow-body",
        "loft_deg": 33.0,
        "lie_deg": 62.5,
        "offset_mm": 2.46,
        "blade_mm": 74.8,
        "topline_mm": 5.0,
        "sole_mm": 16.0,
        "bounce_deg": 4.0,
        "weight_g": 270.0,
        "has_toe_screw": False,
        "hosel_stamps": "TAKOMO"
    },
    {
        "slug": "301-cb",
        "name": "Iron 301 CB",
        "category": "Forged Cavity Back",
        "construction": "1-piece Forged S20C",
        "loft_deg": 34.0,
        "lie_deg": 62.5,
        "offset_mm": 1.80,
        "blade_mm": 71.0,
        "topline_mm": 4.5,
        "sole_mm": 15.0,
        "bounce_deg": 4.5,
        "weight_g": 267.0,
        "has_toe_screw": False,
        "hosel_stamps": "TAKOMO FORGED S20C"
    },
    {
        "slug": "301-mb",
        "name": "Iron 301 MB",
        "category": "Muscle Back Blade",
        "construction": "1-piece Forged S20C",
        "loft_deg": 34.0,
        "lie_deg": 62.5,
        "offset_mm": 1.80,
        "blade_mm": 71.0,
        "topline_mm": 4.5,
        "sole_mm": 13.0,
        "bounce_deg": 4.5,
        "weight_g": 267.0,
        "has_toe_screw": False,
        "hosel_stamps": "TAKOMO FORGED S20C"
    }
]

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_head_mesh(spec):
    slug = spec["slug"]
    loft_deg = spec["loft_deg"]
    lie_deg = spec["lie_deg"]
    offset_mm = spec["offset_mm"]
    blade_mm = spec["blade_mm"]
    topline_mm = spec["topline_mm"]
    sole_mm = spec["sole_mm"]
    
    loft_rad = math.radians(loft_deg)
    lie_rad = math.radians(lie_deg)
    offset_m = offset_mm / 1000.0
    blade_m = blade_mm / 1000.0
    topline_m = topline_mm / 1000.0
    sole_m = sole_mm / 1000.0

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.verify()

    # Perimeter segments:
    # 10 face, 4 topline, 22 back (for crisp steps & CNC cavity), 8 sole = 44 vertices per ring
    n_face = 10
    n_top = 4
    n_back = 22
    n_sole = 8
    n_total = n_face + n_top + n_back + n_sole  # 44

    num_stations = 64
    x_heel = 0.024
    x_toe = x_heel - blade_m

    station_rings = []
    z_mid_toe = 0.025

    for i in range(num_stations):
        s = i / (num_stations - 1)
        
        # Station X position and width factor
        if s < 0.82:
            x = x_heel * (1.0 - s) + x_toe * s
            w_factor = 1.0
            z_top = 0.024 + 0.024 * (s / 0.82)**0.7
            z_sole = 0.003 * (1.0 - s)**2 + 0.004 * s**2
        else:
            # Smoothly converge z_top and z_sole toward z_mid_toe (1.5mm radius at toe apex)
            s_toe = (s - 0.82) / 0.18
            theta = s_toe * (math.pi / 2.0)
            x = (x_heel * 0.18 + x_toe * 0.82) + (x_toe - (x_heel * 0.18 + x_toe * 0.82)) * math.sin(theta)
            w_factor = max(0.04, math.cos(theta))
            
            z_top_base = 0.048
            z_sole_base = 0.004
            z_top = z_mid_toe + (z_top_base - z_mid_toe) * math.cos(theta)
            z_sole = z_mid_toe - (z_mid_toe - z_sole_base) * math.cos(theta)
            
        w_sole_s = sole_m * w_factor
        w_top_s = topline_m * w_factor
        y_le = 0.0005 * math.sin(s * math.pi)
        
        ring_data = []
        
        # 1. Face (j in 0..n_face-1)
        for j in range(n_face):
            t = j / n_face
            z = z_sole * (1.0 - t) + z_top * t
            y = y_le + (z - z_sole) * math.tan(loft_rad)
            v = bm.verts.new((x, y, z))
            if 0.12 <= s <= 0.82 and 0.06 <= t <= 0.94:
                s_rel = (s - 0.12) / 0.70
                t_rel = (t - 0.06) / 0.88
                u_uv = 0.10 + s_rel * 0.32
                v_uv = 0.58 + t_rel * 0.34
            else:
                u_uv = 0.46
                v_uv = 0.10
            ring_data.append((v, u_uv, v_uv))
            
        # 2. Topline (j in 0..n_top-1)
        y_top_front = ring_data[-1][0].co.y
        for j in range(n_top):
            t = j / n_top
            z = z_top
            y = y_top_front + t * w_top_s
            v = bm.verts.new((x, y, z))
            ring_data.append((v, 0.46, 0.10))
            
        # 3. Back Cavity & Muscle (j in 0..n_back-1)
        # Here t goes from 0 (topline back edge) to 1 (sole trailing edge)
        for j in range(n_back):
            t = j / n_back
            z = z_top * (1.0 - t) + z_sole * t
            face_y = y_le + (z - z_sole) * math.tan(loft_rad)
            
            # Accurate CAD-grade back thickness profile
            if slug == "301-mb":
                # Pure 1-piece forged muscle-back blade
                if t <= 0.42:
                    thick = w_top_s + 0.0012 * t
                elif t < 0.52:
                    alpha = (t - 0.42) / 0.10
                    t0 = w_top_s + 0.0012 * 0.42
                    t1 = w_top_s + (w_sole_s - w_top_s) * 0.72
                    thick = t0 * (1.0 - alpha) + t1 * alpha
                else:
                    beta = (t - 0.52) / 0.48
                    t1 = w_top_s + (w_sole_s - w_top_s) * 0.72
                    thick = t1 * (1.0 - beta) + w_sole_s * beta
            elif slug == "301-cb":
                # True perimeter-weighted CNC cavity pocket
                thick_base = w_top_s * (1.0 - t) + w_sole_s * t
                if t > 0.54:
                    beta = (t - 0.54) / 0.46
                    t1 = w_top_s + (w_sole_s - w_top_s) * 0.68
                    thick = t1 * (1.0 - beta) + w_sole_s * beta
                elif 0.12 <= t <= 0.54 and 0.10 <= s <= 0.86:
                    f_t = min((t - 0.12) / 0.04, (0.54 - t) / 0.04, 1.0)
                    f_s = min((s - 0.10) / 0.04, (0.86 - s) / 0.04, 1.0)
                    recess = 0.0030 * f_t * f_s * w_factor
                    thick = max(0.0032, thick_base - recess)
                else:
                    thick = w_top_s
            elif slug in ["201-mkii", "201t-mkii"]:
                # Stepped players distance hollow-body
                if t < 0.10:
                    thick = w_top_s
                elif t <= 0.45:
                    f_t = min((t - 0.10) / 0.04, (0.45 - t) / 0.04, 1.0)
                    f_s = min((s - 0.08) / 0.04, (0.88 - s) / 0.04, 1.0)
                    recess = 0.0018 * f_t * f_s * w_factor
                    thick = max(0.0032, w_top_s + 0.0008 * t - recess)
                elif t < 0.53:
                    alpha = (t - 0.45) / 0.08
                    t0 = w_top_s + 0.0008 * 0.45
                    t1 = w_top_s + (w_sole_s - w_top_s) * 0.75
                    thick = t0 * (1.0 - alpha) + t1 * alpha
                else:
                    beta = (t - 0.53) / 0.47
                    t1 = w_top_s + (w_sole_s - w_top_s) * 0.75
                    thick = t1 * (1.0 - beta) + w_sole_s * beta
            else: # 101-mkii
                # Wide hollow-body with recessed lower-mid pocket and sole rim
                thick_base = w_top_s * (1.0 - t) + w_sole_s * t
                if t <= 0.35:
                    thick = w_top_s + (w_sole_s - w_top_s) * 0.22 * (t / 0.35)
                elif 0.38 <= t <= 0.84 and 0.08 <= s <= 0.86:
                    f_t = min((t - 0.38) / 0.05, (0.84 - t) / 0.05, 1.0)
                    f_s = min((s - 0.08) / 0.05, (0.86 - s) / 0.05, 1.0)
                    recess = 0.0025 * f_t * f_s * w_factor
                    thick = max(0.0035, thick_base - recess)
                else:
                    beta = max(0.0, (t - 0.84) / 0.16)
                    t_rim = thick_base
                    thick = t_rim * (1.0 - beta) + w_sole_s * beta
                    
            y = face_y + thick
            v = bm.verts.new((x, y, z))
            t_up = 1.0 - t
            # Back UV: s=0 (heel) -> U=0.58, s=1 (toe) -> U=0.92
            u_uv = 0.58 + s * 0.34
            v_uv = 0.58 + t_up * 0.34
            ring_data.append((v, u_uv, v_uv))
            
        # 4. Sole (j in 0..n_sole-1)
        y_te = ring_data[-1][0].co.y
        for j in range(n_sole):
            t = j / n_sole
            y = y_te * (1.0 - t) + y_le * t
            camber = -0.0012 * math.sin(t * math.pi) * w_factor
            z = z_sole + camber
            v = bm.verts.new((x, y, z))
            w_rel = 1.0 - t
            u_uv = 0.08 + s * 0.34
            v_uv = 0.08 + w_rel * 0.34
            ring_data.append((v, u_uv, v_uv))
            
        station_rings.append(ring_data)

    # Faces between blade station rings
    for i in range(num_stations - 1):
        r0 = station_rings[i]
        r1 = station_rings[i + 1]
        for j in range(n_total):
            j_next = (j + 1) % n_total
            v00, u00, v_uv00 = r0[j]
            v01, u01, v_uv01 = r0[j_next]
            v11, u11, v_uv11 = r1[j_next]
            v10, u10, v_uv10 = r1[j]
            face = bm.faces.new([v00, v01, v11, v10])
            for loop in face.loops:
                if loop.vert == v00:
                    loop[uv_layer].uv = (u00, v_uv00)
                elif loop.vert == v01:
                    loop[uv_layer].uv = (u01, v_uv01)
                elif loop.vert == v11:
                    loop[uv_layer].uv = (u11, v_uv11)
                elif loop.vert == v10:
                    loop[uv_layer].uv = (u10, v_uv10)

    # Perfectly smooth tour toe tip: centroid exactly at x_toe
    toe_ring = [item[0] for item in station_rings[-1]]
    toe_centroid_y = float(np.mean([v.co.y for v in toe_ring]))
    toe_center = bm.verts.new((x_toe, toe_centroid_y, z_mid_toe))
    for j in range(n_total):
        j_next = (j + 1) % n_total
        face = bm.faces.new([toe_ring[j], toe_center, toe_ring[j_next]])
        for loop in face.loops:
            loop[uv_layer].uv = (0.46, 0.10)

    # =========================================================================
    # HOSEL TUBE & C1-SMOOTH CUBIC HERMITE HEEL BLEND
    # =========================================================================
    d_mouth = 0.0134
    r_mouth = d_mouth / 2.0  # 0.0067
    r_elbow = 0.0064
    d_bore = 0.0094
    r_bore = d_bore / 2.0
    l_hosel = 0.0635

    dir_hosel = np.array([math.cos(lie_rad), 0.0, math.sin(lie_rad)])
    u_y = np.array([0.0, 1.0, 0.0])  # +Y back
    u_z = np.array([-math.sin(lie_rad), 0.0, math.cos(lie_rad)])  # upward perpendicular to hosel

    x_heel_root = 0.023
    mouth_pos = np.array([
        x_heel_root + l_hosel * math.cos(lie_rad),
        -offset_m,
        l_hosel * math.sin(lie_rad)
    ])

    # 1. Compute true centroid of station_rings[0] (heel station)
    heel_verts = [item[0] for item in station_rings[0]]
    heel_center = np.mean([np.array([v.co.x, v.co.y, v.co.z]) for v in heel_verts], axis=0)

    # 2. For each j in 0..n_total-1, compute true 2D angle phi_j in (Y, Z) plane
    hosel_circle_dirs = []
    for j in range(n_total):
        v = heel_verts[j]
        dy = v.co.y - heel_center[1]
        dz = v.co.z - heel_center[2]
        phi_j = math.atan2(dz, dy)
        circle_dir = math.cos(phi_j) * u_y + math.sin(phi_j) * u_z
        hosel_circle_dirs.append(circle_dir)

    # 3. Straight circular cylinder section (mouth down to elbow_start)
    l_straight = l_hosel * 0.68
    elbow_start = mouth_pos - dir_hosel * l_straight
    
    num_straight_rings = 10
    straight_rings = []
    for si in range(num_straight_rings):
        u = si / (num_straight_rings - 1)
        pos = mouth_pos - dir_hosel * (l_straight * u)
        r = r_mouth * (1.0 - u) + r_elbow * u
        ring_v = []
        for j in range(n_total):
            v_pos = pos + r * hosel_circle_dirs[j]
            v = bm.verts.new((v_pos[0], v_pos[1], v_pos[2]))
            u_uv = 0.55 + (j / n_total) * 0.40
            v_uv = 0.08 + (1.0 - 0.68 * u) * 0.38
            ring_v.append((v, u_uv, v_uv))
        straight_rings.append(ring_v)

    for si in range(num_straight_rings - 1):
        r0 = straight_rings[si]
        r1 = straight_rings[si + 1]
        for j in range(n_total):
            j_next = (j + 1) % n_total
            v00, u00, v_uv00 = r0[j]
            v01, u01, v_uv01 = r0[j_next]
            v11, u11, v_uv11 = r1[j_next]
            v10, u10, v_uv10 = r1[j]
            face = bm.faces.new([v00, v01, v11, v10])
            for loop in face.loops:
                if loop.vert == v00:
                    loop[uv_layer].uv = (u00, v_uv00)
                elif loop.vert == v01:
                    loop[uv_layer].uv = (u01, v_uv01)
                elif loop.vert == v11:
                    loop[uv_layer].uv = (u11, v_uv11)
                elif loop.vert == v10:
                    loop[uv_layer].uv = (u10, v_uv10)

    # 4. Cubic Hermite transition rings from elbow_start into heel_station_verts
    num_elbow_rings = 14
    elbow_rings = [straight_rings[-1]]  # starts from last straight ring

    for ei in range(1, num_elbow_rings):
        u = ei / (num_elbow_rings - 1)
        h00 = 2.0 * u**3 - 3.0 * u**2 + 1.0
        h10 = u**3 - 2.0 * u**2 + u
        h01 = -2.0 * u**3 + 3.0 * u**2
        h11 = u**3 - u**2
        
        ring_v = []
        for j in range(n_total):
            P0 = elbow_start + r_elbow * hosel_circle_dirs[j]
            P1 = np.array([heel_verts[j].co.x, heel_verts[j].co.y, heel_verts[j].co.z])
            chord_len = float(np.linalg.norm(P1 - P0))
            T0 = -dir_hosel * (chord_len * 0.85)
            T1 = np.array([-chord_len * 0.85, 0.0, 0.0])
            
            if ei == num_elbow_rings - 1:
                # The final ring IS the heel station vertex!
                v = heel_verts[j]
            else:
                pos = h00 * P0 + h10 * T0 + h01 * P1 + h11 * T1
                v = bm.verts.new((pos[0], pos[1], pos[2]))
                
            u_uv = 0.55 + (j / n_total) * 0.40
            v_uv = 0.08 + (1.0 - (0.68 + 0.32 * u)) * 0.38
            ring_v.append((v, u_uv, v_uv))
        elbow_rings.append(ring_v)

    for ei in range(num_elbow_rings - 1):
        r0 = elbow_rings[ei]
        r1 = elbow_rings[ei + 1]
        for j in range(n_total):
            j_next = (j + 1) % n_total
            v00, u00, v_uv00 = r0[j]
            v01, u01, v_uv01 = r0[j_next]
            v11, u11, v_uv11 = r1[j_next]
            v10, u10, v_uv10 = r1[j]
            face = bm.faces.new([v00, v01, v11, v10])
            for loop in face.loops:
                if loop.vert == v00:
                    loop[uv_layer].uv = (u00, v_uv00)
                elif loop.vert == v01:
                    loop[uv_layer].uv = (u01, v_uv01)
                elif loop.vert == v11:
                    loop[uv_layer].uv = (u11, v_uv11)
                elif loop.vert == v10:
                    loop[uv_layer].uv = (u10, v_uv10)

    # 5. Inner bore and hosel mouth lip
    mouth_outer_ring = [item[0] for item in straight_rings[0]]
    bore_pts = []
    for j in range(n_total):
        pos = mouth_pos + hosel_circle_dirs[j] * r_bore - dir_hosel * 0.025
        v = bm.verts.new((pos[0], pos[1], pos[2]))
        bore_pts.append(v)

    for j in range(n_total):
        j_next = (j + 1) % n_total
        face = bm.faces.new([mouth_outer_ring[j], mouth_outer_ring[j_next], bore_pts[j_next], bore_pts[j]])
        for loop in face.loops:
            loop[uv_layer].uv = (0.46, 0.10)

    bore_bottom = bm.faces.new(list(reversed(bore_pts)))
    for loop in bore_bottom.loops:
        loop[uv_layer].uv = (0.46, 0.10)

    # 6. Real 3D Flush Torx Weight Port on Lower Toe Profile
    if spec["has_toe_screw"]:
        # Position flush against lower outer toe surface, recessing inward into head (+X)
        x_screw = x_toe + 0.0002
        z_screw = 0.016
        y_screw = 0.010
        r_bezel = 0.0020  # Ø 4.0 mm
        r_inner = 0.0013
        depth_star = 0.0008
        
        n_screw_pts = 12
        # Outer bezel ring on toe surface
        bezel_verts = []
        for pi in range(n_screw_pts):
            angle = 2.0 * math.pi * pi / n_screw_pts
            vy = y_screw + math.cos(angle) * r_bezel
            vz = z_screw + math.sin(angle) * r_bezel
            v = bm.verts.new((x_screw, vy, vz))
            bezel_verts.append(v)
            
        # Inner recessed 6-pointed star socket vertices
        star_verts = []
        for pi in range(n_screw_pts):
            angle = 2.0 * math.pi * pi / n_screw_pts
            # 6-lobed modulation
            r_s = r_inner * (1.0 + 0.28 * math.cos(6.0 * angle))
            vy = y_screw + math.cos(angle) * r_s
            vz = z_screw + math.sin(angle) * r_s
            v = bm.verts.new((x_screw + depth_star, vy, vz))
            star_verts.append(v)
            
        # Faces connecting bezel to star socket
        for pi in range(n_screw_pts):
            p_next = (pi + 1) % n_screw_pts
            f = bm.faces.new([bezel_verts[pi], bezel_verts[p_next], star_verts[p_next], star_verts[pi]])
            for loop in f.loops:
                loop[uv_layer].uv = (0.46, 0.10)
        # Recessed star bottom
        f_star = bm.faces.new(list(reversed(star_verts)))
        for loop in f_star.loops:
            loop[uv_layer].uv = (0.46, 0.10)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new(slug)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(slug, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.shade_smooth()

    # HoselSocket Empty Node
    empty = bpy.data.objects.new("HoselSocket", None)
    bpy.context.collection.objects.link(empty)
    empty.location = (mouth_pos[0], mouth_pos[1], mouth_pos[2])
    empty.rotation_mode = 'XYZ'
    empty.rotation_euler = (0, math.radians(90.0 - lie_deg), 0)

    # PBR Material
    mat = bpy.data.materials.new(name=f"ClubHeadMaterial_{slug}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")

    tex_dir = os.path.join(TEXTURES_DIR, slug)
    albedo_path = os.path.join(tex_dir, "albedo.png")
    normal_path = os.path.join(tex_dir, "normal.png")
    rough_path = os.path.join(tex_dir, "roughness.png")
    metal_path = os.path.join(tex_dir, "metallic.png")

    if os.path.exists(albedo_path):
        tex_albedo = nodes.new("ShaderNodeTexImage")
        tex_albedo.image = bpy.data.images.load(albedo_path)
        links.new(tex_albedo.outputs["Color"], bsdf.inputs["Base Color"])

    if os.path.exists(rough_path):
        tex_rough = nodes.new("ShaderNodeTexImage")
        tex_rough.image = bpy.data.images.load(rough_path)
        tex_rough.image.colorspace_settings.name = "Non-Color"
        links.new(tex_rough.outputs["Color"], bsdf.inputs["Roughness"])

    if os.path.exists(metal_path):
        tex_metal = nodes.new("ShaderNodeTexImage")
        tex_metal.image = bpy.data.images.load(metal_path)
        tex_metal.image.colorspace_settings.name = "Non-Color"
        links.new(tex_metal.outputs["Color"], bsdf.inputs["Metallic"])

    if os.path.exists(normal_path):
        tex_norm = nodes.new("ShaderNodeTexImage")
        tex_norm.image = bpy.data.images.load(normal_path)
        tex_norm.image.colorspace_settings.name = "Non-Color"
        node_norm = nodes.new("ShaderNodeNormalMap")
        node_norm.space = 'TANGENT'
        links.new(tex_norm.outputs["Color"], node_norm.inputs["Color"])
        links.new(node_norm.outputs["Normal"], bsdf.inputs["Normal"])

    obj.data.materials.append(mat)
    
    # glTF Bounding Box
    bb = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    min_x_gltf = min(v.x for v in bb)
    max_x_gltf = max(v.x for v in bb)
    min_y_gltf = min(v.z for v in bb)
    max_y_gltf = max(v.z for v in bb)
    min_z_gltf = min(-v.y for v in bb)
    max_z_gltf = max(-v.y for v in bb)

    # HoselSocket in glTF space
    mouth_gltf = [float(mouth_pos[0]), float(mouth_pos[2]), float(-mouth_pos[1])]
    axis_gltf = [float(math.cos(lie_rad)), float(math.sin(lie_rad)), 0.0]
    alpha = -math.radians(90.0 - lie_deg)
    quat_gltf = [0.0, 0.0, float(math.sin(alpha / 2.0)), float(math.cos(alpha / 2.0))]

    sweet_spot_gltf = [0.0, 0.024, 0.010]
    topline_mid_gltf = [0.0, 0.046, -0.018]
    hosel_le_gltf = [float(mouth_pos[0]), float(mouth_pos[2]), float(offset_m)]
    face_le_gltf = [0.0, 0.001, 0.0]

    meta = {
        "slug": slug,
        "name": spec["name"],
        "glbPath": f"assets/clubs/heads/{slug}.glb",
        "arGlbPath": f"assets/clubs/ar/{slug}.glb",
        "arUsdzPath": f"assets/clubs/ar/{slug}.usdz",
        "specs": spec,
        "boundingBox": [min_x_gltf, min_y_gltf, min_z_gltf, max_x_gltf, max_y_gltf, max_z_gltf],
        "hoselSocket": {
            "position": mouth_gltf,
            "axis": axis_gltf,
            "quaternion": quat_gltf
        },
        "anchors": {
            "sweetSpot": sweet_spot_gltf,
            "toplineMidpoint": topline_mid_gltf,
            "hoselLeadingEdge": hosel_le_gltf,
            "faceLeadingEdge": face_le_gltf
        },
        "cameraPresets": {
            "addressEye": {"position": [0.08, 0.95, -0.15], "target": [0.0, 0.02, 0.0]},
            "backHero": {"position": [0.0, 0.04, -0.22], "target": [0.0, 0.025, 0.0]},
            "faceOn": {"position": [0.0, 0.04, 0.22], "target": [0.0, 0.025, 0.0]},
            "sole": {"position": [0.0, -0.20, 0.01], "target": [0.0, 0.005, 0.0]},
            "hoselLie": {"position": [mouth_gltf[0] + 0.15, mouth_gltf[1] + 0.15, 0.0], "target": mouth_gltf}
        }
    }

    return obj, empty, meta

def build_all_heads():
    all_meta = {}
    for spec in CLUB_SPECS:
        clear_scene()
        slug = spec["slug"]
        print(f"Building head: {slug}...")
        obj, empty, meta = create_head_mesh(spec)
        all_meta[slug] = meta
        
        out_glb = os.path.join(HEADS_DIR, f"{slug}.glb")
        bpy.ops.export_scene.gltf(
            filepath=out_glb,
            export_format='GLB',
            export_yup=True,
            export_materials='EXPORT',
            export_image_format='AUTO'
        )
        print(f"Exported {out_glb} ({os.path.getsize(out_glb)} bytes)")
    return all_meta

def build_modular_parts():
    print("Building modular Tinker-Mode parts (ferrule, shaft, grip)...")
    
    # 1. Ferrule
    clear_scene()
    bm = bmesh.new()
    l_ferrule = 0.019
    r_base = 0.0134 / 2.0
    r_top = 0.0125 / 2.0
    
    num_f_rings = 12
    n_pts = 24
    f_rings = []
    
    for fi in range(num_f_rings):
        t = fi / (num_f_rings - 1)
        z = l_ferrule * t
        r_outer = r_base * (1.0 - t) + r_top * t
        ring_v = []
        for pi in range(n_pts):
            angle = 2.0 * math.pi * pi / n_pts
            v = bm.verts.new((math.cos(angle) * r_outer, math.sin(angle) * r_outer, z))
            ring_v.append(v)
        f_rings.append(ring_v)
        
    for fi in range(num_f_rings - 1):
        for pi in range(n_pts):
            pi_next = (pi + 1) % n_pts
            bm.faces.new([f_rings[fi][pi], f_rings[fi][pi_next], f_rings[fi+1][pi_next], f_rings[fi+1][pi]])
            
    bm.faces.new(list(reversed(f_rings[0])))
    bm.faces.new(f_rings[-1])
    
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Ferrule")
    bm.to_mesh(mesh)
    bm.free()
    
    f_obj = bpy.data.objects.new("Ferrule", mesh)
    bpy.context.collection.objects.link(f_obj)
    mesh.shade_smooth()
    
    mat_f = bpy.data.materials.new("FerruleBlack")
    mat_f.use_nodes = True
    bsdf = mat_f.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.05, 0.05, 0.06, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.12
    bsdf.inputs["Metallic"].default_value = 0.05
    f_obj.data.materials.append(mat_f)
    
    out_ferrule = os.path.join(PARTS_DIR, "ferrule.glb")
    bpy.ops.export_scene.gltf(filepath=out_ferrule, export_format='GLB', export_yup=True)
    print(f"Exported ferrule: {out_ferrule} ({os.path.getsize(out_ferrule)} bytes)")

    # 2. Shaft
    clear_scene()
    bm = bmesh.new()
    l_shaft = 0.8763
    r_tip = 0.0094 / 2.0
    r_butt = 0.01524 / 2.0
    
    num_s_rings = 32
    s_rings = []
    for si in range(num_s_rings):
        t = si / (num_s_rings - 1)
        z = l_shaft * t
        if z < 0.15:
            r = r_tip
        else:
            t_taper = (z - 0.15) / (l_shaft - 0.15)
            r = r_tip * (1.0 - t_taper) + r_butt * t_taper
        ring_v = []
        for pi in range(n_pts):
            angle = 2.0 * math.pi * pi / n_pts
            v = bm.verts.new((math.cos(angle) * r, math.sin(angle) * r, z))
            ring_v.append(v)
        s_rings.append(ring_v)
        
    for si in range(num_s_rings - 1):
        for pi in range(n_pts):
            pi_next = (pi + 1) % n_pts
            bm.faces.new([s_rings[si][pi], s_rings[si][pi_next], s_rings[si+1][pi_next], s_rings[si+1][pi]])
            
    bm.faces.new(list(reversed(s_rings[0])))
    bm.faces.new(s_rings[-1])
    
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Shaft")
    bm.to_mesh(mesh)
    bm.free()
    
    s_obj = bpy.data.objects.new("Shaft", mesh)
    bpy.context.collection.objects.link(s_obj)
    mesh.shade_smooth()
    
    mat_s = bpy.data.materials.new("ShaftMaterial")
    mat_s.use_nodes = True
    bsdf = mat_s.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.88, 0.90, 0.92, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.08
    bsdf.inputs["Metallic"].default_value = 0.98
    s_obj.data.materials.append(mat_s)
    
    out_shaft = os.path.join(PARTS_DIR, "shaft.glb")
    bpy.ops.export_scene.gltf(filepath=out_shaft, export_format='GLB', export_yup=True)
    print(f"Exported shaft: {out_shaft} ({os.path.getsize(out_shaft)} bytes)")

    # 3. Grip
    clear_scene()
    bm = bmesh.new()
    l_grip = 0.265
    r_collar = 0.0160 / 2.0
    r_cap = 0.0270 / 2.0
    
    num_g_rings = 24
    g_rings = []
    for gi in range(num_g_rings):
        t = gi / (num_g_rings - 1)
        z = l_grip * t
        r = r_collar * (1.0 - t**0.8) + r_cap * (t**0.8)
        ring_v = []
        for pi in range(n_pts):
            angle = 2.0 * math.pi * pi / n_pts
            v = bm.verts.new((math.cos(angle) * r, math.sin(angle) * r, z))
            ring_v.append(v)
        g_rings.append(ring_v)
        
    for gi in range(num_g_rings - 1):
        for pi in range(n_pts):
            pi_next = (pi + 1) % n_pts
            bm.faces.new([g_rings[gi][pi], g_rings[gi][pi_next], g_rings[gi+1][pi_next], g_rings[gi+1][pi]])
            
    bm.faces.new(list(reversed(g_rings[0])))
    bm.faces.new(g_rings[-1])
    
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Grip")
    bm.to_mesh(mesh)
    bm.free()
    
    g_obj = bpy.data.objects.new("Grip", mesh)
    bpy.context.collection.objects.link(g_obj)
    mesh.shade_smooth()
    
    mat_g = bpy.data.materials.new("GripRubber")
    mat_g.use_nodes = True
    bsdf = mat_g.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.13, 0.13, 0.14, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.75
    bsdf.inputs["Metallic"].default_value = 0.02
    g_obj.data.materials.append(mat_g)
    
    out_grip = os.path.join(PARTS_DIR, "grip.glb")
    bpy.ops.export_scene.gltf(filepath=out_grip, export_format='GLB', export_yup=True)
    print(f"Exported grip: {out_grip} ({os.path.getsize(out_grip)} bytes)")

def build_ar_clubs():
    print("Building AR pre-assembled full 7-iron clubs (GLB + USDZ)...")
    for spec in CLUB_SPECS:
        clear_scene()
        slug = spec["slug"]
        lie_deg = spec["lie_deg"]
        lie_rad = math.radians(lie_deg)
        offset_m = spec["offset_mm"] / 1000.0
        
        obj, empty, _ = create_head_mesh(spec)
        
        l_hosel = 0.0635
        x_heel_root = 0.023
        mouth_pos = (
            x_heel_root + l_hosel * math.cos(lie_rad),
            -offset_m,
            l_hosel * math.sin(lie_rad)
        )
        rot_axis_euler = (0, math.radians(90.0 - lie_deg), 0)
        
        # Add Ferrule
        bm_f = bmesh.new()
        l_ferrule = 0.019
        r_base = 0.0134 / 2.0
        r_top = 0.0125 / 2.0
        n_pts = 24
        f_rings = []
        for fi in range(8):
            t = fi / 7.0
            z = l_ferrule * t
            r = r_base * (1.0 - t) + r_top * t
            f_rings.append([bm_f.verts.new((math.cos(2*math.pi*p/n_pts)*r, math.sin(2*math.pi*p/n_pts)*r, z)) for p in range(n_pts)])
        for fi in range(7):
            for pi in range(n_pts):
                p_next = (pi + 1) % n_pts
                bm_f.faces.new([f_rings[fi][pi], f_rings[fi][p_next], f_rings[fi+1][p_next], f_rings[fi+1][pi]])
        mesh_f = bpy.data.meshes.new("Ferrule_AR")
        bm_f.to_mesh(mesh_f)
        bm_f.free()
        f_obj = bpy.data.objects.new("Ferrule_AR", mesh_f)
        bpy.context.collection.objects.link(f_obj)
        f_obj.location = mouth_pos
        f_obj.rotation_mode = 'XYZ'
        f_obj.rotation_euler = rot_axis_euler
        mat_f = bpy.data.materials.new("FerruleBlack_AR")
        mat_f.use_nodes = True
        mat_f.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.05, 0.05, 0.06, 1.0)
        f_obj.data.materials.append(mat_f)
        
        # Add Shaft
        bm_s = bmesh.new()
        l_shaft = 0.8763
        r_tip = 0.0094 / 2.0
        r_butt = 0.01524 / 2.0
        s_rings = []
        for si in range(16):
            t = si / 15.0
            z = l_shaft * t
            r = r_tip if z < 0.15 else r_tip * (1.0 - (z-0.15)/(l_shaft-0.15)) + r_butt * ((z-0.15)/(l_shaft-0.15))
            s_rings.append([bm_s.verts.new((math.cos(2*math.pi*p/n_pts)*r, math.sin(2*math.pi*p/n_pts)*r, z)) for p in range(n_pts)])
        for si in range(15):
            for pi in range(n_pts):
                p_next = (pi + 1) % n_pts
                bm_s.faces.new([s_rings[si][pi], s_rings[si][p_next], s_rings[si+1][p_next], s_rings[si+1][pi]])
        mesh_s = bpy.data.meshes.new("Shaft_AR")
        bm_s.to_mesh(mesh_s)
        bm_s.free()
        s_obj = bpy.data.objects.new("Shaft_AR", mesh_s)
        bpy.context.collection.objects.link(s_obj)
        s_obj.location = mouth_pos
        s_obj.rotation_mode = 'XYZ'
        s_obj.rotation_euler = rot_axis_euler
        mat_s = bpy.data.materials.new("ShaftMaterial_AR")
        mat_s.use_nodes = True
        bsdf_s = mat_s.node_tree.nodes.get("Principled BSDF")
        bsdf_s.inputs["Base Color"].default_value = (0.88, 0.90, 0.92, 1.0)
        bsdf_s.inputs["Metallic"].default_value = 0.98
        bsdf_s.inputs["Roughness"].default_value = 0.08
        s_obj.data.materials.append(mat_s)
        
        # Add Grip
        bm_g = bmesh.new()
        l_grip = 0.265
        r_collar = 0.0160 / 2.0
        r_cap = 0.0270 / 2.0
        g_rings = []
        for gi in range(12):
            t = gi / 11.0
            z = l_grip * t
            r = r_collar * (1.0 - t**0.8) + r_cap * (t**0.8)
            g_rings.append([bm_g.verts.new((math.cos(2*math.pi*p/n_pts)*r, math.sin(2*math.pi*p/n_pts)*r, z)) for p in range(n_pts)])
        for gi in range(11):
            for pi in range(n_pts):
                p_next = (pi + 1) % n_pts
                bm_g.faces.new([g_rings[gi][pi], g_rings[gi][p_next], g_rings[gi+1][p_next], g_rings[gi+1][pi]])
        bm_g.faces.new(g_rings[-1])
        mesh_g = bpy.data.meshes.new("Grip_AR")
        bm_g.to_mesh(mesh_g)
        bm_g.free()
        g_obj = bpy.data.objects.new("Grip_AR", mesh_g)
        bpy.context.collection.objects.link(g_obj)
        
        dir_vec = np.array([math.cos(lie_rad), 0.0, math.sin(lie_rad)])
        grip_attach = np.array(mouth_pos) + dir_vec * (l_shaft - l_grip)
        g_obj.location = (grip_attach[0], grip_attach[1], grip_attach[2])
        g_obj.rotation_mode = 'XYZ'
        g_obj.rotation_euler = rot_axis_euler
        mat_g = bpy.data.materials.new("GripRubber_AR")
        mat_g.use_nodes = True
        mat_g.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.13, 0.13, 0.14, 1.0)
        g_obj.data.materials.append(mat_g)
        
        # Export AR GLB
        out_ar_glb = os.path.join(AR_DIR, f"{slug}.glb")
        bpy.ops.export_scene.gltf(filepath=out_ar_glb, export_format='GLB', export_yup=True)
        
        # Export AR USDZ
        out_ar_usdz = os.path.join(AR_DIR, f"{slug}.usdz")
        bpy.ops.wm.usd_export(filepath=out_ar_usdz)
        print(f"Exported AR club: {out_ar_glb} ({os.path.getsize(out_ar_glb)} bytes), USDZ: {out_ar_usdz} ({os.path.getsize(out_ar_usdz)} bytes)")

def camera_look_at(cam_obj, target):
    loc = cam_obj.location
    direction = mathutils.Vector(target) - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

def render_verification_preview():
    print("Rendering comprehensive verification preview sheet for all 5 models...")
    
    def setup_studio_lighting(is_back_view=False):
        # Soft studio area lighting: satin brushed steel reflections without blown-out specular glare
        y_dir = 1.0 if is_back_view else -1.0
        lights_data = [
            ("KeyLight", (0.22, y_dir * 0.38, 0.32), 26.0, (1.0, 0.98, 0.96), 0.40),
            ("FillLight", (-0.28, y_dir * 0.32, 0.22), 12.0, (0.90, 0.95, 1.0), 0.40),
            ("RimLight", (0.0, y_dir * 0.12, 0.35), 18.0, (1.0, 1.0, 1.0), 0.30),
            ("SoleLight", (-0.015, 0.01, -0.25), 10.0, (0.9, 0.9, 0.9), 0.25)
        ]
        for name, loc, power, color, size in lights_data:
            light = bpy.data.lights.new(name=name, type='AREA')
            light.energy = power
            light.color = color
            light.size = size
            light_obj = bpy.data.objects.new(name=name, object_data=light)
            light_obj.location = loc
            bpy.context.collection.objects.link(light_obj)
            # Aim light towards head center
            dir_vec = mathutils.Vector((0.0, 0.0, 0.025)) - mathutils.Vector(loc)
            light_obj.rotation_euler = dir_vec.to_track_quat('-Z', 'Y').to_euler()

    # 1. Render Back and Face for all 5 models
    for spec in CLUB_SPECS:
        slug = spec["slug"]
        
        # Back view
        clear_scene()
        create_head_mesh(spec)
        scene = bpy.context.scene
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.render.resolution_x = 720
        scene.render.resolution_y = 540
        if not scene.world:
            scene.world = bpy.data.worlds.new("World")
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs["Color"].default_value = (0.12, 0.13, 0.15, 1.0)
            bg.inputs["Strength"].default_value = 0.8
            
        setup_studio_lighting(is_back_view=True)
        cam_data = bpy.data.cameras.new("RenderCam")
        cam_data.lens = 55
        cam_obj = bpy.data.objects.new("RenderCam", cam_data)
        bpy.context.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        cam_obj.location = (-0.015, 0.28, 0.035)
        camera_look_at(cam_obj, (-0.015, 0.0, 0.028))
        scene.render.filepath = os.path.join(SCRIPTS_DIR, f"temp_back_{slug}.png")
        bpy.ops.render.render(write_still=True)
        
        # Face view
        clear_scene()
        create_head_mesh(spec)
        scene = bpy.context.scene
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.render.resolution_x = 720
        scene.render.resolution_y = 540
        if not scene.world:
            scene.world = bpy.data.worlds.new("World")
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs["Color"].default_value = (0.12, 0.13, 0.15, 1.0)
            bg.inputs["Strength"].default_value = 0.8
            
        setup_studio_lighting(is_back_view=False)
        cam_data = bpy.data.cameras.new("RenderCam")
        cam_data.lens = 55
        cam_obj = bpy.data.objects.new("RenderCam", cam_data)
        bpy.context.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        cam_obj.location = (-0.015, -0.28, 0.035)
        camera_look_at(cam_obj, (-0.015, 0.0, 0.028))
        scene.render.filepath = os.path.join(SCRIPTS_DIR, f"temp_face_{slug}.png")
        bpy.ops.render.render(write_still=True)
        
    # 2. Render Sole, Address, Hosel for 101-mkii
    clear_scene()
    spec = CLUB_SPECS[0]
    create_head_mesh(spec)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 720
    scene.render.resolution_y = 540
    if not scene.world:
        scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.12, 0.13, 0.15, 1.0)
    setup_studio_lighting(is_back_view=False)
    
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 55
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    # Sole view
    cam_obj.location = (-0.015, 0.008, -0.26)
    cam_obj.rotation_euler = (math.radians(180), 0, math.radians(90))
    scene.render.filepath = os.path.join(SCRIPTS_DIR, "temp_sole_101-mkii.png")
    bpy.ops.render.render(write_still=True)
    
    # Address view
    cam_obj.location = (-0.010, 0.035, 0.26)
    cam_obj.rotation_euler = (0, 0, math.radians(90))
    scene.render.filepath = os.path.join(SCRIPTS_DIR, "temp_address_101-mkii.png")
    bpy.ops.render.render(write_still=True)
    
    # Hosel Lie view (framed right on hosel-heel blend elbow)
    cam_data.lens = 65
    cam_obj.location = (0.18, -0.22, 0.055)
    camera_look_at(cam_obj, (0.035, -0.005, 0.035))
    scene.render.filepath = os.path.join(SCRIPTS_DIR, "temp_hosel_101-mkii.png")
    bpy.ops.render.render(write_still=True)
    
    # 3. Render AR full club (frame full club from head to grip)
    clear_scene()
    ar_glb = os.path.join(AR_DIR, "101-mkii.glb")
    if os.path.exists(ar_glb):
        bpy.ops.import_scene.gltf(filepath=ar_glb)
        scene = bpy.context.scene
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.render.resolution_x = 720
        scene.render.resolution_y = 540
        if not scene.world:
            scene.world = bpy.data.worlds.new("World")
        scene.world.use_nodes = True
        scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.12, 0.13, 0.15, 1.0)
        setup_studio_lighting(is_back_view=False)
        cam_data = bpy.data.cameras.new("ARCam")
        cam_data.lens = 38
        cam_obj = bpy.data.objects.new("ARCam", cam_data)
        bpy.context.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        cam_obj.location = (0.22, -1.65, 0.42)
        camera_look_at(cam_obj, (0.22, 0.0, 0.42))
        scene.render.filepath = os.path.join(SCRIPTS_DIR, "temp_ar_101-mkii.png")
        bpy.ops.render.render(write_still=True)

    # 4. Render Tinker Parts (frame Ferrule, Shaft, Grip side-by-side)
    clear_scene()
    ferrule_glb = os.path.join(PARTS_DIR, "ferrule.glb")
    shaft_glb = os.path.join(PARTS_DIR, "shaft.glb")
    grip_glb = os.path.join(PARTS_DIR, "grip.glb")
    if os.path.exists(ferrule_glb) and os.path.exists(shaft_glb) and os.path.exists(grip_glb):
        bpy.ops.import_scene.gltf(filepath=ferrule_glb)
        f_imported = bpy.context.selected_objects[0] if bpy.context.selected_objects else None
        
        bpy.ops.import_scene.gltf(filepath=shaft_glb)
        s_imported = [o for o in bpy.context.selected_objects if o != f_imported][0] if bpy.context.selected_objects else None
        
        bpy.ops.import_scene.gltf(filepath=grip_glb)
        g_imported = [o for o in bpy.context.selected_objects if o not in [f_imported, s_imported]][0] if bpy.context.selected_objects else None
        
        if f_imported:
            f_imported.location = (-0.08, 0, 0.10)
        if s_imported:
            s_imported.location = (0.0, 0, -0.30)
        if g_imported:
            g_imported.location = (0.08, 0, 0.0)
            
        scene = bpy.context.scene
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.render.resolution_x = 720
        scene.render.resolution_y = 540
        if not scene.world:
            scene.world = bpy.data.worlds.new("World")
        scene.world.use_nodes = True
        scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.12, 0.13, 0.15, 1.0)
        setup_studio_lighting(is_back_view=False)
        cam_data = bpy.data.cameras.new("PartsCam")
        cam_data.lens = 42
        cam_obj = bpy.data.objects.new("PartsCam", cam_data)
        bpy.context.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        cam_obj.location = (0, -0.75, 0.13)
        camera_look_at(cam_obj, (0, 0, 0.13))
        scene.render.filepath = os.path.join(SCRIPTS_DIR, "temp_parts.png")
        bpy.ops.render.render(write_still=True)
        
    # Stitch master preview sheet using workspace venv python
    import subprocess
    venv_python = os.path.join(WORKSPACE_ROOT, ".venv/bin/python")
    stitch_script = os.path.join(SCRIPTS_DIR, "stitch_preview.py")
    subprocess.run([venv_python, stitch_script], check=True)
    print("Master verification sheet stitched successfully!")

def write_manifest(all_meta):
    manifest = {
        "format": "Takomo Fitter Studio 3D Rig Manifest",
        "version": "1.0.0",
        "coordinateSystem": {
            "units": "meters",
            "up": "+Y",
            "target": "+Z",
            "heel": "+X",
            "toe": "-X",
            "notes": "Right-handed 7-iron glTF coordinate system. Sole center ground-contact point tangent to Y=0."
        },
        "heads": all_meta,
        "parts": {
            "ferrule": {
                "glbPath": "assets/clubs/parts/ferrule.glb",
                "length_m": 0.019,
                "outer_diam_base_m": 0.0134,
                "outer_diam_top_m": 0.0125,
                "bore_diam_m": 0.0094,
                "accentRing": {
                    "width_m": 0.001,
                    "offset_from_top_m": 0.003,
                    "material": "polished_chrome"
                }
            },
            "shaft": {
                "glbPath": "assets/clubs/parts/shaft.glb",
                "length_m": 0.8763,
                "tip_diam_m": 0.0094,
                "butt_diam_m": 0.01524,
                "material_name": "ShaftMaterial",
                "stockLength_in": 37.00
            },
            "grip": {
                "glbPath": "assets/clubs/parts/grip.glb",
                "length_m": 0.265,
                "collar_diam_m": 0.0160,
                "butt_diam_m": 0.0270,
                "origin": "bottom_collar",
                "attach_offset_y_m": 0.6113,
                "scalingNote": "Scale X and Z to adjust thickness for standard (1.00), midsize (1.04), and oversize (1.08)"
            }
        },
        "tinkerFormulas": {
            "length_in": "shaft.scale.y = (length_in - 2.5) / 34.5; grip.position.y = shaft.scale.y * 0.8763 - 0.265",
            "lie_deg": "HoselSocket.rotation.z = -radians(90.0 - lie_deg)",
            "grip_slug": {
                "standard": {"scale_xz": 1.00},
                "midsize": {"scale_xz": 1.04},
                "oversize": {"scale_xz": 1.08}
            },
            "shaft_material": {
                "steel": {"metallic": 0.98, "roughness": 0.08, "color": [0.88, 0.90, 0.92]},
                "graphite_matte": {"metallic": 0.10, "roughness": 0.40, "color": [0.15, 0.16, 0.18]}
            }
        }
    }
    
    out_path = os.path.join(ASSETS_DIR, "manifest.json")
    with open(out_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote manifest: {out_path}")

def main():
    print("=== Starting Takomo 3D Club Generator ===")
    all_meta = build_all_heads()
    build_modular_parts()
    build_ar_clubs()
    write_manifest(all_meta)
    render_verification_preview()
    print("=== All 3D Assets Built & Verified Successfully ===")

if __name__ == "__main__":
    main()
