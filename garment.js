// MG garment geometry: every product's built-in 3D model, plus how designs map onto it.
// Shared by the studio (browser) and tools/export-garments.mjs (Node), which saves them as .glb files.
// Units: 1 ≈ 27 cm. Front faces +Z, up is +Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One side (front or back) of the design editor, in px.
export const EW = 440, EH = 360;

const Y1 = 1.22, SHOULDER = 0.75;            // tops: neckline and shoulder heights
const PANTS = { top: 1.56, crotch: 0.72, halfWidth: 1.1 };

// ---------- Products ----------
const TOP = {
  kind: 'top', width: 1, depth: 1, y0: -1.3, sleeveLen: 1.8, sleeveR: 1, drop: 0,
  hood: false, collar: 'crew', pocket: null, zip: null,
};
export const STYLES = {
  hoodie:           { ...TOP, category: 'hoodies', hood: true, collar: null, pocket: 'kangaroo' },
  hoodie_zip:       { ...TOP, category: 'hoodies', hood: true, collar: null, pocket: 'split', zip: 'full' },
  hoodie_oversized: { ...TOP, category: 'hoodies', hood: true, collar: null, pocket: 'kangaroo', width: 1.12, depth: 1.08, y0: -1.5, sleeveLen: 1.86, sleeveR: 1.12, drop: 0.18 },
  hoodie_cropped:   { ...TOP, category: 'hoodies', hood: true, collar: null, width: 0.96, depth: 0.97, y0: -0.6 },
  crew:             { ...TOP, category: 'sweatshirts' },
  crew_oversized:   { ...TOP, category: 'sweatshirts', width: 1.12, depth: 1.08, y0: -1.5, sleeveLen: 1.86, sleeveR: 1.12, drop: 0.18 },
  quarter_zip:      { ...TOP, category: 'sweatshirts', collar: 'stand', zip: 'quarter' },
  joggers:          { kind: 'pants', category: 'pants', leg: 'jogger', bottom: -1.95 },
  sweatpants:       { kind: 'pants', category: 'pants', leg: 'straight', bottom: -2.02 },
  shorts:           { kind: 'pants', category: 'pants', leg: 'shorts', bottom: 0.0 },
};
export const CATEGORIES = ['hoodies', 'sweatshirts', 'pants'];
export const styleOf = product => STYLES[product] || STYLES.hoodie;

// ---------- Helpers ----------
export const smooth01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Smooth 3D value noise (deterministic), used to make folds irregular like real fabric.
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = v => v * v * (3 - 2 * v), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const h = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), u), lerp(h(0, 1, 0), h(1, 1, 0), u), v),
              lerp(lerp(h(0, 0, 1), h(1, 0, 1), u), lerp(h(0, 1, 1), h(1, 1, 1), u), v), w);
}

