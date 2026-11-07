#!/usr/bin/env python3
"""
scripts/clubs/render_studio_views.py
Automated Headless Studio Renderer for Takomo Golf irons suite.
Run via:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/clubs/render_studio_views.py
or via:
  .venv/bin/python scripts/clubs/validate_and_render_qa.py --render

Outputs:
  - assets/clubs/images/<slug>/{render_hero,render_back,render_address,render_face,render_sole}.webp
  - assets/clubs/qa/qa_5_heads_grid.png
  - assets/clubs/qa/qa_club_row.png
  - assets/clubs/qa/qa_tinker_rig.png
"""

import bpy
import mathutils
import math
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SLUGS = ['101-mkii', '201-mkii', '201t-mkii', '301-cb', '301-mb']

MODEL_LABELS = {
    '101-mkii':  ('Iron 101 MKII', 'Game Improvement Hollow-Body'),
    '201-mkii':  ('Iron 201 MKII', 'Players Distance + Tungsten'),
    '201t-mkii': ('Iron 201T MKII', 'Tour Compact Hollow-Body'),
    '301-cb':    ('Iron 301 CB', '1-Piece Forged S20C Cavity'),
    '301-mb':    ('Iron 301 MB', '1-Piece Forged S20C Blade'),
}

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 95
    return scene

def setup_studio_lighting(scene):
    if not scene.world:
        scene.world = bpy.data.worlds.new("StudioWorld")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.04, 0.04, 0.05, 1.0)
        bg.inputs["Strength"].default_value = 0.4

    lights = [
        ("KeySoftbox", 'AREA', (-0.25, 0.35, 0.35), (0.4, 0.4), 95.0, (1.0, 0.98, 0.95)),
        ("FillSoftbox", 'AREA', (0.35, -0.25, 0.25), (0.5, 0.5), 45.0, (0.85, 0.92, 1.0)),
        ("RimSoftbox", 'AREA', (0.0, -0.45, 0.40), (0.6, 0.3), 75.0, (1.0, 1.0, 1.0)),
        ("TopSoftbox", 'AREA', (0.0, 0.0, 0.55), (0.5, 0.5), 60.0, (0.95, 0.96, 1.0)),
        ("GroundBounce", 'AREA', (0.0, 0.0, -0.25), (0.6, 0.6), 25.0, (0.90, 0.90, 0.95)),
    ]
    for name, ltype, loc, size, energy, color in lights:
        ld = bpy.data.lights.new(name, type=ltype)
        ld.energy = energy
        ld.color = color
        if ltype == 'AREA':
            ld.size = size[0]
            ld.size_y = size[1]
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        bpy.context.collection.objects.link(lo)

def look_at(cam_obj, target_pt):
    direction = target_pt - cam_obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

