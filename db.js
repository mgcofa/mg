// The store's data lives in Supabase. This key is the public one: what it can do is limited by the rules in the
// database (anyone may submit a design and read approved ones; only the signed-in owner can see or change the rest).
const BASE = 'https://hizqjetoosbfraurupzv.supabase.co', KEY = 'sb_publishable_3sDmEL3eGtwlFd2pMzNaUA_jRZDLVFu';

async function rest(path, { token, ...opts } = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  if (!r.ok) throw Object.assign(new Error(`db ${r.status}`), { status: r.status });
  const text = await r.text();                     // a write answers with an empty body
  return text ? JSON.parse(text) : null;
}
const quiet = { Prefer: 'return=minimal' };

// ---------- Anyone ----------
export async function submitDesign({ title, designer, phone, pack }) {
  const id = crypto.randomUUID();
  await rest('designs', { method: 'POST', headers: quiet, body: JSON.stringify({ id, title, designer, pack }) });
  await rest('design_contacts', { method: 'POST', headers: quiet, body: JSON.stringify({ design_id: id, phone }) });
}
export const listStore = () => rest('designs?status=eq.approved&order=created_at.desc&select=code,title,designer,product:pack->>product,sides:pack->sides,stripes:pack->stripes,partner_sides:pack->partner->sides,partner_stripes:pack->partner->stripes,preview:pack->>preview');
export async function getDesign(code) {
  const [row] = await rest(`designs?code=eq.${encodeURIComponent(code)}&status=eq.approved&select=code,title,designer,pack&limit=1`);
  return row || null;
}

// An order's PDF goes to a private bucket: visitors can add files there but never read them.
export async function uploadOrderFile(id, file) {
  const path = `${id}/${file.name}`;
  const r = await fetch(`${BASE}/storage/v1/object/orders/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': file.type || 'application/pdf' }, body: file });
  if (!r.ok) throw Object.assign(new Error(`upload ${r.status}`), { status: r.status });
  return path;
}
// The database works out the price itself from its own price list; the total it returns is the real one.
export const placeOrder = o => rest('rpc/place_order', { method: 'POST', body: JSON.stringify({ o }) });

// ---------- Owner ----------
export async function login(email, password) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw Object.assign(new Error('login'), { status: r.status });
  return (await r.json()).access_token;
}
export const listPending = token => rest('designs?status=eq.pending&order=created_at.asc&select=id,title,designer,created_at,pack,design_contacts(phone)', { token });
export const listApproved = token => rest('designs?status=eq.approved&order=created_at.desc&select=id,code,title,designer,design_contacts(phone)', { token });
export async function approve(token, id, title, designer) {
  const rows = await rest('designs?code=not.is.null&select=code', { token });
  const next = rows.reduce((m, d) => Math.max(m, +d.code.slice(1) || 0), 0) + 1, code = 'D' + String(next).padStart(3, '0');
  await rest(`designs?id=eq.${id}`, { token, method: 'PATCH', headers: quiet, body: JSON.stringify({ status: 'approved', code, title, designer }) });
  return code;
}
export const takeDown = (token, id) => rest(`designs?id=eq.${id}`, { token, method: 'PATCH', headers: quiet, body: JSON.stringify({ status: 'rejected' }) });
export const reject = (token, id) => rest(`designs?id=eq.${id}`, { token, method: 'DELETE', headers: quiet });

export const listOrders = token => rest('orders?select=*&order=created_at.desc&limit=300', { token });
export const setOrderStatus = (token, id, status) => rest(`orders?id=eq.${id}`, { token, method: 'PATCH', headers: quiet, body: JSON.stringify({ status }) });
export async function orderFileUrl(token, path) {
  const r = await fetch(`${BASE}/storage/v1/object/sign/orders/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
  if (!r.ok) throw Object.assign(new Error(`sign ${r.status}`), { status: r.status });
  return `${BASE}/storage/v1${(await r.json()).signedURL}`;
}
