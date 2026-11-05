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
  symbols: ['crown', 'star', 'heart', 'bolt', 'flame', 'diamond', 'sparkles', 'infinity', 'peace',
    'anchor', 'shield', 'rocket', 'clover', 'mood-smile', 'hand-rock', 'eye', 'key', 'spiral', 'circle-dotted', 'hexagon'],
  nature: ['leaf', 'tree', 'trees', 'plant', 'flower', 'mountain', 'ripple', 'cloud', 'snowflake', 'droplet', 'sun',
    'moon', 'moon-stars', 'planet', 'cactus', 'seeding', 'tornado'],
  hobbies: ['music', 'headphones', 'microphone', 'guitar-pick', 'vinyl', 'camera', 'device-gamepad-2', 'code', 'palette',
    'brush', 'book', 'coffee', 'pizza', 'ice-cream', 'car', 'plane', 'motorbike', 'skateboarding', 'tent', 'chess-knight'],
  school: ['school', 'certificate', 'books', 'pencil', 'backpack', 'atom', 'flask', 'microscope', 'bulb', 'math-function', 'ruler-2'],
  fun: ['mood-wink', 'mood-heart', 'mood-crazy-happy', 'hand-love-you', 'thumb-up', 'confetti', 'gift', 'balloon', 'cake',
    'alien', 'ufo', 'robot', 'pacman', 'ghost-2', 'stars'],
  travel: ['globe', 'compass', 'map-pin', 'flag', 'sailboat', 'helicopter', 'beach', 'umbrella', 'campfire', 'car-suv', 'sunset',
    'building-castle'],
  power: ['shield-star', 'helmet', 'gauge', 'barbell', 'bolt'],
};

// MG's own designs (viewBox 0 0 100 100).
const t = (y, size, font, text, extra = '') =>
  `<text x="50" y="${y}" text-anchor="middle" font-family="${font}" font-size="${size}"${/fill=/.test(extra) ? '' : ' fill="currentColor"'}${extra}>${text}</text>`;
// The CMG logo drawn in 100×100: a C holding MG, top arm to the end of the M, bottom arm under the whole word.
const CMG = (stroke, w = 9) => `<g transform="translate(4 18) scale(0.8)" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round">`
  + `<path d="M71 8 H32 A24 24 0 0 0 32 56 H111" stroke-width="${w}"/><g stroke-width="${w * 0.78}"><path d="M41 44 V21 L54.5 37 L68 21 V44"/><path d="M100.8 23.5 A12 12 0 1 0 104.5 34 H95"/></g></g>`;
// Geometry helpers.
const f1 = n => Math.round(n * 100) / 100;
// A star with n points: outer radius R, inner radius r, first point straight up.
const star = (cx, cy, R, r, n, fill = 'currentColor') => `<path fill="${fill}" d="M${Array.from({ length: n * 2 }, (_, i) => {
  const a = Math.PI * i / n - Math.PI / 2, d = i % 2 ? r : R;
  return `${f1(cx + d * Math.cos(a))} ${f1(cy + d * Math.sin(a))}`;
}).join(' L')}Z"/>`;
// A crescent: the circle (cx, cy, R) minus the circle (ox, oy, r), traced along both arcs.
function crescent(cx, cy, R, ox, oy, r, fill = 'currentColor') {
  const dx = ox - cx, dy = oy - cy, d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const mx = cx + a * dx / d, my = cy + a * dy / d;
  const p1 = [mx + h * dy / d, my - h * dx / d], p2 = [mx - h * dy / d, my + h * dx / d];
  return `<path fill="${fill}" d="M${f1(p1[0])} ${f1(p1[1])} A${R} ${R} 0 1 0 ${f1(p2[0])} ${f1(p2[1])} A${r} ${r} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}Z"/>`;
}
const RUQAA = 'Aref Ruqaa';
// A word card: the Arabic word, a short rule, and its English meaning spaced out underneath.
const WORD = (ar, size, en, enSize = 11) => t(58, size, RUQAA, ar) + '<rect x="30" y="68" width="40" height="1.6" fill="currentColor"/>'
  + t(84, enSize, 'Bebas Neue', en, ` letter-spacing="${enSize > 9 ? 3 : 1.5}" word-spacing="4"`);
// Couples set: a heart (100×100), the zigzag both heart halves share, a game pad and a battery.
const HEART = 'M50 86 C20 64 8 46 8 32 C8 18 19 10 30 10 C40 10 46 16 50 24 C54 16 60 10 70 10 C81 10 92 18 92 32 C92 46 80 64 50 86Z';
const ZIG = 'L45 76 L55 66 L45 56 L55 46 L45 36';
const PAD = '<path fill="currentColor" d="M26 12 H74 C86 12 92 24 92 36 C92 48 84 54 76 50 L66 42 H34 L24 50 C16 54 8 48 8 36 C8 24 14 12 26 12Z"/>'
  + '<path fill="#fffffe" d="M24 24 H30 V30 H36 V36 H30 V42 H24 V36 H18 V30 H24Z"/><circle cx="68" cy="28" r="3.6" fill="#fffffe"/><circle cx="76" cy="36" r="3.6" fill="#fffffe"/>';
const BATTERY = '<rect x="14" y="31" width="66" height="38" rx="7" fill="none" stroke="currentColor" stroke-width="5"/><rect x="82" y="42" width="7" height="16" rx="2" fill="currentColor"/>';