// Average the normals of duplicated vertices on a wrap-around seam so shading stays smooth.
function smoothSeam(g, rows, seg) {
  const n = g.attributes.normal, a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const i0 = r * (seg + 1), i1 = i0 + seg;
    a.fromBufferAttribute(n, i0).add(b.fromBufferAttribute(n, i1)).normalize();
    n.setXYZ(i0, a.x, a.y, a.z); n.setXYZ(i1, a.x, a.y, a.z);
  }
}
// Grid mesh from (rows+1) × (seg+1) vertices, rows going up and columns going around counter-clockwise.
// Without explicit UVs the grid itself is used (for the fabric texture).
function gridGeometry(pos, uv, rows, seg, wrap = true) {
  const idx = [];
  for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  if (!uv) {
    uv = [];
    for (let r = 0; r <= rows; r++) for (let s = 0; s <= seg; s++) uv.push(s / seg, r / rows);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (wrap) smoothSeam(g, rows, seg);
  return g;
}

// ---------- Design mapping ----------
// Tops: the printable body wraps around (u 0–0.5 = front panel, 0.5–1 = back panel). The design canvas
// covers the body's full height and keeps the canvas aspect ratio, so designs never stretch.
const topSpan = st => Math.PI * st.width * EH / EW;          // body height covered by the canvas
const topV = (y, st) => (y - (Y1 - topSpan(st))) / topSpan(st);
// Pants: a flat front view and a flat back view of hips and thighs (x ∈ ±1.1, from the waist down).
const pantsScale = EW / (2 * PANTS.halfWidth);               // canvas px per unit
const pantsV = y => 1 - (PANTS.top - y) * pantsScale / EH;

// Elliptical cross-section radii (width a, depth b) of a top's body at height y.
export function radii(y, st = STYLES.crew) {
  const k = smooth01((Math.min(y, SHOULDER) - st.y0) / (0.93 * (SHOULDER - st.y0)));
  let a = (0.92 + 0.08 * k) * st.width, b = (0.53 + 0.04 * k) * st.depth;
  if (y > SHOULDER) {
    const t = (y - SHOULDER) / (Y1 - SHOULDER);
    a -= (a - 0.4) * t * t;    // vertical side wall rolling into a gentle shoulder slope
    b -= (b - 0.34) * t * t;
  }
  return [a, b];
}

// A point on the garment (local x, y) → design-canvas px on the given side.
export function worldToCanvas(product, side, x, y) {
  const st = styleOf(product);
  if (st.kind === 'pants') {
    return [(side === 'front' ? x + PANTS.halfWidth : PANTS.halfWidth - x) * pantsScale, (PANTS.top - y) * pantsScale];
  }
  const [a] = radii(y, st), q = Math.asin(Math.max(-1, Math.min(1, x / a)));
  const u = side === 'front' ? (q + Math.PI / 2) / Math.PI : (Math.PI / 2 - q) / Math.PI;
  return [u * EW, (1 - topV(y, st)) * EH];
}
function rect(product, side, x0, x1, yTop, yBot) {
  const pts = [[x0, yTop], [x1, yTop], [x0, yBot], [x1, yBot]].map(([x, y]) => worldToCanvas(product, side, x, y));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.round(Math.min(...xs)), y = Math.round(Math.min(...ys));
  return { x, y, w: Math.round(Math.max(...xs)) - x, h: Math.round(Math.max(...ys)) - y };
}

// Where printing is allowed on each side, in design-canvas px.
export function printAreas(product) {
  const st = styleOf(product);
  if (st.kind === 'pants') {
    return {
      front: st.leg === 'shorts' ? rect(product, 'front', 0.2, 0.8, 1.1, 0.3) : rect(product, 'front', 0.22, 0.8, 1.05, 0.0),   // wearer's left thigh
      back: rect(product, 'back', -0.8, 0.8, 1.35, 0.75),                                                                      // across the seat
    };
  }
  const w = st.width;
  let front;
  if (st.zip === 'full') front = rect(product, 'front', 0.16 * w, 0.62 * w, 0.66, 0.2);   // left chest, beside the zip
  else if (st.zip === 'quarter') front = rect(product, 'front', -0.6 * w, 0.6 * w, 0.42, Math.max(st.y0 + 0.45, -0.75));
  else front = rect(product, 'front', -0.6 * w, 0.6 * w, 0.7, st.pocket ? -0.36 : Math.max(st.y0 + 0.4, -0.75));
  return { front, back: rect(product, 'back', -0.66 * w, 0.66 * w, st.hood ? 0.62 : 0.75, Math.max(st.y0 + 0.4, -0.9)) };
}

// Stitch lines drawn on the front: pocket outlines (polygons) and pocket openings (shadowed lines), in canvas px.
export function pocketOutlines(product) {
  const st = styleOf(product), map = pts => pts.map(([x, y]) => worldToCanvas(product, 'front', x, y));
  if (st.pocket === 'kangaroo') {
    const p = map([[-0.55, -0.42], [0.55, -0.42], [0.74, -0.82], [0.74, -1.14], [-0.74, -1.14], [-0.74, -0.82]]);
    return { polys: [p], openings: [[p[0], p[5]], [p[1], p[2]]] };
  }
  if (st.pocket === 'split') {
    const l = map([[-0.55, -0.42], [-0.06, -0.42], [-0.06, -1.14], [-0.74, -1.14], [-0.74, -0.82]]);
    const r = map([[0.06, -0.42], [0.55, -0.42], [0.74, -0.82], [0.74, -1.14], [0.06, -1.14]]);
    return { polys: [l, r], openings: [[l[0], l[4]], [r[1], r[2]]] };
  }
  if (st.kind === 'pants') {
    return { polys: [], openings: [map([[-0.66, 1.37], [-0.93, 0.95]]), map([[0.66, 1.37], [0.93, 0.95]])] };
  }
  return { polys: [], openings: [] };
}

// ---------- Tops ----------
// The kangaroo pocket is a separate sewn-on panel, so it stands slightly proud of the body.
function pocketLift(x, y, z, kind) {
  if (!kind || z <= 0) return 0;
  const top = -0.42, bottom = -1.14;
  const half = y > -0.82 ? 0.55 + 0.19 * (top - y) / 0.4 : 0.74;
  let e = Math.min(half - Math.abs(x), top - y, y - bottom);
  if (kind === 'split') e = Math.min(e, Math.abs(x) - 0.06);          // gap for the zip
  return e <= 0 ? 0 : 0.016 * smooth01(e / 0.03);
}

// How far the fabric surface moves in or out (along its normal) to form folds.
function foldOffset(th, x, y, z, st) {
  let d = 0;
  // Fabric puffs out just above the ribbed hem, and is gathered in under it.
  d += 0.045 * Math.exp(-(((y - (st.y0 + 0.33)) / 0.15) ** 2)) - 0.035 * smooth01((st.y0 + 0.22 - y) / 0.12);
  // Soft vertical drape folds in the lower body.
  const lower = smooth01((0.15 - y) / 1.0);
  d += lower * 0.02 * (0.6 * Math.sin(th * 9 + 1.3 + 0.8 * Math.sin(th * 2)) + 0.4 * Math.sin(th * 14 + 0.4))
       * (0.5 + noise3(x * 2, y * 1.5, z * 2));
  // Diagonal pull wrinkles running from the armpits down the sides.
  const sideW = Math.abs(Math.sin(th)) ** 6;
  d += sideW * smooth01(y / 0.4) * smooth01((0.85 - y) / 0.2) * 0.016 * Math.sin(y * 14 + Math.sign(Math.sin(th)) * th * 3);
  // Low-frequency unevenness so it doesn't look machine-perfect.
  d += 0.014 * (noise3(x * 1.3 + 5, y * 1.1, z * 1.3) - 0.5);
  return d + pocketLift(x, y, z, st.pocket);
}

// Body: built smooth, then every vertex is pushed along its normal by foldOffset().
function torsoGeometry(st) {
  const SEG = 160, ROWS = 160;
  const pos = [], uv = [], ths = [];
  for (let r = 0; r <= ROWS; r++) {
    const y = st.y0 + (r / ROWS) * (Y1 - st.y0);
    const [a, b] = radii(y, st);
    for (let s = 0; s <= SEG; s++) {
      const u = s / SEG, th = -Math.PI / 2 + u * Math.PI * 2;
      pos.push(a * Math.sin(th), y, b * Math.cos(th));
      uv.push(u, topV(y, st));
      ths.push(th);
    }
  }
  const g = gridGeometry(pos, uv, ROWS, SEG);
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = foldOffset(ths[i], x, y, z, st);
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  g.computeVertexNormals();
  smoothSeam(g, ROWS, SEG);
  return g;
}

// Sleeve: a tube along a gently bent arm line, with elbow creases and fabric bunched above the cuff.
function sleeveGeometry(side, st) {
  const k = st.sleeveLen / 1.8, R = st.sleeveR;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.6 * k, 0.02),
    new THREE.Vector3(-side * 0.06, -1.2 * k, 0.1), new THREE.Vector3(-side * 0.15, -1.72 * k, 0.15),
  ]);
  const TS = 90, RS = 48;
  const frames = curve.computeFrenetFrames(TS, false);
  const pos = [], P = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i <= TS; i++) {
    const t = i / TS;
    curve.getPointAt(t, P);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= RS; j++) {
      const phi = j / RS * Math.PI * 2;
      let r = lerp(0.31 * R, 0.235 * Math.min(R, 1.05), smooth01(t / 0.85));
      r += 0.024 * smooth01((t - 0.74) / 0.06) * (1 - smooth01((t - 0.95) / 0.03)) * (0.5 + 0.5 * Math.sin(t * 70 + 2 * Math.sin(phi * 2)));
      r += 0.014 * Math.exp(-(((t - 0.5) / 0.09) ** 2)) * Math.sin(phi * 3 + t * 30);
      r -= 0.03 * smooth01((t - 0.96) / 0.04);            // tucked into the cuff
      dir.copy(N).multiplyScalar(Math.cos(phi)).addScaledVector(B, Math.sin(phi));
      const x = P.x + dir.x * r, y = P.y + dir.y * r, z = P.z + dir.z * r;
      r += 0.008 * (noise3(x * 3, y * 3, z * 3) - 0.5);
      pos.push(P.x + dir.x * r, P.y + dir.y * r, P.z + dir.z * r);
    }
  }
  return { geo: gridGeometry(pos, null, TS, RS), curve };
}

