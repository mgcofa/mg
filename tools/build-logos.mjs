// Builds the ready-made logo library in logos/: a curated set of Tabler Icons (MIT) plus MG's own designs.
//   npm install && node tools/build-logos.mjs
// Every SVG uses currentColor, which the studio swaps for the customer's chosen color; #fffffe marks
// "cut-out" parts (text on a solid badge), which the studio paints in the garment's color.
import { mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TABLER = ROOT + 'node_modules/@tabler/icons/icons/';
const OUT = ROOT + 'logos/';

// Tabler icon names per category. The filled version is used when it exists, else the outline one.
// No brand logos on purpose: customers shouldn't print other companies' trademarks.
const TABLER_SETS = {
  sports: ['ball-football', 'ball-basketball', 'ball-tennis', 'ball-volleyball', 'ball-american-football', 'ball-baseball',
    'trophy', 'medal', 'award', 'run', 'bike', 'barbell', 'swimming', 'karate', 'ping-pong', 'target-arrow', 'stretching', 'yoga'],
  animals: ['paw', 'cat', 'dog', 'fish', 'butterfly', 'bug', 'spider', 'feather', 'deer', 'horse', 'pig', 'bat', 'ghost',
    'mushroom', 'shell', 'turtle', 'cherry'],
  symbols: ['crown', 'star', 'heart', 'bolt', 'flame', 'skull', 'diamond', 'sparkles', 'infinity', 'peace', 'yin-yang',
    'anchor', 'shield', 'rocket', 'clover', 'mood-smile', 'hand-rock', 'eye', 'key', 'bomb', 'spiral', 'circle-dotted', 'hexagon'],
  nature: ['leaf', 'tree', 'trees', 'plant', 'flower', 'mountain', 'ripple', 'cloud', 'snowflake', 'droplet', 'sun',
    'moon', 'moon-stars', 'planet', 'cactus', 'seeding', 'rainbow', 'tornado'],
  hobbies: ['music', 'headphones', 'microphone', 'guitar-pick', 'vinyl', 'camera', 'device-gamepad-2', 'code', 'palette',
    'brush', 'book', 'coffee', 'pizza', 'ice-cream', 'car', 'plane', 'motorbike', 'skateboarding', 'tent', 'chess-knight'],
};

// MG's own designs (viewBox 0 0 100 100).
const t = (y, size, font, text, extra = '') =>
  `<text x="50" y="${y}" text-anchor="middle" font-family="${font}" font-size="${size}"${/fill=/.test(extra) ? '' : ' fill="currentColor"'}${extra}>${text}</text>`;
const CUSTOM = {
  egypt: {
    pyramids: '<path d="M6 82 L38 28 L70 82Z M50 82 L70 48 L94 82Z" fill="currentColor"/><circle cx="76" cy="22" r="9" fill="currentColor"/><rect x="4" y="86" width="92" height="4" rx="2" fill="currentColor"/>',
    ankh: '<path fill="currentColor" fill-rule="evenodd" d="M50 6c-12 0-20 9-20 21 0 9 6 18 12 24H22v10h23v33h10V61h23V51H58c6-6 12-15 12-24 0-12-8-21-20-21zm0 10c6 0 10 5 10 11 0 7-5 15-10 20-5-5-10-13-10-20 0-6 4-11 10-11z"/>',
    lotus: '<path fill="currentColor" d="M50 18c-8 12-10 26-8 40 2 6 6 10 8 12 2-2 6-6 8-12 2-14 0-28-8-40zM18 38c2 14 10 26 26 32-6-12-12-24-26-32zM82 38c-14 8-20 20-26 32 16-6 24-18 26-32zM10 72c10 8 24 10 40 8 16 2 30 0 40-8-12 2-26 2-40-2-14 4-28 4-40 2z"/>',
    palm: '<path fill="currentColor" d="M47 46c2 14 2 30-3 46h9c3-15 3-31 0-46zM50 44C40 30 24 26 8 32c15-2 27 2 38 14zM50 44c10-14 26-18 42-12-15-2-27 2-38 14zM50 44c-4-14-14-24-28-28 10 6 18 16 24 30zM50 44c4-14 14-24 28-28-10 6-18 16-24 30zM50 44c0-12 2-22 8-30-8 6-12 18-12 30z"/><rect x="20" y="90" width="60" height="4" rx="2" fill="currentColor"/>',
    eye: '<path fill="currentColor" fill-rule="evenodd" d="M8 42c14-12 30-17 46-17s32 5 40 13c-12 10-26 15-42 15S20 50 8 42zm42-11a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><circle cx="50" cy="41" r="5" fill="currentColor"/><path fill="currentColor" d="M14 27c18-12 46-16 72-6l-2 5c-24-9-48-6-66 5zM44 55h7l-4 30h-6zM56 55c6 8 16 14 26 12 6-2 8-10 2-14-4-2-8 1-6 5l-5 2c-3-7 3-14 11-12 10 3 10 18-1 22-12 4-26-4-34-15z"/>',
    misr: '<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="1.5"/>' + t(64, 36, 'Lalezar', 'مصر'),
    egypt: '<path d="M30 46 L50 14 L70 46Z" fill="currentColor"/>' + t(76, 30, 'Bebas Neue', 'EGYPT', ' letter-spacing="2"') + '<rect x="14" y="84" width="72" height="3" fill="currentColor"/>',
    cairo: '<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>' + t(52, 30, 'Bebas Neue', 'CAIRO', ' letter-spacing="2"') + t(70, 12, 'Bebas Neue', 'EST. 2026', ' letter-spacing="2"') + '<path d="M38 26 L50 16 L62 26Z" fill="currentColor"/>',
    alqahera: '<path d="M6 38 H94 L86 50 L94 62 H6 L14 50Z" fill="currentColor"/>' + t(58, 18, 'Lalezar', 'القاهرة', ' fill="#fffffe"'),
  },
  badges: {
    team: '<path d="M50 6 L88 18 V48 C88 72 70 88 50 96 C30 88 12 72 12 48 V18Z" fill="none" stroke="currentColor" stroke-width="5"/>' + t(60, 26, 'Bebas Neue', 'TEAM', ' letter-spacing="2"'),
    number10: t(78, 76, 'Bebas Neue', '10', ' stroke="currentColor" stroke-width="2"'),
    est: '<rect x="6" y="28" width="88" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="4"/>' + t(58, 26, 'Bebas Neue', 'EST. 2026', ' letter-spacing="3"'),
    mg: '<circle cx="50" cy="50" r="45" fill="currentColor"/>' + t(64, 40, 'Bebas Neue', 'MG', ' fill="#fffffe" letter-spacing="2"'),
    stars: '<path fill="currentColor" d="M50 8l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1zM20 30l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1zM80 30l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/>' + t(84, 26, 'Bebas Neue', 'CHAMPIONS', ' letter-spacing="1"'),
    wings: '<path fill="currentColor" d="M50 40c-6-14-24-24-46-22 8 4 14 8 18 14-6-1-11 0-15 2 8 2 14 6 18 11-5 0-9 2-12 4 12 4 24 4 37-1zM50 40c6-14 24-24 46-22-8 4-14 8-18 14 6-1 11 0 15 2-8 2-14 6-18 11 5 0 9 2 12 4-12 4-24 4-37-1z"/><circle cx="50" cy="48" r="8" fill="currentColor"/>' + t(84, 20, 'Bebas Neue', 'FREEDOM', ' letter-spacing="3"'),
  },
};

// Normalise a Tabler SVG: move the root's paint attributes onto a <g> (the studio's SVG parser doesn't
// inherit them from <svg>), keep currentColor, and drop the class/size attributes.
function normalizeTabler(svg) {
  const open = svg.match(/<svg\b([^>]*)>/)[1];
  const inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const keep = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']
    .map(a => open.match(new RegExp(`\\s${a}="([^"]*)"`)) && `${a}="${open.match(new RegExp(`\\s${a}="([^"]*)"`))[1]}"`)
    .filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240"><g ${keep}>${inner.trim()}</g></svg>\n`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const manifest = [], missing = [];

for (const [cat, items] of Object.entries(CUSTOM)) {
  const ids = [];
  for (const [id, body] of Object.entries(items)) {
    await writeFile(`${OUT}${cat}-${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">${body}</svg>\n`);
    ids.push(`${cat}-${id}`);
  }
  manifest.push({ cat, items: ids });
}
for (const [cat, names] of Object.entries(TABLER_SETS)) {
  const ids = [];
  for (const name of names) {
    const file = ['filled', 'outline'].map(v => `${TABLER}${v}/${name}.svg`).find(existsSync);
    if (!file) { missing.push(name); continue; }
    await writeFile(`${OUT}${name}.svg`, normalizeTabler(await readFile(file, 'utf8')));
    ids.push(name);
  }
  manifest.push({ cat, items: ids });
}
await writeFile(OUT + 'manifest.json', JSON.stringify(manifest, null, 1) + '\n');
await copyFile(ROOT + 'node_modules/@tabler/icons/LICENSE', OUT + 'LICENSE-tabler-icons.txt');

const total = manifest.reduce((n, c) => n + c.items.length, 0);
console.log(`${total} logos in ${manifest.length} categories` + (missing.length ? ` (not in this Tabler version, skipped: ${missing.join(', ')})` : ''));