def render_slug_views(slug):
    """Render the 5 studio views for a given slug."""
    glb_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'heads', f'{slug}.glb')
    if not os.path.exists(glb_path):
        print(f"Skipping {slug}: GLB not found at {glb_path}")
        return False

    out_dir = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'images', slug)
    os.makedirs(out_dir, exist_ok=True)

    scene = clean_scene()
    setup_studio_lighting(scene)

    # Import head GLB
    bpy.ops.import_scene.gltf(filepath=glb_path)

    # Find mesh bounds and center
    mesh_objs = [o for o in scene.objects if o.type == 'MESH']
    if not mesh_objs:
        print(f"ERROR: No mesh found in {glb_path}")
        return False

    cam_data = bpy.data.cameras.new(f"Cam_{slug}")
    cam_data.lens = 75
    cam_obj = bpy.data.objects.new(f"Cam_{slug}", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024

    target = mathutils.Vector((0.0, 0.0, 0.032))

    views = {
        'render_hero':    mathutils.Vector((-0.14, 0.17, 0.07)),
        'render_back':    mathutils.Vector((0.00, 0.22, 0.035)),
        'render_address': mathutils.Vector((0.045, -0.06, 0.30)),
        'render_face':    mathutils.Vector((0.00, -0.22, 0.035)),
        'render_sole':    mathutils.Vector((0.00, 0.03, -0.22)),
    }

    for vname, cam_pos in views.items():
        cam_obj.location = cam_pos
        if vname == 'render_address':
            cam_data.lens = 90
            direction = target - cam_obj.location
            cam_obj.rotation_euler = direction.to_track_quat('-Z', 'X').to_euler()
        else:
            cam_data.lens = 75
            look_at(cam_obj, target)

        dst_path = os.path.join(out_dir, f'{vname}.webp')
        scene.render.filepath = dst_path
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {dst_path} (1024x1024, {os.path.getsize(dst_path):,} bytes)")

    return True

def create_procedural_club_rig(parent_obj, lie_deg=62.5, is_graphite=False, midsize_grip=False):
    """Creates procedural ferrule, shaft, and grip attached to HoselSocket if parts GLBs not found."""
    # Look for HoselSocket
    socket = None
    for o in bpy.context.scene.objects:
        if 'HoselSocket' in o.name:
            socket = o
            break

    sock_pos = socket.location if socket else mathutils.Vector((0.052, -0.003, 0.056))
    lie_rad = math.radians(lie_deg)
    # Shaft axis in X-Z plane: (+cos(lie), 0, +sin(lie))
    shaft_dir = mathutils.Vector((math.cos(lie_rad), 0.0, math.sin(lie_rad))).normalized()

    # Ferrule: 19 mm length
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.0067, depth=0.019, location=sock_pos + shaft_dir * 0.0095)
    ferrule = bpy.context.active_object
    ferrule.name = "ProcFerrule"
    # Align cylinder Z with shaft_dir
    rot = mathutils.Vector((0, 0, 1)).rotation_difference(shaft_dir).to_euler()
    ferrule.rotation_euler = rot
    bpy.ops.object.shade_smooth()

    # Ferrule material: gloss black
    mat_fer = bpy.data.materials.new("Mat_Ferrule")
    mat_fer.use_nodes = True
    bsdf_fer = mat_fer.node_tree.nodes.get("Principled BSDF")
    if bsdf_fer:
        bsdf_fer.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1.0)
        bsdf_fer.inputs["Roughness"].default_value = 0.15
    ferrule.data.materials.append(mat_fer)

    # Shaft: length 0.85 m
    shaft_len = 0.85
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.0055, depth=shaft_len, location=sock_pos + shaft_dir * (0.019 + shaft_len/2))
    shaft = bpy.context.active_object
    shaft.name = "ProcShaft"
    shaft.rotation_euler = rot
    bpy.ops.object.shade_smooth()

    mat_shaft = bpy.data.materials.new("Mat_Shaft")
    mat_shaft.use_nodes = True
    bsdf_sh = mat_shaft.node_tree.nodes.get("Principled BSDF")
    if bsdf_sh:
        if is_graphite:
            # Matte dark carbon graphite
            bsdf_sh.inputs["Base Color"].default_value = (0.08, 0.08, 0.09, 1.0)
            bsdf_sh.inputs["Metallic"].default_value = 0.4
            bsdf_sh.inputs["Roughness"].default_value = 0.35
        else:
            # Polished chrome steel
            bsdf_sh.inputs["Base Color"].default_value = (0.95, 0.95, 0.95, 1.0)
            bsdf_sh.inputs["Metallic"].default_value = 1.0
            bsdf_sh.inputs["Roughness"].default_value = 0.12
    shaft.data.materials.append(mat_shaft)

    # Grip: length 0.27 m
    grip_len = 0.27
    grip_rad = 0.0145 if midsize_grip else 0.0135
    grip_pos = sock_pos + shaft_dir * (0.019 + shaft_len - grip_len/2)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=grip_rad, depth=grip_len, location=grip_pos)
    grip = bpy.context.active_object
    grip.name = "ProcGrip"
    grip.rotation_euler = rot
    bpy.ops.object.shade_smooth()

    mat_grip = bpy.data.materials.new("Mat_Grip")
    mat_grip.use_nodes = True
    bsdf_gr = mat_grip.node_tree.nodes.get("Principled BSDF")
    if bsdf_gr:
        bsdf_gr.inputs["Base Color"].default_value = (0.05, 0.05, 0.05, 1.0)
        bsdf_gr.inputs["Roughness"].default_value = 0.85
    grip.data.materials.append(mat_grip)