// Hood up, as on a ghost-mannequin product photo. Not a helmet: two flat-ish side panels sewn along a
// centre seam, so the sides are flatter, the crown rises to a soft peak along the seam and leans back,
// the face opening is a tall oval, and the fabric folds. It flares at the bottom to sit around the
// neckline, where the two front edges meet. Returns the shell, a slightly smaller copy for the darker
// inside (lining), and the opening's edge points (for the rolled hem).
function hoodGeometry(st) {
  const ROWS = 72, COLS = 88, pos = [], inner = [], left = [], right = [];
  const TH_TOP = 0.03 * Math.PI, TH_BOTTOM = 0.86 * Math.PI, CY = 1.78, RY = 0.66;
  for (let i = 0; i <= ROWS; i++) {
    const t = 1 - i / ROWS;                                       // 0 = crown … 1 = neckline (rows go up)
    const th = lerp(TH_TOP, TH_BOTTOM, t);
    const flare = smooth01((t - 0.62) / 0.38);                    // widens to sit around neck and shoulders
    const rx = 0.43 * st.width * (1 + 1.15 * flare), rz = 0.6 * (1 + 0.62 * flare);
    const cz = -0.14 * (1 - flare) - 0.13 * (1 - t) ** 2;         // sits back, crown leaning further back
    const gap = 2.05 * Math.max(0, Math.sin(Math.PI * Math.min(1, t / 0.9))) ** 0.7;   // face-opening width (radians)
    for (let j = 0; j <= COLS; j++) {
      // three.js sphere convention: +z (the front) is at phi = π/2; the opening is left out around it.
      const phi = Math.PI / 2 + gap / 2 + (2 * Math.PI - gap) * j / COLS;
      const sx = -Math.cos(phi) * Math.sin(th), sy = Math.cos(th), sz = Math.sin(phi) * Math.sin(th);
      const x = rx * sx, y = CY + RY * sy, z = cz + rz * sz;
      const n = new THREE.Vector3(sx / rx, sy / RY, sz / rz).normalize();
      // Centre seam: the panels meet in a soft ridge over the crown and down the back.
      let d = 0.075 * Math.exp(-((x / 0.14) ** 2)) * (1 - flare) * smooth01((0.45 - sz) / 0.5);
      // Folds: fabric sagging from the opening's edges towards the back, plus unevenness.
      d += 0.022 * Math.sin(phi * 6 + th * 3) * Math.sin(Math.PI * t) * (1 - flare * 0.6);
      d += 0.02 * (noise3(x * 2.5, y * 2.5, z * 2.5) - 0.5);
      const px = x + n.x * d, py = y + n.y * d, pz = z + n.z * d;
      pos.push(px, py, pz);
      inner.push(px - n.x * 0.012, py - n.y * 0.012, pz - n.z * 0.012);
      if (j === 0) right.push(new THREE.Vector3(px, py, pz));
      if (j === COLS) left.push(new THREE.Vector3(px, py, pz));
    }
  }
  return { geo: gridGeometry(pos, null, ROWS, COLS, false), lining: gridGeometry(inner, null, ROWS, COLS, false), left, right };
}

