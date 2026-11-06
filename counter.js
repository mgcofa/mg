// Anonymous visit counts for the stats page (stats.html): no names, no IPs, nothing about who the visitor is.
// Counts live in a free public counter service (Abacus), one number per key.
// Only the live site counts into the real numbers; local copies count into a test set.
export const COUNTER_NS = location.hostname.endsWith('github.io') ? 'mgcofa-cmg' : 'mgcofa-cmg-test';
const BASE = 'https://abacus.jasoncameron.dev';

// Day key in Cairo time, e.g. 20261106.
export const dayKey = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d).replaceAll('-', '');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
// The owner's own browser (marked by opening stats.html) is never counted.
const skip = () => store.get('cmg-nocount') === '1' || /[?&]nocount\b/.test(location.search);

export function hit(...keys) {
  if (skip()) return;
  for (const k of keys) fetch(`${BASE}/hit/${COUNTER_NS}/${k}`, { keepalive: true }).catch(() => {});
}

// Where the visitor came from, from the ad link or the page that sent them.
function source() {
  const q = new URLSearchParams(location.search), utm = (q.get('utm_source') || '').toLowerCase(), ref = document.referrer.toLowerCase();
  if (/whatsapp|wa\.me/.test(utm + ref)) return 'whatsapp';
  if (/instagram/.test(utm + ref)) return 'instagram';
  if (q.has('fbclid') || /facebook|fb\.|m\.facebook/.test(utm + ref)) return 'facebook';
  if (/tiktok/.test(utm + ref)) return 'tiktok';
  if (/google\./.test(ref)) return 'google';
  return ref && !ref.includes(location.host) ? 'other' : 'direct';
}

// One page view; a new visitor the first time this browser comes; a daily visitor once per day.
export function countVisit() {
  const d = dayKey(), keys = ['visits', `visits-${d}`];
  if (!store.get('cmg-seen')) {
    store.set('cmg-seen', d);
    keys.push('new', `new-${d}`, `src-${source()}`, `dev-${matchMedia('(pointer: coarse)').matches ? 'phone' : 'computer'}`);
  }
  if (store.get('cmg-day') !== d) { store.set('cmg-day', d); keys.push(`people-${d}`); }
  hit(...keys);
}

export function countOrder() { hit('orders', `orders-${dayKey()}`); }
