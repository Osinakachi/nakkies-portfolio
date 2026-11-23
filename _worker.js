// Cloudflare Pages "advanced mode" worker. One file, no folders.
// Handles the two form endpoints and serves every other request from the static files.

const DEFAULT_TO = 'osinakachi.anyachebelu@gmail.com';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

// Only accept submissions that come from this site.
const sameOrigin = (request) => {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
};

async function readBody(request) {
  const text = await request.text();
  if (text.length > 20000) throw new Error('too_large');
  return JSON.parse(text || '{}');
}

const clean = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const isEmail = (v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Sends one email through Resend (https://resend.com).
// Secret: RESEND_API_KEY. Optional variables: TO_EMAIL, FROM_EMAIL.
async function sendMail(env, { subject, text, replyTo }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'Portfolio <onboarding@resend.dev>',
      to: [env.TO_EMAIL || DEFAULT_TO],
      reply_to: replyTo,
      subject,
      text
    })
  });
  if (!res.ok) throw new Error(`Mail provider error ${res.status}`);
}

async function handleForm(kind, request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);

  let body;
  try { body = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Honeypot: real visitors never fill this field. Pretend it worked.
  if (clean(body.company, 100)) return json({ ok: true });

  const email = clean(body.email, 254);
  if (!isEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  let mail;
  if (kind === 'contact') {
    const name = clean(body.name, 100).replace(/\n/g, ' ');
    const message = clean(body.message, 5000);
    if (message.length < 2) return json({ ok: false, error: 'message_required' }, 400);
    mail = {
      subject: name ? `New message from ${name}` : 'New message from your portfolio',
      replyTo: email,
      text: `${name ? `Name: ${name}\n` : ''}Email: ${email}\n\n${message}`
    };
  } else {
    mail = {
      subject: 'New newsletter subscriber',
      replyTo: email,
      text: `${email} subscribed to the newsletter on your portfolio.`
    };
  }

  try {
    await sendMail(env, mail);
  } catch (err) {
    console.error(err.message);
    return json({ ok: false, error: 'send_failed' }, 502);
  }
  return json({ ok: true });
}


// ---------------------------------------------------------------- password-protected case studies
// Everything under /moneris (moneris.html, moneris-*.html) is only served with a valid session cookie.
// The password is the secret CASE_STUDY_PASSWORD (Cloudflare > Variables and Secrets). It is never in the code.
const GATED = /^\/moneris([-/.]|$)/i;
const COOKIE = 'cs_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7; // one week
const enc = new TextEncoder();

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

// Compares two strings without leaking where they differ.
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

async function hasSession(request, env) {
  if (!env.CASE_STUDY_PASSWORD) return false;
  const value = getCookie(request, COOKIE);
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, await hmac(env.CASE_STUDY_PASSWORD, `session:${exp}`));
}

const privateHeaders = (res) => {
  const h = new Headers(res.headers);
  h.set('Cache-Control', 'private, no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return h;
};

async function fetchAsset(request, env, path) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = '';
  let res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
  for (let i = 0; i < 3 && res.status >= 300 && res.status < 400; i++) {
    res = await env.ASSETS.fetch(new Request(new URL(res.headers.get('Location'), url), { method: 'GET' }));
  }
  return res;
}

async function handleUnlock(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (!env.CASE_STUDY_PASSWORD) return json({ ok: false, error: 'not_configured' }, 503);

  let body;
  try { body = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Not case-sensitive, so NAKKIE, nakkie and Nakkie all work.
  const norm = (v) => String(v ?? '').trim().toUpperCase().slice(0, 200);
  const ok = await safeEqual(norm(body.password), norm(env.CASE_STUDY_PASSWORD));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slows down guessing
    return json({ ok: false, error: 'wrong_password' }, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const sig = await hmac(env.CASE_STUDY_PASSWORD, `session:${exp}`);
  const res = json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${exp}.${sig}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
  return res;
}

async function handleGated(request, env) {
  if (await hasSession(request, env)) {
    const res = await env.ASSETS.fetch(request);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: privateHeaders(res) });
  }
  // Not signed in: show the unlock page, never the case study.
  const page = await fetchAsset(request, env, '/unlock');
  const headers = privateHeaders(page);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(page.body, { status: 401, headers });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') return handleForm('contact', request, env);
    if (pathname === '/api/subscribe') return handleForm('subscribe', request, env);
    if (pathname === '/api/unlock') return handleUnlock(request, env);
    if (GATED.test(pathname)) return handleGated(request, env);
    return env.ASSETS.fetch(request);
  }
};
