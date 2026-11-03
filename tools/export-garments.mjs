// Exports MG's built-in garments as .glb files that follow MODEL_BRIEF.md, into models/.
//
//   npm install && node tools/export-garments.mjs            # every product
//   node tools/export-garments.mjs hoodie joggers             # some products
//
// The files can also be opened in Blender (File → Import → glTF) as a base for a more detailed model.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STYLES, buildGarment } from '../garment.js';

// GLTFExporter runs in browsers; Node has Blob but not FileReader, so provide the two calls it uses.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,` + Buffer.from(await blob.arrayBuffer()).toString('base64');
    this.onloadend?.();
  }
};

const OUT = fileURLToPath(new URL('../models/', import.meta.url));
const METERS_PER_UNIT = 0.27;   // garment.js units → meters (a top's body is ≈ 54 cm wide)

// Plain materials; the studio replaces them with its fabric shader. Names carry the roles:
// "print" = printable surface, "rib" = ribbed knit, "trim" = keeps its own color.
const mat = (name, props) => new THREE.MeshStandardMaterial({ name, roughness: 0.9, ...props });
const materials = {
  torso: mat('Fabric_print', { color: 0xffffff }),
  fabric: mat('Fabric', { color: 0xffffff }),
  rib: mat('Rib', { color: 0xe0e0e0 }),
  string: mat('Drawstring_trim', { color: 0xf4f4f0 }),
  tip: mat('Metal_trim', { color: 0xc9ccd1, metalness: 0.8, roughness: 0.3 }),
};

async function exportProduct(product) {
  const { group, torso, bottom } = buildGarment(product, materials);

  // three.js UVs start at the bottom; glTF UVs start at the top. Flip so the top of the garment
  // is at the top of the UV image, as the brief requires.
  const uv = torso.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));

  // Real-world size in meters, standing on the ground (y = 0).
  const root = new THREE.Group();
  root.scale.setScalar(METERS_PER_UNIT);
  root.position.y = -bottom * METERS_PER_UNIT;
  root.add(group);
  const scene = new THREE.Scene();
  scene.add(root);

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}${product}.glb`, Buffer.from(glb));
  console.log(`${product.padEnd(17)} models/${product}.glb  ${(glb.byteLength / 1024 / 1024).toFixed(1)} MB`);
}

const products = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STYLES);
for (const p of products) await exportProduct(p);
