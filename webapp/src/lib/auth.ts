// Signed session cookie, shared by the middleware (Edge runtime) and the
// /api/auth routes (Node runtime) — so only Web Crypto is used here.
//
// Token = base64url("<user>:<expiry-sec>") + "." + base64url(HMAC-SHA256(AUTH_SECRET, payload))
// Rotating AUTH_SECRET in .env logs everyone out.

export const SESSION_COOKIE = 'noc_session';
export const SESSION_TTL_SEC = 12 * 3600;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmac(data: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

/** Constant-time compare for equal-length strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Checks against DASHBOARD_USER / DASHBOARD_PASSWORD. Both sides are HMAC'd first so the compare is fixed-length. */
export async function checkCredentials(user: string, pass: string): Promise<boolean> {
  const wantUser = process.env.DASHBOARD_USER || 'admin';
  const wantPass = process.env.DASHBOARD_PASSWORD;
  if (!wantPass) return false;
  return safeEqual(await hmac(`${user}\n${pass}`), await hmac(`${wantUser}\n${wantPass}`));
}

export async function createSession(user: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = b64url(enc.encode(`${user}:${exp}`));
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the username for a valid, unexpired token, else null. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token || !process.env.AUTH_SECRET) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmac(payload))) return null;
  let decoded: string;
  try { decoded = fromB64url(payload); } catch { return null; }
  const i = decoded.lastIndexOf(':');
  const exp = Number(decoded.slice(i + 1));
  if (i < 1 || !(exp > Date.now() / 1000)) return null;
  return decoded.slice(0, i);
}