// Football set: original drawings only, no club crests, names or league marks.
const poly = (cx, cy, r, n, rot = -90) => Array.from({ length: n }, (_, i) => {
  const a = (rot + i * 360 / n) * Math.PI / 180;
  return `${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`;
}).join(' L');
// A classic ball: solid, with the pentagon panels cut out (they show the garment color).
const BALL = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor"/>`
  + `<path fill="#fffffe" d="M${poly(cx, cy, r * 0.3, 5)}Z"/>`
  + Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + 36 + i * 72) * Math.PI / 180, px = cx + r * 0.78 * Math.cos(a), py = cy + r * 0.78 * Math.sin(a);
    return `<path fill="#fffffe" d="M${poly(px, py, r * 0.24, 5, -90 + 36 + i * 72 + 180)}Z"/>`;
  }).join('')
  + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="${f1(r * 0.08)}"/>`;
const SHIRT = 'M30 12 L42 8 Q50 14 58 8 L70 12 L88 26 L80 40 L72 34 V90 H28 V34 L20 40 L12 26Z';
const VARSITY = (top, big, bottom) => t(26, 12, 'Bebas Neue', top, ' letter-spacing="3"') + t(66, 34, 'Bebas Neue', big, ' letter-spacing="2"') + t(88, 11, 'Bebas Neue', bottom, ' letter-spacing="3"');

// Cartoon couples: original cute characters, one for each partner. Faces are cut out so they show the garment color.
const face = (cx, cy, k = 1, fill = '#fffffe') => `<circle cx="${f1(cx - 7 * k)}" cy="${cy}" r="${f1(2.8 * k)}" fill="${fill}"/><circle cx="${f1(cx + 7 * k)}" cy="${cy}" r="${f1(2.8 * k)}" fill="${fill}"/>`
  + `<path d="M${f1(cx - 4.5 * k)} ${f1(cy + 5 * k)} Q${cx} ${f1(cy + 10 * k)} ${f1(cx + 4.5 * k)} ${f1(cy + 5 * k)}" fill="none" stroke="${fill}" stroke-width="${f1(2.2 * k)}" stroke-linecap="round"/>`;
const bowShape = (x, y, k, fill) => `<path fill="${fill}" d="M${x} ${y} L${f1(x - 11 * k)} ${f1(y - 7 * k)} L${f1(x - 11 * k)} ${f1(y + 7 * k)}Z M${x} ${y} L${f1(x + 11 * k)} ${f1(y - 7 * k)} L${f1(x + 11 * k)} ${f1(y + 7 * k)}Z"/><circle cx="${x}" cy="${y}" r="${f1(3.5 * k)}" fill="${fill}"/>`;
// A bow with a thin garment-colored outline, so it stands apart from the head it sits on.
const bow = (x, y, k = 1) => bowShape(x, y, k * 1.35, '#fffffe') + bowShape(x, y, k, 'currentColor');
const AVOCADO = 'M50 6 C66 6 74 24 78 42 C84 66 72 94 50 94 C28 94 16 66 22 42 C26 24 34 6 50 6Z';
// Left half of a bear face; the right half is the same drawing mirrored.
const BEAR_HALF = '<path fill="currentColor" d="M50 24 A32 32 0 0 0 50 88Z"/><circle cx="25" cy="28" r="12" fill="currentColor"/><circle cx="25" cy="28" r="6" fill="#fffffe"/>'
  + '<circle cx="38" cy="50" r="4" fill="#fffffe"/><path fill="#fffffe" d="M50 56 A13 10 0 0 0 50 76Z"/><path fill="currentColor" d="M50 60 A6 4.5 0 0 0 50 69Z"/>';
const CAT = '<path fill="currentColor" d="M18 42 L22 10 L42 26 C47 25 53 25 58 26 L78 10 L82 42 C88 56 84 80 50 84 C16 80 12 56 18 42Z"/>'
  + '<ellipse cx="38" cy="52" rx="4" ry="5" fill="#fffffe"/><ellipse cx="62" cy="52" rx="4" ry="5" fill="#fffffe"/><path fill="#fffffe" d="M46 60 H54 L50 65Z"/>'
  + '<path d="M50 65 Q46 71 42 67 M50 65 Q54 71 58 67 M10 58 L30 61 M10 66 L30 65 M90 58 L70 61 M90 66 L70 65" fill="none" stroke="#fffffe" stroke-width="2" stroke-linecap="round"/>';
const GHOST = '<path fill="currentColor" d="M26 74 V36 C26 20 36 10 50 10 C64 10 74 20 74 36 V74 L66 67 L58 74 L50 67 L42 74 L34 67Z"/>'
  + '<ellipse cx="41" cy="36" rx="4" ry="6" fill="#fffffe"/><ellipse cx="59" cy="36" rx="4" ry="6" fill="#fffffe"/><ellipse cx="50" cy="51" rx="4" ry="5" fill="#fffffe"/>';
const PENGUIN = '<path fill="currentColor" d="M50 6 C66 6 74 22 74 40 C74 50 80 64 78 76 C76 88 64 94 50 94 C36 94 24 88 22 76 C20 64 26 50 26 40 C26 22 34 6 50 6Z M24 48 C14 56 12 66 14 72 C20 66 24 60 28 56Z M76 48 C86 56 88 66 86 72 C80 66 76 60 72 56Z"/>'
  + '<path fill="#fffffe" d="M50 30 C62 30 66 44 66 58 C66 76 60 86 50 86 C40 86 34 76 34 58 C34 44 38 30 50 30Z"/><circle cx="43" cy="40" r="3" fill="currentColor"/><circle cx="57" cy="40" r="3" fill="currentColor"/><path fill="currentColor" d="M45 46 H55 L50 52Z"/>';

const CUSTOM = {
  cmg: {
    logo: CMG('currentColor'),
    mark: '<rect x="4" y="4" width="92" height="92" rx="22" fill="currentColor"/>' + CMG('#fffffe').replace('translate(4 18) scale(0.8)', 'translate(11 32) scale(0.66)'),
    circle: '<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>' + CMG('currentColor').replace('translate(4 18) scale(0.8)', 'translate(14 32) scale(0.6)'),
    tagline: CMG('currentColor').replace('translate(4 18) scale(0.8)', 'translate(6 10) scale(0.74)') + t(86, 13, 'Bebas Neue', 'DESIGN IT. WEAR IT.', ' letter-spacing="1"'),
    badge: '<path d="M50 4 L90 18 V50 C90 74 72 90 50 97 C28 90 10 74 10 50 V18Z" fill="currentColor"/>' + CMG('#fffffe').replace('translate(4 18) scale(0.8)', 'translate(16 30) scale(0.56)'),
  },
  words: {
    habibi: t(66, 44, 'Lalezar', 'حبيبي'),
    ostora: '<path d="M30 30 L38 14 L50 26 L62 14 L70 30Z" fill="currentColor"/>' + t(78, 40, 'Lalezar', 'أسطورة'),
    yalla: t(66, 40, 'Lalezar', 'يلا بينا'),
    masry: t(50, 30, 'Lalezar', 'مصري') + t(82, 30, 'Lalezar', 'وأفتخر'),
    dof3a: '<path d="M6 34 H94 L86 50 L94 66 H6 L14 50Z" fill="currentColor"/>' + t(57, 17, 'Lalezar', 'دفعة ٢٠٢٦', ' fill="#fffffe"'),
    classof: t(44, 22, 'Bebas Neue', 'CLASS OF', ' letter-spacing="3"') + t(82, 40, 'Bebas Neue', '2026', ' letter-spacing="2"'),
    squad: '<rect x="6" y="30" width="88" height="40" rx="20" fill="currentColor"/>' + t(61, 30, 'Bebas Neue', 'SQUAD', ' fill="#fffffe" letter-spacing="3"'),
    family: t(58, 30, 'Bebas Neue', 'FAMILY', ' letter-spacing="3"') + '<path d="M50 80 C40 72 32 68 32 62 C32 58 36 56 40 58 C44 60 46 62 50 66 C54 62 56 60 60 58 C64 56 68 58 68 62 C68 68 60 72 50 80Z" fill="currentColor"/>',
    boss: t(70, 50, 'Bebas Neue', 'BOSS', ' letter-spacing="2"'),
    king: '<path d="M26 40 L32 16 L44 30 L50 12 L56 30 L68 16 L74 40Z" fill="currentColor"/>' + t(82, 40, 'Bebas Neue', 'KING', ' letter-spacing="3"'),
    queen: '<path d="M26 40 L32 16 L44 30 L50 12 L56 30 L68 16 L74 40Z" fill="currentColor"/><circle cx="32" cy="14" r="3" fill="currentColor"/><circle cx="50" cy="10" r="3" fill="currentColor"/><circle cx="68" cy="14" r="3" fill="currentColor"/>' + t(82, 36, 'Bebas Neue', 'QUEEN', ' letter-spacing="3"'),
    original: '<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="3"/>' + t(46, 18, 'Bebas Neue', 'ORIGINAL', ' letter-spacing="2"') + t(70, 20, 'Lalezar', 'أصلي'),
  },
  // Football: drawings and slogans for fans of any team (no club marks).
  football: {
    ball: BALL(50, 50, 42),
    fireball: BALL(62, 50, 26) + '<path fill="currentColor" d="M36 50 C26 44 16 46 4 40 C14 38 22 36 34 40 C24 32 18 26 10 20 C22 22 30 28 38 36 C34 28 34 22 36 14 C40 24 42 30 44 34Z M36 52 C26 58 18 62 8 70 C20 68 28 64 38 60Z"/>',
    trophy: '<path fill="currentColor" d="M30 10 H70 V30 C70 46 60 56 50 58 C40 56 30 46 30 30Z M30 16 H18 C18 32 24 40 32 42 L33 36 C27 34 24 28 24 22 H30Z M70 16 H82 C82 32 76 40 68 42 L67 36 C73 34 76 28 76 22 H70Z M46 58 H54 V72 H46Z M34 72 H66 V80 H34Z M28 80 H72 V90 H28Z"/>' + star(50, 30, 9, 3.8, 5, '#fffffe'),
    pitch: '<rect x="8" y="16" width="84" height="68" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M50 16 V84 M8 36 H22 V64 H8 M92 36 H78 V64 H92" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" r="11" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" r="2.5" fill="currentColor"/>',
    goal: '<path d="M10 82 V24 H90 V82" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M10 34 H90 M10 46 H90 M10 58 H90 M10 70 H90 M22 24 V82 M34 24 V82 M46 24 V82 M58 24 V82 M70 24 V82 M82 24 V82" stroke="currentColor" stroke-width="1.2" opacity="0.9"/>' + BALL(64, 66, 13),
    whistle: '<path fill="currentColor" d="M18 44 C18 30 30 22 44 22 H86 V40 H64 C70 46 72 52 72 58 C72 72 60 82 46 82 C30 82 18 70 18 58Z"/><circle cx="46" cy="58" r="10" fill="#fffffe"/><circle cx="46" cy="58" r="5" fill="currentColor"/><path d="M78 22 V12 H86 V22" fill="currentColor"/>',
    jersey10: `<path fill="currentColor" d="${SHIRT}"/>` + t(76, 36, 'Bebas Neue', '10', ' fill="#fffffe"'),
    jersey7: `<path fill="currentColor" d="${SHIRT}"/>` + t(76, 38, 'Bebas Neue', '7', ' fill="#fffffe"'),
    cards: '<rect x="20" y="18" width="34" height="50" rx="5" fill="currentColor" transform="rotate(-14 37 43)"/><rect x="46" y="26" width="34" height="50" rx="5" fill="none" stroke="currentColor" stroke-width="4" transform="rotate(12 63 51)"/>' + t(94, 13, 'Bebas Neue', 'YOU ARE OFF', ' letter-spacing="2"'),
    captain: '<rect x="8" y="30" width="84" height="40" rx="8" fill="currentColor"/>' + t(63, 32, 'Bebas Neue', 'C', ' fill="#fffffe"') + '<path d="M16 36 V64 M84 36 V64" stroke="#fffffe" stroke-width="2.5"/>' + t(88, 13, 'Bebas Neue', 'CAPTAIN', ' letter-spacing="4"'),
    kingPitch: '<path fill="currentColor" d="M28 30 L32 10 L42 22 L50 6 L58 22 L68 10 L72 30Z"/>' + BALL(50, 54, 17) + t(90, 11, 'Bebas Neue', 'KING OF THE PITCH', ' letter-spacing="1.5"'),
    goalText: t(66, 46, 'Bebas Neue', 'GOAL!', ' letter-spacing="2"') + '<path d="M8 76 H40 M14 84 H34 M60 76 H92 M66 84 H86" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    gooool: t(62, 30, 'Lalezar', 'جوووول') + '<path d="M14 76 H86" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    matchday: BALL(50, 26, 15) + t(68, 26, 'Bebas Neue', 'MATCH', ' letter-spacing="4"') + t(92, 26, 'Bebas Neue', 'DAY', ' letter-spacing="8"'),
    footballLife: t(42, 26, 'Bebas Neue', 'FOOTBALL', ' letter-spacing="3"') + t(68, 18, 'Bebas Neue', 'IS', ' letter-spacing="3"') + t(92, 26, 'Bebas Neue', 'LIFE', ' letter-spacing="6"'),
    noFootball: t(36, 20, 'Bebas Neue', 'NO FOOTBALL', ' letter-spacing="2"') + BALL(50, 54, 10) + t(86, 20, 'Bebas Neue', 'NO LIFE', ' letter-spacing="4"'),
    minutes90: '<circle cx="50" cy="44" r="32" fill="none" stroke="currentColor" stroke-width="5"/><rect x="45" y="4" width="10" height="8" rx="2" fill="currentColor"/>' + t(54, 22, 'Bebas Neue', '90:00', ' letter-spacing="1"') + t(94, 13, 'Bebas Neue', 'FULL TIME', ' letter-spacing="4"'),
    player12: t(58, 52, 'Bebas Neue', '12') + t(86, 15, 'Lalezar', 'اللاعب رقم ١٢'),
    koraWbas: BALL(50, 26, 16) + t(78, 30, 'Lalezar', 'كورة وبس'),
    ashe2: t(44, 22, 'Lalezar', 'عاشق') + t(80, 30, 'Lalezar', 'الكورة'),
    hayati: BALL(80, 24, 11) + t(66, 21, 'Lalezar', 'الكورة حياتي'),
    tiki: t(46, 22, 'Bebas Neue', 'TIKI', ' letter-spacing="6"') + t(76, 22, 'Bebas Neue', 'TAKA', ' letter-spacing="6"') + '<path d="M20 86 Q35 78 50 86 T80 86" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 4"/>',
    sundayLeague: VARSITY('SUNDAY', 'LEAGUE', 'EST. 2026'),
    baller: t(66, 38, 'Bebas Neue', 'BALLER', ' letter-spacing="3"') + BALL(16, 20, 8) + BALL(84, 20, 8),
    fc: '<path d="M50 4 L88 16 V46 C88 70 70 86 50 96 C30 86 12 70 12 46 V16Z" fill="none" stroke="currentColor" stroke-width="4"/>' + t(56, 30, 'Bebas Neue', 'F.C.', ' letter-spacing="2"') + t(72, 9, 'Bebas Neue', 'EST. 2026', ' letter-spacing="1.5"') + star(50, 20, 5, 2, 5),
    hatTrick: BALL(22, 30, 13) + BALL(50, 30, 13) + BALL(78, 30, 13) + t(80, 24, 'Bebas Neue', 'HAT-TRICK', ' letter-spacing="2"'),
    kickoff: t(48, 30, 'Bebas Neue', 'KICK', ' letter-spacing="6"') + t(82, 30, 'Bebas Neue', 'OFF', ' letter-spacing="10"') + '<path d="M6 56 H94" stroke="currentColor" stroke-width="2"/>',
    score: '<rect x="8" y="26" width="84" height="44" rx="8" fill="currentColor"/>' + t(59, 26, 'Bebas Neue', '3 - 0', ' fill="#fffffe" letter-spacing="3"') + t(88, 11, 'Bebas Neue', 'FULL TIME', ' letter-spacing="4"'),
    pharaohs: '<path fill="currentColor" d="M30 40 L50 10 L70 40Z"/>' + t(70, 26, 'Lalezar', 'الفراعنة') + t(90, 11, 'Bebas Neue', 'PHARAOHS', ' letter-spacing="4"'),
    yallaMasr: BALL(50, 24, 14) + t(66, 22, 'Lalezar', 'يلا يا') + t(92, 28, 'Lalezar', 'مصر'),
    dribble: '<circle cx="12" cy="70" r="2.5" fill="currentColor"/><circle cx="24" cy="66" r="3" fill="currentColor"/><circle cx="37" cy="64" r="3.5" fill="currentColor"/>' + BALL(62, 62, 14) + t(36, 28, 'Bebas Neue', 'DRIBBLE', ' letter-spacing="3"'),
    boot: '<path fill="currentColor" d="M18 22 H40 V46 C52 48 70 52 84 58 C92 62 92 72 84 74 H14 C10 74 10 70 12 64Z"/><path fill="currentColor" d="M18 74 H26 V82 H18Z M38 74 H46 V82 H38Z M58 74 H66 V82 H58Z M76 74 H84 V80 H76Z"/><path d="M26 30 H36 M26 38 H36" stroke="#fffffe" stroke-width="2.5" stroke-linecap="round"/>',
  },
  // Inspiring words, streetwear style: one big word in calligraphy over a small spaced English line.
  vibes: {
    sabr: WORD('صبر', 46, 'PATIENCE'),
    ebtasem: WORD('ابتسم', 38, 'SMILE') + '<g transform="translate(32 -4)"><circle cx="50" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="47.5" cy="10.5" r="1.1" fill="currentColor"/><circle cx="52.5" cy="10.5" r="1.1" fill="currentColor"/><path d="M47 13.5 Q50 16.5 53 13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></g>',
    amal: WORD('أمل', 48, 'HOPE'),
    helm: WORD('حلم', 48, 'DREAM'),
    hodoo: WORD('هدوء', 42, 'CALM'),
    thiqa: WORD('ثقة', 46, 'CONFIDENCE', 10),
    shukr: WORD('شكر', 46, 'GRATITUDE'),
    kammel: WORD('كمّل', 44, 'KEEP GOING', 10),
    koonEnta: WORD('خليك انت', 32, 'BE YOU'),
    bokra: WORD('بكرة أحلى', 30, 'BETTER DAYS', 10),
    wa7da: WORD('واحدة واحدة', 26, 'STEP BY STEP', 10),
    ijabi: WORD('خليك إيجابي', 26, 'STAY POSITIVE', 9),
    mosta7il: WORD('مش مستحيل', 30, 'NOTHING IS IMPOSSIBLE', 7),
    ejtahed: WORD('اجتهد', 40, 'WORK HARD', 10),
    hob: WORD('حب', 52, 'LOVE'),
    salam: WORD('سلام', 44, 'PEACE'),
  },
  // Cartoon couples: one character on his piece, its partner on hers.
  toons: {
    avocadoHim: `<path fill="currentColor" d="${AVOCADO}"/><g transform="translate(50 54) scale(0.82) translate(-50 -54)"><path fill="#fffffe" d="${AVOCADO}"/></g><circle cx="50" cy="64" r="15" fill="currentColor"/>` + face(50, 40, 0.8, 'currentColor'),
    avocadoHer: `<path fill="currentColor" d="${AVOCADO}"/><g transform="translate(50 54) scale(0.82) translate(-50 -54)"><path fill="#fffffe" d="${AVOCADO}"/></g><circle cx="50" cy="64" r="11" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/>` + face(50, 40, 0.8, 'currentColor') + bow(64, 20, 0.6),
    bearHim: BEAR_HALF,
    bearHer: `<g transform="translate(100 0) scale(-1 1)">${BEAR_HALF}</g>` + bow(76, 14, 0.75),
    catHim: CAT,
    catHer: CAT + bow(70, 12, 0.7),
    ghostHim: GHOST + t(92, 17, 'Bebas Neue', 'MY BOO', ' letter-spacing="3"'),
    ghostHer: GHOST + bow(62, 12, 0.6) + t(92, 17, 'Bebas Neue', 'MY BOO', ' letter-spacing="3"'),
    penguinHim: PENGUIN + `<g transform="translate(68 2) scale(0.3)"><path fill="#fffffe" d="${HEART}"/></g><g transform="translate(71 5) scale(0.24)"><path fill="currentColor" d="${HEART}"/></g>`,
    penguinHer: PENGUIN + bow(64, 14, 0.6),
    bee: '<ellipse cx="50" cy="42" rx="24" ry="18" fill="currentColor"/><path fill="#fffffe" d="M40 25 H46 V59 H40Z M54 25 H60 V59 H54Z"/><circle cx="34" cy="38" r="2.6" fill="#fffffe"/>'
      + '<ellipse cx="44" cy="20" rx="9" ry="12" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-20 44 20)"/><ellipse cx="58" cy="20" rx="9" ry="12" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(20 58 20)"/>'
      + '<path fill="currentColor" d="M73 40 L82 42 L73 45Z"/>' + t(88, 18, 'Bebas Neue', 'BEE MINE', ' letter-spacing="3"'),
    flower: Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<circle cx="${f1(50 + 20 * Math.cos(a))}" cy="${f1(40 + 20 * Math.sin(a))}" r="11" fill="currentColor"/>`; }).join('')
      + '<circle cx="50" cy="40" r="15" fill="#fffffe"/>' + face(50, 38, 0.75, 'currentColor') + t(88, 18, 'Bebas Neue', 'ALWAYS', ' letter-spacing="4"'),
    cookie: '<circle cx="50" cy="40" r="30" fill="currentColor"/><circle cx="36" cy="26" r="3.5" fill="#fffffe"/><circle cx="64" cy="24" r="3" fill="#fffffe"/><circle cx="70" cy="48" r="3.5" fill="#fffffe"/><circle cx="30" cy="54" r="3" fill="#fffffe"/>' + face(50, 40, 1)
      + t(90, 20, 'Bebas Neue', 'PERFECT', ' letter-spacing="3"'),
    milk: '<path fill="currentColor" d="M30 22 L40 10 H60 L70 22 V70 H30Z"/><path fill="#fffffe" d="M40 10 L30 22 H70 L60 10Z" transform="translate(0 2) scale(1 0.7)"/><rect x="34" y="30" width="32" height="12" rx="2" fill="#fffffe"/>' + face(50, 52, 0.9)
      + t(90, 20, 'Bebas Neue', 'MATCH', ' letter-spacing="3"'),
  },
  // Matching pairs: each half is one logo, listed side by side; together they make the whole picture.
  couples: {
    heartL: `<path fill="currentColor" d="M50 24 C46 16 40 10 30 10 C19 10 8 18 8 32 C8 46 20 64 50 86 ${ZIG}Z"/>`,
    heartR: `<path fill="currentColor" d="M50 24 C54 16 60 10 70 10 C81 10 92 18 92 32 C92 46 80 64 50 86 ${ZIG}Z"/>`,
    puzzleMe: '<path fill="currentColor" d="M14 22 H72 V40 A10 10 0 0 1 72 60 V80 H14Z"/>' + t(59, 18, 'Bebas Neue', 'ME', ' fill="#fffffe" letter-spacing="2"').replace('x="50"', 'x="42"'),
    puzzleYou: '<path fill="currentColor" d="M28 22 H86 V80 H28 V60 A10 10 0 0 0 28 40Z"/>' + t(59, 18, 'Bebas Neue', 'YOU', ' fill="#fffffe" letter-spacing="2"').replace('x="50"', 'x="60"'),
    lock: '<path d="M36 46 V32 A14 14 0 0 1 64 32 V46" fill="none" stroke="currentColor" stroke-width="8"/><rect x="24" y="44" width="52" height="46" rx="9" fill="currentColor"/>'
      + `<g transform="translate(40 56) scale(0.2)"><path fill="#fffffe" d="${HEART}"/></g>`,
    key: `<g transform="translate(28 2) scale(0.44)"><path fill="currentColor" d="${HEART}"/></g><g transform="translate(40 10) scale(0.2)"><path fill="#fffffe" d="${HEART}"/></g>`
      + '<path fill="currentColor" d="M46.5 38 H53.5 V96 H46.5Z M53 72 H64 V78 H53Z M53 84 H60 V90 H53Z"/>',
    sun: '<circle cx="50" cy="50" r="20" fill="currentColor"/>' + star(50, 50, 44, 26, 12) + '<circle cx="50" cy="50" r="23" fill="#fffffe"/><circle cx="50" cy="50" r="19" fill="currentColor"/>',
    moon: crescent(50, 52, 36, 63, 42, 29) + star(74, 22, 7, 2.9, 5) + star(84, 44, 4, 1.7, 5),
    plug: '<path fill="currentColor" d="M37 10 H43 V30 H37Z M57 10 H63 V30 H57Z M28 28 H72 V52 C72 62 64 68 56 68 H44 C36 68 28 62 28 52Z M46 66 H54 V76 H46Z"/><path d="M50 76 C50 90 30 86 24 96" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    socket: '<rect x="12" y="12" width="76" height="76" rx="18" fill="currentColor"/><circle cx="50" cy="50" r="27" fill="#fffffe"/><circle cx="50" cy="50" r="22" fill="currentColor"/>'
      + '<rect x="38" y="40" width="6" height="18" rx="3" fill="#fffffe"/><rect x="56" y="40" width="6" height="18" rx="3" fill="#fffffe"/>',
    player1: PAD + t(88, 21, 'Bebas Neue', 'PLAYER 1', ' letter-spacing="2"'),
    player2: PAD + t(88, 21, 'Bebas Neue', 'PLAYER 2', ' letter-spacing="2"'),
    mr: `<g transform="translate(40 8) scale(0.2)"><path fill="currentColor" d="${HEART}"/></g>` + t(74, 50, 'Bebas Neue', 'MR.', ' letter-spacing="2"'),
    mrs: `<g transform="translate(40 8) scale(0.2)"><path fill="currentColor" d="${HEART}"/></g>` + t(74, 50, 'Bebas Neue', 'MRS.', ' letter-spacing="2"'),
    his: t(62, 46, 'Bebas Neue', 'HIS', ' letter-spacing="3"') + '<rect x="28" y="70" width="44" height="2" fill="currentColor"/>' + t(86, 10, 'Bebas Neue', 'SHE IS MINE', ' letter-spacing="2"'),
    hers: t(62, 46, 'Bebas Neue', 'HERS', ' letter-spacing="3"') + '<rect x="28" y="70" width="44" height="2" fill="currentColor"/>' + t(86, 10, 'Bebas Neue', 'HE IS MINE', ' letter-spacing="2"'),
    huwa: t(70, 64, 'Lalezar', 'هو') + `<g transform="translate(62 4) scale(0.2)"><path fill="currentColor" d="${HEART}"/></g>`,
    hiya: t(70, 64, 'Lalezar', 'هي') + `<g transform="translate(62 4) scale(0.2)"><path fill="currentColor" d="${HEART}"/></g>`,
    enta: t(62, 34, RUQAA, 'انت ليّا') + `<g transform="translate(42 70) scale(0.16)"><path fill="currentColor" d="${HEART}"/></g>`,
    ana: t(62, 34, RUQAA, 'وأنا ليك') + `<g transform="translate(42 70) scale(0.16)"><path fill="currentColor" d="${HEART}"/></g>`,
    habibi: t(60, 34, RUQAA, 'حبيبي') + '<path d="M22 74 H78" stroke="currentColor" stroke-width="2"/>' + t(90, 10, 'Bebas Neue', 'HABIBI', ' letter-spacing="4"'),
    habibti: t(60, 34, RUQAA, 'حبيبتي') + '<path d="M22 74 H78" stroke="currentColor" stroke-width="2"/>' + t(90, 10, 'Bebas Neue', 'HABIBTI', ' letter-spacing="4"'),
    batteryLow: BATTERY + '<rect x="21" y="38" width="9" height="24" rx="2" fill="currentColor"/>' + t(91, 13, 'Bebas Neue', 'LOW WITHOUT YOU', ' letter-spacing="1"'),
    batteryFull: BATTERY + '<rect x="21" y="38" width="52" height="24" rx="2" fill="currentColor"/>' + `<g transform="translate(39.5 41) scale(0.21)"><path fill="#fffffe" d="${HEART}"/></g>` + t(91, 13, 'Bebas Neue', 'FULL WITH YOU', ' letter-spacing="1"'),
    rings: '<circle cx="38" cy="58" r="22" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="62" cy="58" r="22" fill="none" stroke="currentColor" stroke-width="6"/><path fill="currentColor" d="M54 18 H70 L74 25 L62 38 L50 25Z"/>',
    est: `<g transform="translate(18 10) scale(0.4)"><path fill="currentColor" d="${HEART}"/></g><g transform="translate(46 10) scale(0.4)"><path fill="none" stroke="currentColor" stroke-width="9" d="${HEART}"/></g>` + t(86, 22, 'Bebas Neue', 'EST. 2026', ' letter-spacing="3"'),
  },
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

