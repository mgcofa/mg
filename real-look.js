// Shared by the studio and the store: which photo shows each product, and how its print area sits on it.
// Each photo has a -base picture and a -shade layer (gray folds, alpha = where the piece is). cx is the piece's center,
// top where the print area starts (or y0 where the canvas starts, for pants), mm the photo's pixels per millimeter.
export const REAL_PHOTOS = {
  h9: { cx: 408, top: 506, mm: 0.654, clip: 225 }, h3: { cx: 414, top: 630, mm: 1.03, clip: 0 },
  sweat: { cx: 345, top: 555, mm: 0.737, clip: 415 }, pants: { cx: 323, y0: 38, mm: 1.023, clip: 0 },
};
const HOODIE_PHOTOS = ['h9', 'h3'];
export const REAL_OF = { hoodie: HOODIE_PHOTOS, hoodie_pockets: HOODIE_PHOTOS, hoodie_oversized: HOODIE_PHOTOS, crew: ['sweat'], crew_oversized: ['sweat'], joggers: ['pants'] };

// The store has no 3D studio to ask, so it needs these from garment.js: the design canvas and the top of each print area.
const EW = 440, EH = 360, MM_PER_UNIT = 1.6;
const AREA_Y = { hoodie: 73, hoodie_pockets: 73, hoodie_oversized: 65, crew: 73, crew_oversized: 65 };

let fabricReady;
const loadFabric = () => window.fabric ? Promise.resolve() : (fabricReady ||= new Promise((ok, fail) => {
  const s = Object.assign(document.createElement('script'), { src: 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js', onload: ok, onerror: fail });
  document.head.append(s);
}));
const shades = {};
function loadShade(name) {
  return shades[name] ||= new Promise((ok, fail) => {
    const i = new Image(); i.onerror = fail;
    i.onload = () => {
      const c = Object.assign(document.createElement('canvas'), { width: i.naturalWidth, height: i.naturalHeight }), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(i, 0, 0);
      ok({ w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data });
    };
    i.src = `real/${name}-shade.webp`;
  });
}
// The model's hand hides the pants' pocket; the store shows the piece alone, so that gap is filled with plain fabric.
const inPocketGap = (x, y) => y > 112 && y < 262 && x > 462 + (y-112)*.05 && x < 530 + (y-118)*.18;

// A square picture of a store design on the real piece, or null when no photo matches that product.
export async function realPreview(pack, size = 720) {
  const name = REAL_OF[pack.product]?.[0], front = pack.json?.front;
  if (!name || !front) return null;
  await loadFabric();
  await Promise.all([...new Set([...JSON.stringify(front).matchAll(/"fontFamily":"([^"]+)"/g)].map(m => m[1]))].map(f => document.fonts.load(`48px "${f}"`, 'Aa أب').catch(() => {})));
  const design = new fabric.StaticCanvas(null, { width: EW*2, height: EH*2, enableRetinaScaling: false });
  design.setZoom(2);
  await new Promise(done => design.loadFromJSON(front, done));
  design.renderAll();
  const p = REAL_PHOTOS[name], a = await loadShade(name), k = MM_PER_UNIT*p.mm, c = Object.assign(document.createElement('canvas'), { width: a.w, height: a.h }), g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = pack.color; g.fillRect(0, 0, a.w, a.h);
  g.drawImage(design.lowerCanvasEl, p.cx - EW*k/2, p.y0 ?? p.top - AREA_Y[pack.product]*k, EW*k, EH*k);
  design.dispose();
  const img = g.getImageData(0, 0, a.w, a.h), d = img.data, s = a.data, gap = name === 'pants';
  let top = a.h, bottom = 0, left = a.w, right = 0;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i/4) % a.w, y = (i/4/a.w) | 0, fill = gap && s[i+3] < 200 && inPocketGap(x, y), shade = fill ? 118 : s[i], f = shade/128, lift = 16*(f-1), alpha = y <= p.clip ? 0 : fill ? 255 : s[i+3];
    d[i] = d[i]*f + lift; d[i+1] = d[i+1]*f + lift; d[i+2] = d[i+2]*f + lift; d[i+3] = alpha;
    if (alpha > 60) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x; }
  }
  g.putImageData(img, 0, 0);
  const out = Object.assign(document.createElement('canvas'), { width: size, height: size }), o = out.getContext('2d'), w = right-left, h = bottom-top, z = size*.92/Math.max(w, h);
  o.fillStyle = '#f1f1f4'; o.fillRect(0, 0, size, size);
  o.drawImage(c, left, top, w, h, size/2 - w*z/2, size/2 - h*z/2, w*z, h*z);
  return out.toDataURL('image/jpeg', .86);
}
