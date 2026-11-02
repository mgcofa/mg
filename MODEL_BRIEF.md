# 3D garment model brief — MG

We run a web-based 3D clothing customizer (Three.js). Customers rotate the garment and print their own
designs on it. We need realistic, web-ready garment models.

## Garments
1. Pullover hoodie (hood down, lying on the back, kangaroo pocket, drawstrings)
2. Crewneck sweatshirt
3. (later) Tracksuit: zip jacket + jogger pants

Unisex regular fit, size M, "ghost mannequin" style (no body, no hanger), arms relaxed down at ~20°.
Cotton fleece look with natural folds, seams, ribbed cuffs/hem/collar.

## Deliverables (per garment)
- `.glb` (glTF binary), **max 15 MB**, ideally under 50k triangles; Draco compression welcome.
- Source file (`.zprj` for CLO3D/Marvelous Designer, or `.blend`).
- Textures baked into the GLB: **normal map** (folds, stitching, knit) and optionally roughness and AO.
  **No color / base-color texture with baked color** — we tint the fabric in code to any color.

## Technical requirements (important)
- Real-world scale in meters, garment centered on the origin, **front facing +Z**, up = +Y.
- Split into meshes so we can recolor and print correctly:
  - `Body_print` — front and back body panels (the printable surface). Material name must contain `print`.
  - `Sleeves`, `Hood`, `Pocket` (for the hoodie) — tinted to the customer's color.
  - Names containing `rib` (cuffs, hem, collar) — tinted slightly darker, ribbed knit look.
  - Names containing `trim` (drawstrings, aglets, zippers) — keep their own material and color.
- Reference: `storage/app/public/models/hoodie.glb` and `crew.glb` are our current simple versions that
  follow these rules; open them in Blender to see the expected naming, scale and orientation.
- **UV layout of `Body_print`** (one 0–1 UV square, top of the garment at the top of the UV image):
  - **left half (U 0–0.5) = front panel**, **right half (U 0.5–1) = back panel**, as seen from outside
    (not mirrored).
  - Each half keeps the panel's real proportions, about **11:9 (width:height)**, with no stretching in the
    chest/back area where prints go.
  - Side seams at U = 0, 0.5 and 1.
- Clean, non-overlapping UVs on all other meshes too (for the normal map).

## License
Commercial use in a public web 3D viewer/configurator for our store (the .glb file is loaded in the
customer's browser). Please confirm in writing that this use is allowed.