// Metal zip running down the centre front, following the folded body surface.
function zipGeometry(st, yStart, yEnd) {
  const rows = 90, pos = [];
  for (let i = 0; i <= rows; i++) {
    const y = lerp(yStart, yEnd, i / rows);
    const [, b] = radii(y, st), [, b2] = radii(y + 0.01, st);
    const n = new THREE.Vector3(0, -(b2 - b) / 0.01, 1).normalize();     // surface normal at the centre front
    const off = foldOffset(0, 0, y, b, st) + 0.009;
    for (const x of [-0.026, 0.026]) pos.push(x + n.x * off, y + n.y * off, b + n.z * off);
  }
  return gridGeometry(pos, null, rows, 1, false);
}

function buildTop(group, st, m, mesh) {
  group.add(mesh(torsoGeometry(st), m.torso, 'Body_print'));

  // Hem band, gathering the body in
  const [ha, hb] = radii(st.y0, st);
  const hem = mesh(new THREE.CylinderGeometry(1, 1, 0.24, 120, 1, true), m.rib, 'Hem_rib');
  hem.scale.set(ha + 0.005, 1, hb + 0.005);
  hem.position.y = st.y0 + 0.1;
  group.add(hem);

  // Sleeves with rounded shoulder caps and ribbed cuffs
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'Sleeve_L' : 'Sleeve_R';
    pivot.position.set(side * (0.84 * st.width + st.drop * 0.6), 0.86 - st.drop, 0);
    pivot.rotation.z = side * (0.36 + st.drop * 0.3);
    const { geo, curve } = sleeveGeometry(side, st);
    pivot.add(mesh(geo, m.fabric, pivot.name + '_fabric'));
    const cap = mesh(new THREE.SphereGeometry(0.31 * st.sleeveR, 48, 24), m.fabric, pivot.name + '_shoulder');
    cap.scale.set(1, 0.82, 0.93);
    pivot.add(cap);
    const cr = Math.min(st.sleeveR, 1.05);
    const cuff = mesh(new THREE.CylinderGeometry(0.215 * cr, 0.205 * cr, 0.26, 48, 1, true), m.rib, pivot.name + '_cuff_rib');
    const tan = curve.getTangentAt(1);
    cuff.position.copy(curve.getPointAt(1)).addScaledVector(tan, 0.06);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tan);
    pivot.add(cuff);
    group.add(pivot);
  }

  if (st.hood) {
    const hood = hoodGeometry(st);
    group.add(mesh(hood.geo, m.fabric, 'Hood'));
    // Rolled hem (with the drawstring channel) all around the face opening: up the right edge, down the left.
    const opening = [...hood.right.slice(0, -2), ...hood.left.slice(0, -2).reverse()].filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.01);
    group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(opening), 160, 0.045, 12), m.fabric, 'Hood_hem'));
    // Seam where the hood is sewn onto the neckline
    const neck = mesh(new THREE.TorusGeometry(1, 0.05, 16, 96), m.fabric, 'Hood_neck_seam');
    neck.rotation.x = Math.PI / 2;
    neck.scale.set(0.42, 0.37, 1);
    neck.position.set(0, Y1 - 0.01, 0);
    group.add(neck);
    // The inside of the hood, in a darker shade (only its inner face is drawn), so it reads as empty fabric.
    group.add(mesh(hood.lining, m.lining || m.fabric, 'Hood_lining'));
    // Drawstrings come out of the hem near the bottom of the opening and hang down the chest.
    const exitRow = Math.round(hood.right.length * 0.16);
    for (const edge of [hood.left, hood.right]) {
      const p = edge[exitRow], sx = Math.sign(p.x || 1) * 0.11;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(p.x * 0.7, p.y - 0.02, p.z + 0.03), new THREE.Vector3(sx * 1.05, 1.1, Math.max(0.5, p.z * 0.95)),
        new THREE.Vector3(sx * 1.12, 0.8, 0.6 * st.depth), new THREE.Vector3(sx * 1.08, 0.5, 0.63 * st.depth),
      ]);
      group.add(mesh(new THREE.TubeGeometry(curve, 40, 0.018, 8), m.string, 'Drawstring_trim'));
      const tip = mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.1, 12), m.tip, 'Aglet_trim');
      tip.position.set(sx * 1.08, 0.45, 0.63 * st.depth);
      group.add(tip);
    }
  }
  if (st.collar === 'crew') {
    const collar = mesh(new THREE.CylinderGeometry(1, 1.04, 0.16, 96, 1, true), m.rib, 'Collar_rib');
    collar.scale.set(0.41, 1, 0.355);
    collar.position.y = Y1 + 0.02;
    group.add(collar);
  }
  if (st.collar === 'stand') {
    const collar = mesh(new THREE.CylinderGeometry(1, 1.05, 0.32, 96, 1, true), m.rib, 'Collar_rib');
    collar.scale.set(0.42, 1, 0.37);
    collar.position.y = Y1 + 0.13;
    group.add(collar);
    const zipTop = mesh(new THREE.BoxGeometry(0.052, 0.3, 0.012), m.tip, 'Zipper_collar_trim');
    zipTop.position.set(0, Y1 + 0.13, 0.385);
    group.add(zipTop);
  }
  if (st.zip) {
    const yStart = st.zip === 'full' ? st.y0 + 0.02 : 0.5;
    group.add(mesh(zipGeometry(st, yStart, Y1 - 0.02), m.tip, 'Zipper_trim'));
    const pullY = st.zip === 'full' ? Y1 - 0.12 : Y1 + 0.2;
    const pull = mesh(new THREE.BoxGeometry(0.05, 0.1, 0.015), m.tip, 'Zipper_pull_trim');
    pull.position.set(0, pullY, st.zip === 'full' ? radii(pullY, st)[1] + 0.03 : 0.4);
    group.add(pull);
  }
}