// ---- Art prints, varsity text, and more couple designs (all drawn here; paintings are public domain). ----
// Text placed freely (t() always centers at x=50).
const tx = (x, y, size, font, text, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}"${/fill=/.test(extra) ? '' : ' fill="currentColor"'}${extra}>${text}</text>`;
// Letters along an upward arc centered on (cx, cy) with radius r, deg apart.
const ARC = (text, cx, cy, r, size, font, deg, extra = '') => [...text].map((ch, i, all) => {
  const a = (i - (all.length - 1) / 2) * deg, rad = a * Math.PI / 180;
  return `<text transform="translate(${f1(cx + r * Math.sin(rad))} ${f1(cy - r * Math.cos(rad))}) rotate(${f1(a)})" text-anchor="middle" font-family="${font}" font-size="${size}"${/fill=/.test(extra) ? '' : ' fill="currentColor"'}${extra}>${ch}</text>`;
}).join('');
const spiral = (cx, cy, r, turns, stroke, w) => `<path fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" d="M${Array.from({ length: 40 }, (_, i) => {
  const k = i / 39, a = k * turns * 2 * Math.PI, rr = r * k;
  return `${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`;
}).join(' L')}"/>`;
// A night-sky village scene in 100×70, after the 1889 painting.
const NIGHT = '<rect width="100" height="70" fill="#1c3d8f"/>'
  + '<path fill="none" stroke="#4f7fd1" stroke-width="4" d="M0 34 C15 22 30 44 45 32 C60 20 72 38 100 28"/>'
  + '<path fill="none" stroke="#9cc3ee" stroke-width="2" d="M0 24 C20 12 35 32 55 20 C70 12 82 24 100 16"/>'
  + '<path fill="none" stroke="#3566b8" stroke-width="3" d="M0 44 C18 38 34 48 52 42 C70 36 84 44 100 38"/>'
  + spiral(44, 27, 10, 2.2, '#e9f1fb', 2.2) + spiral(44, 27, 7, 1.6, '#f6d860', 1.2) + spiral(72, 38, 6, 1.8, '#cfe2f7', 1.6)
  + [[10, 10], [26, 8], [60, 8], [56, 44], [88, 40], [20, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="none" stroke="#f6e7a0" stroke-width="1"/><circle cx="${x}" cy="${y}" r="2.4" fill="#f6d860"/>`).join('')
  + '<circle cx="86" cy="13" r="10" fill="none" stroke="#f9e08a" stroke-width="2"/><circle cx="86" cy="13" r="7" fill="#f5c542"/><circle cx="89" cy="11" r="5.5" fill="#1c3d8f"/>'
  + '<path fill="#2b4f7e" d="M0 52 C20 44 40 50 60 46 C75 43 90 46 100 44 V70 H0Z"/>'
  + '<path fill="#213a63" d="M40 62 V56 H46 V62Z M48 62 V54 L52 50 L56 54 V62Z M58 62 V57 H66 V62Z M68 62 V55 H74 V62Z M60 57 L62 44 L64 57Z"/>'
  + '<path fill="#ffd56b" d="M42 58 H44 V60 H42Z M51 56 H53 V58 H51Z M61 59 H63 V61 H61Z M70 58 H72 V60 H70Z"/>'
  + '<path fill="#16241c" stroke="#3a5a3a" stroke-width="0.8" d="M14 70 C10 56 12 40 16 26 C18 18 20 14 21 8 C23 20 26 34 26 48 C27 58 26 64 24 70Z"/>';
const SUNFLOWER = (cx, cy, R) => star(cx, cy, R, R * 0.55, 14, '#f2c230') + `<circle cx="${cx}" cy="${cy}" r="${f1(R * 0.42)}" fill="#6b3e1f"/>`;
const DINO_OUT = ' stroke="#2f4a2c" stroke-width="1.4" stroke-linejoin="round"';

Object.assign(CUSTOM, {
  art: {
    starryNight: t(17, 7.5, 'Playfair Display', 'THE STARRY NIGHT', ' letter-spacing="1"')
      + `<g transform="translate(12 22) scale(0.76 0.7)">${NIGHT}</g>`
      + [30.5, 49.5, 68.5].map(x => `<rect x="${x}" y="21" width="1.6" height="51" fill="#fffffe"/>`).join('')
      + t(81, 6.5, 'Playfair Display', 'VINCENT VAN GOGH', ' letter-spacing="1"') + t(88, 4, 'Playfair Display', 'OIL ON CANVAS', ' letter-spacing="1.5"') + t(94, 4, 'Playfair Display', '· 1889 ·'),
    atNight: tx(12, 14, 13, 'Abril Fatface', '1889') + tx(12, 26, 10, 'Abril Fatface', 'AT NIGHT')
      + `<g transform="translate(30 30) scale(0.58 0.77)">${NIGHT}</g>`
      + '<rect x="58" y="29" width="2" height="56" fill="#fffffe"/><rect x="29" y="56" width="60" height="2" fill="#fffffe"/>'
      + tx(12, 96, 10, 'Abril Fatface', 'VAN GOGH'),
    greatWave: '<rect x="12" y="10" width="76" height="64" rx="3" fill="#efe2c4"/>'
      + '<path fill="#3a4f7a" d="M56 66 L66 52 L76 66Z"/><path fill="#ffffff" d="M63 56 L66 52 L69 56 L67 55 L66 57 L65 55Z"/>'
      + '<path fill="#2e5596" d="M50 74 C58 64 72 62 88 66 V74Z"/>'
      + '<path fill="#1f3b73" d="M12 74 V50 C14 34 28 22 44 22 C56 22 62 30 60 38 C56 34 50 34 48 40 C46 46 52 50 58 48 C52 56 40 58 32 66 C40 64 48 66 54 74Z"/>'
      + '<path fill="none" stroke="#9cc3ee" stroke-width="1.6" d="M18 66 C20 50 30 36 44 30 M22 70 C26 58 34 48 46 42"/>'
      + [[44, 22], [50, 23.5], [55, 26], [59, 30], [60, 35], [57, 37.5], [52, 36.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#ffffff"/>`).join('')
      + t(85, 8, 'Playfair Display', 'THE GREAT WAVE', ' letter-spacing="1"') + t(93, 4.5, 'Playfair Display', 'HOKUSAI · 1831', ' letter-spacing="1.5"'),
    sunflowers: t(10, 8, 'Playfair Display', 'SUNFLOWERS', ' letter-spacing="2"')
      + '<path fill="none" stroke="#5a7d2a" stroke-width="2" d="M36 30 C40 46 46 56 48 66 M62 24 C58 42 54 56 52 66 M50 46 L50 66"/>'
      + SUNFLOWER(36, 30, 11) + SUNFLOWER(62, 24, 12) + SUNFLOWER(50, 46, 9)
      + '<path fill="#d8a33a" d="M38 64 C34 74 36 84 40 90 H60 C64 84 66 74 62 64Z"/><rect x="36" y="62" width="28" height="4" rx="2" fill="#b7842a"/>'
      + t(97, 5, 'Playfair Display', 'VINCENT VAN GOGH · 1888', ' letter-spacing="1"'),
    anatomy: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M44 34 C30 30 18 44 22 60 C26 76 42 90 54 92 C66 90 78 78 78 62 C78 48 70 38 60 36 C56 35 50 36 44 34Z"/>'
      + '<path d="M48 36 C46 24 50 14 60 12 C70 10 76 16 76 24 M56 36 C56 28 60 22 66 22 C70 22 72 26 72 30 M56 13 V6 M63 11 V4 M70 13 L73 6"/>'
      + '<path d="M40 36 C36 28 30 26 22 28 M42 40 C36 36 30 36 24 38 M34 40 C32 30 32 22 34 14 M38 38 C37 30 38 22 40 14"/>'
      + '<path d="M48 48 C52 62 50 76 54 88 M30 56 C34 52 40 52 44 56 M60 50 C64 56 66 64 64 72" stroke-width="1.4"/></g>',
    spider: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
      + [[-1, 1], [1, 1]].map(([s]) => [[40, 22, 20, 8], [44, 30, 10, 30], [44, 40, 8, 58], [42, 50, 22, 88]]
        .map(([kx, ky, fx, fy]) => `<path d="M${50 + s * 6} ${44 + (ky - 36) * 0.3} L${50 + s * (50 - kx) * 1.6} ${ky} L${50 + s * (50 - fx)} ${fy}"/>`).join('')).join('')
      + '</g><circle cx="50" cy="36" r="7" fill="currentColor"/><ellipse cx="50" cy="58" rx="10" ry="15" fill="currentColor"/>',
  },
  varsity: {
    athletics: t(26, 10, 'Dancing Script', 'Department') + ARC('ATHLETICS', 50, 112, 66, 16, 'Playfair Display', 9.5)
      + '<ellipse cx="50" cy="60" rx="14" ry="6.5" fill="currentColor"/>' + t(63.5, 9, 'Playfair Display', '1958', ' fill="#fffffe"')
      + t(80, 11, 'Dancing Script', 'Training Camp'),
    cairoBall: t(28, 24, 'Abril Fatface', 'CAIRO', ' letter-spacing="1"')
      + '<circle cx="39" cy="38" r="5" fill="currentColor"/><circle cx="61" cy="38" r="5" fill="currentColor"/><circle cx="50" cy="48" r="13" fill="currentColor"/>'
      + '<rect x="40" y="43" width="8.5" height="5" rx="2" fill="#1a1a1a" stroke="#fffffe" stroke-width="1"/><rect x="51.5" y="43" width="8.5" height="5" rx="2" fill="#1a1a1a" stroke="#fffffe" stroke-width="1"/>'
      + '<ellipse cx="50" cy="54" rx="5.5" ry="3.8" fill="#fffffe"/><circle cx="50" cy="52.6" r="1.5" fill="currentColor"/>'
      + '<path fill="currentColor" d="M37 62 H63 L67 84 H33Z"/>' + t(78, 11, 'Bebas Neue', '23', ' fill="#fffffe"')
      + '<circle cx="70" cy="76" r="8" fill="#e07b2c"/><path fill="none" stroke="#1a1a1a" stroke-width="0.9" d="M62 76 H78 M70 68 V84 M64.5 70.5 C68 74 68 78 64.5 81.5 M75.5 70.5 C72 74 72 78 75.5 81.5"/>'
      + t(95, 9, 'Bebas Neue', 'BASKETBALL CLUB', ' letter-spacing="2"'),
    natural: ARC('NATURAL', 50, 118, 78, 15, 'Playfair Display', 9.5)
      + '<ellipse cx="50" cy="58" rx="17" ry="11" fill="none" stroke="currentColor" stroke-width="1.6"/>'
      + '<circle cx="50" cy="58" r="5" fill="currentColor"/><path fill="currentColor" d="M35 64 L44 54 L50 60 L57 52 L66 64 C60 67 40 67 35 64Z"/>'
      + '<path fill="none" stroke="currentColor" stroke-width="1" d="M50 49 V46 M43 51 L41 49 M57 51 L59 49"/>'
      + t(80, 6, 'Playfair Display', 'FOREST SUNRISE', ' letter-spacing="1.5"') + t(89, 7, 'Playfair Display', 'NATURAL SCENERY', ' letter-spacing="1"'),
    sweetie: ARC('SWEETIE', 50, 118, 80, 17, 'Abril Fatface', 10, ' fill="#8ec5ea" stroke="currentColor" stroke-width="0.7"')
      + tx(12, 62, 9, 'Dancing Script', 'est.') + tx(72, 62, 9, 'Bebas Neue', '1998', ' letter-spacing="1"')
      + '<path fill="#ffffff" stroke="currentColor" stroke-width="1.4" d="M34 84 C26 84 24 74 31 72 C30 64 40 60 45 66 C48 58 60 58 62 66 C68 62 76 68 72 74 C78 76 76 84 70 84Z"/>'
      + '<circle cx="44" cy="74" r="3.2" fill="#1d1d3a"/><circle cx="57" cy="74" r="3.2" fill="#1d1d3a"/><circle cx="45" cy="73" r="1" fill="#fff"/><circle cx="58" cy="73" r="1" fill="#fff"/>'
      + '<ellipse cx="39" cy="79" rx="2.6" ry="1.6" fill="#f6a5b8"/><ellipse cx="62" cy="79" rx="2.6" ry="1.6" fill="#f6a5b8"/><path d="M48 79 Q50.5 81.5 53 79" fill="none" stroke="#1d1d3a" stroke-width="1"/>',
    surfClub: t(26, 14, 'Bebas Neue', 'ALEXANDRIA', ' letter-spacing="3"')
      + '<circle cx="50" cy="52" r="20" fill="none" stroke="currentColor" stroke-width="2"/>'
      + '<path fill="currentColor" d="M31 56 C38 50 44 58 50 54 C56 50 62 58 69 54 C69 64 60 72 50 72 C40 72 32 66 31 56Z"/><circle cx="50" cy="46" r="7" fill="currentColor"/>'
      + t(87, 15, 'Abril Fatface', 'SURF CLUB') + t(95, 6, 'Bebas Neue', 'SINCE 1975', ' letter-spacing="3"'),
  },
});

