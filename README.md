# MG — design your own clothes

Static website: customers design hoodies, sweatshirts and sweatpants in 3D, then order on WhatsApp.
No server needed; it runs on GitHub Pages or any free static hosting.

## Edit the shop
Everything is in [`config.js`](config.js): WhatsApp number, prices, print price, 2XL surcharge, bulk discounts
and the 3D model files.

## How ordering works
1. The customer designs the garment, picks sizes and fills in name, phone and address.
2. The site downloads `MG-XXXXX.zip` to their device: order sheet, high-resolution print files (≈3600 px,
   transparent PNG), 3D previews and the editable design (`design.json`).
3. WhatsApp opens on the shop's number with the order details already written; the customer sends it and
   attaches the zip in the same chat. Payment is cash on delivery.

## Files
- `index.html` — the studio (Three.js 3D view, Fabric.js design editor)
- `garment.js` — the built-in 3D garments and how designs map onto them
- `i18n.js` — Arabic / English text
- `logos/` — ready-made logos ([Tabler Icons](https://tabler.io/icons), MIT, plus MG's own designs)
- `models/` — `.glb` 3D models (see [MODEL_BRIEF.md](MODEL_BRIEF.md) to replace them with more detailed ones)
- `tools/` — rebuild models and logos: `npm install`, then `npm run export-models` or `node tools/build-logos.mjs`

## Run locally
Any static server, e.g. `python3 -m http.server` in this folder, then open http://localhost:8000.
