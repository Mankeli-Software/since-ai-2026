# Takomo Golf 7-Iron Heads — 3D Industrial Design & Dimensional Blueprint

> Compiled for Issue #3 (`feat/3-club-3d-models`). Verify final badging/stamp placements against real reference photos in `scripts/clubs/ref_images/` once collected.

## 1. Master Comparative Specifications Table (7-Iron)

| Parameter | `101-mkii` | `201-mkii` | `201t-mkii` | `301-cb` | `301-mb` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Name** | Iron 101 MKII | Iron 201 MKII | Iron 201T MKII | Iron 301 CB | Iron 301 MB |
| **Category** | Game Improvement | Players Distance | Compact Players | Forged Cavity Back | Muscle Back Blade |
| **Construction** | Hollow-body 17-4/431 SS | Hollow-body + Tungsten | Compact Hollow-body | 1-piece Forged S20C | 1-piece Forged S20C |
| **Loft (deg)** | **29.0** | **31.0** | **33.0** | **34.0** | **34.0** |
| **Standard Lie (deg)** | **62.5** | **62.0** | **62.5** | **62.5** | **62.5** |
| **Offset (mm)** | **3.40** | **2.77** | **2.46** | **1.80** | **1.80** |
| **Head Weight (g)** | 272.0 | 270.0 | 270.0 | 267.0 | 267.0 |
| **Std Club Length (in)** | 37.00 | 37.00 | 37.00 | 37.00 | 37.00 |
| **Bounce (deg)** | 3.0 (Skid Sole) | 3.5 | 4.0 | 4.5 | 4.5 |
| **Blade Length (mm)** | **78.8** | **77.0** | **74.8** | **71.0** | **71.0** |
| **Topline Width (mm)** | **7.0 (5.1 visual)** | **5.8** | **5.0** | **4.5** | **4.5** |
| **Sole Width (mm)** | **21.5** | **18.5** | **16.0** | **15.0** | **13.0** |
| **Hosel Bore (in)** | .370" Parallel | .370" Parallel | .370" Parallel | .370" Parallel | .370" Parallel |
| **Toe Weight Screw** | Yes (flush screw) | Yes (flush screw) | Yes (flush screw) | None (solid forge) | None (solid forge) |

## 2. Shared Hosel, Ferrule, Face & Sole Details

- **Hosel:** Outer diameter `13.4 mm` at top lip tapering smoothly to `12.8 mm` into heel blend; `~63.5 mm` along lie axis from ground plane to hosel mouth.
- **Ferrule (`parts/ferrule.glb`):** `19.0 mm` gloss black body with a `1.0 mm` polished silver/chrome accent ring `3.0 mm` down from top edge.
- **Face & Grooves:** 14 horizontal scorelines (`0.90 mm` wide, `2.8 mm` pitch), framed by a matte micro-sandblast impact zone with hairline horizontal brushed metal on toe/heel perimeter.
- **Sole Number (`7`):** Clean geometric sans-serif `7` centered on sole towards leading edge, semi-gloss black paint fill.

## 3. Shared glTF Asset Coordinate System (`Issue #3` Contract)

- **Units:** `1.0 = 1 meter`
- **Origin `(0, 0, 0)`:** Sole center ground-contact point at standard 7-iron address (`lie_delta = 0°`), resting tangent to `Y = 0`
- **Axes:** `+Y` up, `+Z` target line (clubface pointing `+Z` tilted upward by `seven_iron_loft_deg`), `+X` toe-ward / `-X` heel-ward
- **`HoselSocket` Empty Node:** Positioned at the top center of the hosel bore, with local `+Y` aligned along the shaft axis (`~62.0°–62.5°` from horizontal in the `X-Y` plane, shifted forward in `+Z` by `seven_iron_offset_mm` relative to face leading edge).