// ---------- Pants ----------
// Each leg is built as a front half and a back half (side seams), mapped flat onto the design canvas.
function legRadius(st, y) {
  const { top, crotch } = PANTS;
  if (y >= crotch) return lerp(0.46, 0.5, smooth01((y - crotch) / (top - crotch)));
  const t = (crotch - y) / (crotch - st.bottom);
  if (st.leg === 'jogger') return 0.46 - 0.25 * smooth01(Math.min(1, t * 1.05)) - 0.025 * smooth01((t - 0.97) / 0.03);
  if (st.leg === 'straight') return 0.46 - 0.12 * smooth01(Math.min(1, t * 1.6));
  return 0.46 - 0.03 * t;                                   // shorts
}
function pantsOffset(st, psi, x, y, z) {
  const { top, crotch } = PANTS, bottom = st.bottom;
  let d = 0.012 * (noise3(x * 2.2, y * 1.6, z * 2.2) - 0.5);
  d += 0.012 * Math.sin(psi * 16) * smooth01((y - (top - 0.28)) / 0.2);          // gathered under the elastic waist
  if (st.leg !== 'shorts') {
    const knee = lerp(crotch, bottom, 0.5);
    d += 0.013 * Math.exp(-(((y - knee) / 0.14) ** 2)) * Math.sin(psi * 3 + y * 22);  // knee creases
  }
  if (st.leg === 'jogger') {                                                         // stacked above the ankle cuff
    const w = smooth01((y - bottom - 0.05) / 0.08) * (1 - smooth01((y - bottom - 0.55) / 0.15));
    d += 0.026 * w * (0.5 + 0.5 * Math.sin(y * 48 + 2 * Math.sin(psi * 2)));
  }
  if (st.leg === 'straight') d += 0.012 * Math.sin(psi * 5 + 1) * smooth01((crotch - y) / 1.0);   // drape folds
  return d;
}
function legHalf(st, side, front) {
  const ROWS = 150, COLS = 40, { top } = PANTS, bottom = st.bottom;
  const pos = [], uv = [];
  for (let r = 0; r <= ROWS; r++) {
    const y = lerp(bottom, top, r / ROWS);
    const rx = legRadius(st, y), rz = rx * (1 + 0.22 * smooth01((y - PANTS.crotch + 0.2) / 0.5));
    const cx = side * lerp(0.44, 0.47, smooth01((y - bottom) / (top - bottom)));
    for (let c = 0; c <= COLS; c++) {
      const psi = (front ? -Math.PI / 2 : Math.PI / 2) + Math.PI * c / COLS;
      let x = cx + rx * Math.sin(psi);
      if (side * x < 0.004) x = side * 0.004;                // the two legs meet at the centre seam
      const z = rz * Math.cos(psi);
      const n = new THREE.Vector3(Math.sin(psi) / rx, 0, Math.cos(psi) / rz).normalize();
      const d = pantsOffset(st, psi, x, y, z);
      pos.push(x + n.x * d, y, z + n.z * d);
      uv.push(front ? 0.5 * (x + PANTS.halfWidth) / (2 * PANTS.halfWidth) : 0.5 + 0.5 * (PANTS.halfWidth - x) / (2 * PANTS.halfWidth), pantsV(y));
    }
  }
  return gridGeometry(pos, uv, ROWS, COLS, false);
}
function buildPants(group, st, m, mesh) {
  const halves = [];
  for (const side of [-1, 1]) for (const front of [true, false]) halves.push(legHalf(st, side, front));
  group.add(mesh(mergeGeometries(halves), m.torso, 'Body_print'));

  const band = mesh(new THREE.CylinderGeometry(1, 1, 0.26, 120, 1, true), m.rib, 'Waistband_rib');
  band.scale.set(0.99, 1, 0.625);
  band.position.y = PANTS.top + 0.02;
  group.add(band);
  for (const sx of [-0.05, 0.05]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, PANTS.top - 0.05, 0.63), new THREE.Vector3(sx * 1.3, PANTS.top - 0.28, 0.655),
      new THREE.Vector3(sx * 1.5, PANTS.top - 0.5, 0.665),
    ]);
    group.add(mesh(new THREE.TubeGeometry(curve, 24, 0.016, 8), m.string, 'Drawstring_trim'));
    const tip = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.08, 12), m.tip, 'Aglet_trim');
    tip.position.set(sx * 1.5, PANTS.top - 0.55, 0.665);
    group.add(tip);
  }
  for (const side of [-1, 1]) {
    const r = legRadius(st, st.bottom), cx = side * 0.44;
    if (st.leg === 'jogger') {
      const cuff = mesh(new THREE.CylinderGeometry(0.215, 0.205, 0.24, 48, 1, true), m.rib, `Cuff_${side < 0 ? 'L' : 'R'}_rib`);
      cuff.position.set(cx, st.bottom + 0.06, 0);
      group.add(cuff);
    } else {
      const hem = mesh(new THREE.TorusGeometry(1, 0.014, 8, 64), m.fabric, `Hem_${side < 0 ? 'L' : 'R'}`);
      hem.rotation.x = Math.PI / 2;
      hem.scale.set(r, r, 1);
      hem.position.set(cx, st.bottom + 0.01, 0);
      group.add(hem);
    }
  }
}

// ---------- Build ----------
// `m` holds the materials: { torso, fabric, rib, string, tip }. Mesh names follow MODEL_BRIEF.md
// ("print" = printable, "rib" = ribbed knit, "trim" = keeps its own color), so exports work like uploads.
// The garment is centred vertically around y = -0.05.
export function buildGarment(product, m) {
  const st = styleOf(product);
  const group = new THREE.Group();
  group.name = 'MG_' + product;
  const mesh = (geo, mat, name) => Object.assign(new THREE.Mesh(geo, mat), { name });
  (st.kind === 'pants' ? buildPants : buildTop)(group, st, m, mesh);
  group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });

  const box = new THREE.Box3().setFromObject(group);
  group.position.y = -(box.min.y + box.max.y) / 2 - 0.05;
  const torso = group.getObjectByName('Body_print');
  return { group, torso, bottom: box.min.y + group.position.y };
}