Object.assign(CUSTOM.toons, {
  // He pulls her tail, she wants a hug: the tail runs off his right edge and into hers.
  dinoHim: tx(4, 12, 9, 'Caveat', 'what are') + tx(4, 22, 9, 'Caveat', 'you doing?')
    + `<g transform="translate(10 8) scale(0.9)"><path fill="#8cc084"${DINO_OUT} d="M28 94 C24 76 26 56 34 44 C38 36 36 30 40 24 C44 18 54 18 58 24 C62 30 60 38 56 42 C64 52 66 72 64 84 C76 86 88 84 98 80 L98 88 C86 94 72 96 60 94Z"/>`
    + '<path fill="#5e9a5a" d="M37 38 L31 38 L35 33Z M33 50 L26 50 L31 44Z M30 62 L23 63 L28 56Z M29 74 L22 76 L27 68Z"/>'
    + '<ellipse cx="46" cy="72" rx="10" ry="15" fill="#cfe6c7"/><circle cx="52" cy="29" r="2.2" fill="#222"/><path fill="#8cc084"' + DINO_OUT + ' d="M58 52 C64 54 66 58 64 62 C61 60 58 58 56 56Z"/></g>',
  dinoHer: tx(62, 12, 9, 'Caveat', 'miss you') + tx(62, 22, 9, 'Caveat', 'hug me!')
    + `<path fill="#8cc084"${DINO_OUT} d="M0 82 C10 84 22 84 34 81 L34 89 C22 92 10 92 0 90Z"/>`
    + `<g transform="translate(6 8) scale(0.9)"><path fill="#a9d8f0" stroke="#2c5a72" stroke-width="1.4" stroke-linejoin="round" d="M72 94 C76 76 76 56 68 44 C64 36 66 30 62 24 C58 18 48 18 44 24 C40 30 42 38 46 42 C38 52 36 72 38 84 C36 90 38 94 40 94Z"/>`
    + '<path fill="#6fb3d9" d="M65 38 L71 38 L67 33Z M69 50 L76 50 L71 44Z M72 62 L79 63 L74 56Z M73 74 L80 76 L75 68Z"/>'
    + '<ellipse cx="56" cy="72" rx="10" ry="15" fill="#e2f3fb"/><circle cx="50" cy="29" r="2.2" fill="#222"/><ellipse cx="46" cy="34" rx="2.6" ry="1.5" fill="#f6a5b8"/></g>'
    + '<ellipse cx="38" cy="80" rx="6" ry="4" fill="#a9d8f0" stroke="#2c5a72" stroke-width="1.2"/><ellipse cx="40" cy="88" rx="6" ry="4" fill="#a9d8f0" stroke="#2c5a72" stroke-width="1.2"/>',
  foxHim: '<path fill="#e8743b" d="M50 78 L22 52 L18 12 L38 32 H62 L82 12 L78 52Z"/><path fill="#b5522a" d="M22 18 L34 31 L24 36Z M78 18 L66 31 L76 36Z"/>'
    + '<path fill="#fbf3e8" d="M50 78 L28 58 L40 56 L50 64 L60 56 L72 58Z"/>'
    + '<path fill="#222" d="M33 46 C36 42 42 42 44 46 C41 48 36 48 33 46Z M56 46 C58 42 64 42 67 46 C64 48 59 48 56 46Z"/><ellipse cx="50" cy="70" rx="3.5" ry="2.5" fill="#222"/>'
    + t(94, 11, 'Caveat', 'Are you always mine?'),
  bunnyHer: '<ellipse cx="38" cy="26" rx="7" ry="20" fill="#b8bcc8"/><ellipse cx="62" cy="26" rx="7" ry="20" fill="#b8bcc8"/><ellipse cx="38" cy="27" rx="3.5" ry="15" fill="#f3b4c4"/><ellipse cx="62" cy="27" rx="3.5" ry="15" fill="#f3b4c4"/>'
    + '<ellipse cx="50" cy="62" rx="23" ry="19" fill="#b8bcc8"/><ellipse cx="50" cy="69" rx="10" ry="7" fill="#eef0f4"/>'
    + '<circle cx="41" cy="58" r="3.4" fill="#222"/><circle cx="59" cy="58" r="3.4" fill="#222"/><circle cx="42" cy="57" r="1.1" fill="#fff"/><circle cx="60" cy="57" r="1.1" fill="#fff"/>'
    + '<path fill="#f08aa3" d="M47 65 H53 L50 68Z"/><ellipse cx="34" cy="66" rx="3.5" ry="2" fill="#f6a5b8"/><ellipse cx="66" cy="66" rx="3.5" ry="2" fill="#f6a5b8"/>'
    + t(94, 10, 'Caveat', 'Yes, I&#8217;m yours forever'),
});