def render_qa_club_row():
    """Render all 5 heads sitting side-by-side on reflective studio floor."""
    scene = clean_scene()
    scene.render.film_transparent = False

    # Studio background
    scene.world = bpy.data.worlds.new("World_ClubRow")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.06, 0.07, 0.09, 1.0)
        bg.inputs["Strength"].default_value = 0.3

    # Add reflective floor plane
    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "ReflectiveFloor"
    mat_floor = bpy.data.materials.new("Mat_Floor")
    mat_floor.use_nodes = True
    bsdf_fl = mat_floor.node_tree.nodes.get("Principled BSDF")
    if bsdf_fl:
        bsdf_fl.inputs["Base Color"].default_value = (0.05, 0.06, 0.07, 1.0)
        bsdf_fl.inputs["Metallic"].default_value = 0.3
        bsdf_fl.inputs["Roughness"].default_value = 0.18
    floor.data.materials.append(mat_floor)

    # Overhead studio softbox
    ld = bpy.data.lights.new("StripLight", type='AREA')
    ld.energy = 280.0
    ld.size = 3.0
    ld.size_y = 1.0
    ld.color = (1.0, 0.98, 0.95)
    lo = bpy.data.objects.new("StripLight", ld)
    lo.location = (0.0, 0.4, 1.3)
    lo.rotation_euler = (math.radians(-25), 0, 0)
    scene.collection.objects.link(lo)

    # Key and Rim lights
    lkey = bpy.data.lights.new("Key", type='AREA')
    lkey.energy = 160.0
    lkey.size = 1.2
    lok = bpy.data.objects.new("Key", lkey)
    lok.location = (-1.2, 0.8, 0.9)
    scene.collection.objects.link(lok)

    lrim = bpy.data.lights.new("Rim", type='AREA')
    lrim.energy = 140.0
    lrim.size = 1.5
    lor = bpy.data.objects.new("Rim", lrim)
    lor.location = (1.2, -0.6, 0.8)
    scene.collection.objects.link(lor)

    # Position heads side by side
    spacing = 0.16
    for i, slug in enumerate(SLUGS):
        glb_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'heads', f'{slug}.glb')
        if not os.path.exists(glb_path):
            continue

        prev_objs = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=glb_path)
        new_objs = set(scene.objects) - prev_objs

        x_offset = -(i - 2) * spacing
        for o in new_objs:
            o.location.x += x_offset

    # Panoramic camera
    cam_data = bpy.data.cameras.new("Cam_ClubRow")
    cam_data.lens = 45  # wider lens to comfortably fit all 5 heads
    cam_obj = bpy.data.objects.new("Cam_ClubRow", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    cam_obj.location = (0.0, 1.35, 0.36)
    target = mathutils.Vector((0.0, 0.0, 0.04))
    look_at(cam_obj, target)

    scene.render.resolution_x = 2400
    scene.render.resolution_y = 900
    scene.render.image_settings.file_format = 'PNG'
    out_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa', 'qa_club_row.png')
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_path} ({scene.render.resolution_x}x{scene.render.resolution_y})")

def add_shaft_lighting(scene):
    """Add strip lighting along the length of the shaft and grip for clear studio visibility."""
    l_tall = bpy.data.lights.new("TallShaftLight", type='AREA')
    l_tall.energy = 160.0
    l_tall.size = 0.25
    l_tall.size_y = 1.4
    l_tall.color = (0.98, 0.98, 1.0)
    lo_tall = bpy.data.objects.new("TallShaftLight", l_tall)
    lo_tall.location = (0.25, -0.9, 0.55)
    lo_tall.rotation_euler = (math.radians(-70), 0, math.radians(-15))
    scene.collection.objects.link(lo_tall)

    l_rim = bpy.data.lights.new("ShaftRimLight", type='AREA')
    l_rim.energy = 110.0
    l_rim.size = 0.2
    l_rim.size_y = 1.2
    l_rim.color = (0.90, 0.95, 1.0)
    lo_rim = bpy.data.objects.new("ShaftRimLight", l_rim)
    lo_rim.location = (0.45, 0.8, 0.55)
    lo_rim.rotation_euler = (math.radians(70), 0, math.radians(165))
    scene.collection.objects.link(lo_rim)

