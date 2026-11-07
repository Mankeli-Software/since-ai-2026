# Takomo 7-Iron 3D & Studio Image Asset Kit (`Issue #3`)

Complete 3D mesh, modular Tinker-Mode rig, AR Quick Look, and multi-angle `.webp` cutout kit for the 5 Takomo Golf 7-iron heads in [`takomo_products.json`](../../data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026/takomo_official/takomo_products.json):

- `101-mkii` — Iron 101 MKII (`29.0°` loft, `3.40 mm` offset, hollow-body GI)
- `201-mkii` — Iron 201 MKII (`31.0°` loft, `2.77 mm` offset, hollow-body players distance)
- `201t-mkii` — Iron 201T MKII (`33.0°` loft, `2.46 mm` offset, compact tour hollow-body)
- `301-cb` — Iron 301 CB (`34.0°` loft, `1.80 mm` offset, forged S20C CNC cavity back)
- `301-mb` — Iron 301 MB (`34.0°` loft, `1.80 mm` offset, forged S20C muscle-back blade)

---

## Directory Structure

```text
assets/clubs/
├── manifest.json                 # Master index: specs, HoselSocket transforms, anchors, cameraPresets, image paths
├── heads/<slug>.glb              # Head-only PBR glTF (~1.2 MB each, meters, includes Empty node "HoselSocket")
├── parts/
│   ├── ferrule.glb               # 19 mm gloss-black collar + chrome accent ring (origin at HoselSocket, +Y axis)
│   ├── shaft.glb                 # Tapered 0.876 m shaft (material "ShaftMaterial", origin at HoselSocket, +Y axis)
│   └── grip.glb                  # 265 mm rubber grip (origin at grip collar; scale X/Z for standard/midsize/oversize)
├── ar/<slug>.{glb,usdz}          # Pre-assembled 37.0" 7-iron for Android Scene Viewer (.glb) & iOS Quick Look (.usdz)
├── images/<slug>/                # 12 normalized .webp views per slug (transparent studio photos, renders & field refs)
└── qa/                           # Automated visual & dimensional QA contact sheets
```

---

## Coordinate System & Three.js Tinker Rig Usage

All `heads/<slug>.glb` share a right-handed metric coordinate frame (`1.0 = 1 meter`):
- **Origin `(0, 0, 0)`:** Sole center ground-contact point at standard address (`lie_delta = 0°`), tangent to `Y = 0`.
- **Axes:** `+Y` up, `+Z` target / ball-flight direction, `+X` heel / golfer side, `-X` toe side.
- **Left-handed golfers:** Mirror the root club group on `X` (`clubGroup.scale.x = -1`).

### Assembling & Driving Tinker Mode (`VISION.md` §6.8)

1. Load `heads/<slug>.glb` and locate `const socket = headScene.getObjectByName("HoselSocket")` (or read `manifest.heads[slug].hoselSocket`).
2. Parent `ferrule.glb` and `shaft.glb` directly to `socket` at local `(0, 0, 0)`.
3. Place `grip.glb` as a child of `socket` at `y = shaftLength * lengthScale - 0.265` and apply radial thickness scale:
   - `standard`: `scale.set(1.00, 1.0, 1.00)`
   - `midsize`: `scale.set(1.04, 1.0, 1.04)`
   - `oversize`: `scale.set(1.08, 1.0, 1.08)`
4. **Length (`-1.5"` to `+1.5"`):** `const lenScale = 1 + (lengthIn * 0.0254) / 0.8763; shaft.scale.y = lenScale;`
5. **Lie (`-3°` flat to `+3°` upright):** Rotate the root club group around the target-line sole contact axis (`Z`): `clubRoot.rotation.z = THREE.MathUtils.degToRad(-lieDeltaDeg)` (positive upright lifts the toe / steepens the shaft toward `+Y`).
6. **Shaft material (`steel` vs `graphite`):** Update `ShaftMaterial` (`metalness: 0.96, roughness: 0.14, color: "#d8dde2"` for chrome steel vs `metalness: 0.25, roughness: 0.42, color: "#22252a"` for matte carbon graphite).

---

## Regenerating & Validating Assets

```bash
# 1. Regenerate 2048x2048 procedural PBR maps (albedo, roughness, metallic, normal)
.venv/bin/python scripts/clubs/generate_pbr_maps.py

# 2. Rebuild all .glb/.usdz heads, modular parts, AR clubs & manifest.json
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/clubs/build_clubs.py

# 3. Re-normalize studio photo cutouts (requires local scripts/clubs/ref_images/)
.venv/bin/python scripts/clubs/prepare_assets.py

# 4. Run 77-check geometry/glTF validator + headless studio renders + QA sheets
.venv/bin/python scripts/clubs/validate_and_render_qa.py
```