Object.assign(CUSTOM.couples, {
  // Small sleeve words, embroidery style.
  youMine: t(44, 24, 'Playfair Display', 'you are') + t(70, 24, 'Playfair Display', 'mine'),
  foreverYours: t(44, 24, 'Playfair Display', 'Forever') + t(70, 24, 'Playfair Display', 'yours'),
  nothingSense: t(40, 18, 'Playfair Display', 'Nothing') + t(62, 16, 'Playfair Display', 'makes sense'),
  whenApart: t(40, 18, 'Playfair Display', 'when') + t(62, 16, 'Playfair Display', 'we&#8217;re apart') + `<g transform="translate(70 66) scale(0.12)"><path fill="currentColor" d="${HEART}"/></g>`,
  puzzleHeart: `<g transform="translate(14 4) scale(0.72)"><path fill="none" stroke="currentColor" stroke-width="5" d="${HEART}"/></g>`
    + '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2" d="M40 30 H47 A5 5 0 1 1 55 30 H62 V37 A5 5 0 1 0 62 45 V52 H40Z"/>' + t(88, 12, 'Caveat', 'a complete me'),
  puzzlePiece: '<path fill="currentColor" d="M34 26 H45 A7 7 0 1 1 57 26 H68 V37 A7 7 0 1 0 68 49 V60 H34Z"/>' + t(88, 12, 'Caveat', 'a complete me'),
});

{ // Show the new categories next to the related ones.
  const order = ['cmg', 'words', 'vibes', 'art', 'varsity', 'toons', 'couples', 'football', 'egypt', 'badges'];
  const all = { ...CUSTOM };
  for (const k of Object.keys(CUSTOM)) delete CUSTOM[k];
  for (const k of [...order, ...Object.keys(all)]) if (all[k] && !CUSTOM[k]) CUSTOM[k] = all[k];
}

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