def render_qa_tinker_rig():
    """Render 3-panel tinker rig contact sheet frames."""
    head_path = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'heads', '101-mkii.glb')
    if not os.path.exists(head_path):
        print(f"Skipping qa_tinker_rig: {head_path} not found")
        return

    # Panel A: Stock Steel 0° Lie
    scene = clean_scene()
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("World_TinkerA")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.07, 0.08, 0.10, 1.0)
        bg.inputs["Strength"].default_value = 0.5
    setup_studio_lighting(scene)
    add_shaft_lighting(scene)

    bpy.ops.import_scene.gltf(filepath=head_path)
    create_procedural_club_rig(None, lie_deg=62.5, is_graphite=False, midsize_grip=False)

    cam_data_a = bpy.data.cameras.new("Cam_TinkerA")
    cam_data_a.lens = 52
    cam_obj_a = bpy.data.objects.new("Cam_TinkerA", cam_data_a)
    scene.collection.objects.link(cam_obj_a)
    scene.camera = cam_obj_a

    cam_obj_a.location = (0.35, -1.8, 0.50)
    target = mathutils.Vector((0.25, 0.0, 0.45))
    look_at(cam_obj_a, target)

    scene.render.resolution_x = 800
    scene.render.resolution_y = 1200
    scene.render.image_settings.file_format = 'PNG'
    path_a = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa', 'tinker_panel_a.png')
    scene.render.filepath = path_a
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path_a}")

    # Panel B: Custom Graphite +3° Lie
    scene = clean_scene()
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1200
    scene.world = bpy.data.worlds.new("World_TinkerB")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.07, 0.08, 0.10, 1.0)
        bg.inputs["Strength"].default_value = 0.5
    setup_studio_lighting(scene)
    add_shaft_lighting(scene)

    bpy.ops.import_scene.gltf(filepath=head_path)
    create_procedural_club_rig(None, lie_deg=65.5, is_graphite=True, midsize_grip=True)

    cam_data_b = bpy.data.cameras.new("Cam_TinkerB")
    cam_data_b.lens = 52
    cam_obj_b = bpy.data.objects.new("Cam_TinkerB", cam_data_b)
    scene.collection.objects.link(cam_obj_b)
    scene.camera = cam_obj_b
    cam_obj_b.location = (0.35, -1.8, 0.50)
    look_at(cam_obj_b, target)

    path_b = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa', 'tinker_panel_b.png')
    scene.render.filepath = path_b
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path_b}")

    # Panel C: Macro Hosel / Ferrule close-up
    scene = clean_scene()
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1200
    scene.world = bpy.data.worlds.new("World_TinkerC")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.07, 0.08, 0.10, 1.0)
        bg.inputs["Strength"].default_value = 0.5
    setup_studio_lighting(scene)

    bpy.ops.import_scene.gltf(filepath=head_path)
    create_procedural_club_rig(None, lie_deg=62.5, is_graphite=False, midsize_grip=False)

    cam_data_macro = bpy.data.cameras.new("Cam_Macro")
    cam_data_macro.lens = 135
    cam_obj_c = bpy.data.objects.new("Cam_Macro", cam_data_macro)
    scene.collection.objects.link(cam_obj_c)
    scene.camera = cam_obj_c

    cam_obj_c.location = (0.08, -0.16, 0.08)
    target_macro = mathutils.Vector((0.052, 0.0, 0.065))
    look_at(cam_obj_c, target_macro)

    path_c = os.path.join(PROJECT_ROOT, 'assets', 'clubs', 'qa', 'tinker_panel_c.png')
    scene.render.filepath = path_c
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path_c}")

def main():
    print("=" * 60)
    print(" TAKOMO HEADLESS BLENDER STUDIO RENDERER")
    print("=" * 60)

    rendered_count = 0
    for slug in SLUGS:
        ok = render_slug_views(slug)
        if ok:
            rendered_count += 1

    print(f"\nRendered single views for {rendered_count}/{len(SLUGS)} club heads.")

    print("\n--- Rendering QA 3D Scenes ---")
    try:
        render_qa_club_row()
    except Exception as e:
        print(f"qa_club_row error: {e}")

    try:
        render_qa_tinker_rig()
    except Exception as e:
        print(f"qa_tinker_rig error: {e}")

    print("\nBlender rendering suite complete.")

if __name__ == '__main__':
    main()
