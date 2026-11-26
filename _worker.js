// Cloudflare Pages "advanced mode" worker. One file, no folders.
// Jobs: the contact form endpoint, security headers, cache rules, redirects,
// a deny-list for internal files, and serving every other request from the static files.
// No secrets live here. Set RESEND_API_KEY (secret), TO_EMAIL and FROM_EMAIL (variables) in Cloudflare.

const DEFAULT_TO = 'osinakachi.anyachebelu@gmail.com';

// ---------------------------------------------------------------- security headers
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Webflow animations set inline styles; scripts stay strict
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'"
].join('; ');

const SECURITY = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

const cacheFor = (pathname, type) => {
  if (/^\/(site\.[0-9a-f]{8}\.(css|js)|poppins-[^/]+\.woff2?|webflow[^/]*\.js|jquery[^/]*\.js)$/.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/^\/(robots\.txt|sitemap\.xml|llms\.txt|manifest\.webmanifest)$/.test(pathname)) return 'public, max-age=3600';
  if (/^image\//.test(type) || /^font\//.test(type)) return 'public, max-age=86400';
  if (/text\/html/.test(type)) return 'public, max-age=0, must-revalidate';
  return 'public, max-age=3600';
};

function withHeaders(res, pathname, extra = {}) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
  const type = h.get('Content-Type') || '';
  if (!h.has('Cache-Control') || !pathname.startsWith('/api/')) h.set('Cache-Control', cacheFor(pathname, type));
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// ---------------------------------------------------------------- redirects and deny-list
const SLUGS = ['reporting', 'invoicing-virtual-terminal', 'recurring-vault-installments', 'access-design-system'];

function redirectFor(pathname) {
  let m = pathname.match(/^\/project-([a-z0-9-]+)\/?$/i);
  if (m && SLUGS.includes(m[1].toLowerCase())) return '/moneris-' + m[1].toLowerCase();
  if (/^\/(unlock|case-studies?)\/?$/i.test(pathname)) return '/moneris';
  if (/^\/(blog|shop|post|posts|projects?)(\/.*)?$/i.test(pathname)) return '/work';
  if (/^\/post-[^/]+\/?$/i.test(pathname)) return '/work';
  if (pathname === '/index.html') return '/';
  return null;
}

const DENY = /^\/(_worker\.js|build\.py|make_assets\.py|wrangler\.jsonc|assetsignore\.txt|build-report\.txt|(site|profile|projects|moneris|fonts)\.json|home\.(template|raw)\.html|[a-z-]+\.partial\.html|.*\.md|nav_ids\.json|pages\.css|site\.js)$/i;

// ---------------------------------------------------------------- forms
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Only accept submissions that come from this site.
const sameOrigin = (request) => {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
};

async function readBody(request) {
  const text = await request.text();
  if (text.length > 20000) throw new Error('too_large');
  return JSON.parse(text || '{}');
}

const clean = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const isEmail = (v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Best-effort rate limit per visitor, per worker instance: 5 sends per 10 minutes.
const hits = new Map();
function limited(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (list.length >= 5) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear();
  return false;
}

// Sends one email through Resend (https://resend.com).
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

async function handleContact(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);

  let body;
  try { body = await readBody(request); } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Honeypot: real visitors never fill this field. Pretend it worked.
  if (clean(body.company, 100)) return json({ ok: true });

  if (limited(request)) return json({ ok: false, error: 'too_many' }, 429);

  const email = clean(body.email, 254);
  if (!isEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  const name = clean(body.name, 100).replace(/\n/g, ' ');
  const message = clean(body.message, 5000);
  if (message.length < 2) return json({ ok: false, error: 'message_required' }, 400);

  try {
    await sendMail(env, {
      subject: name ? `New message from ${name}` : 'New message from your portfolio',
      replyTo: email,
      text: `${name ? `Name: ${name}\n` : ''}Email: ${email}\n\n${message}`
    });
  } catch (err) {
    console.error(err.message);
    return json({ ok: false, error: 'send_failed' }, 502);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------- entry
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/contact') return withHeaders(await handleContact(request, env), pathname);
    if (pathname.startsWith('/api/')) return withHeaders(json({ ok: false, error: 'not_found' }, 404), pathname);

    const to = redirectFor(pathname);
    if (to) return withHeaders(new Response(null, { status: 301, headers: { Location: to } }), pathname);

    let res;
    if (DENY.test(pathname)) {
      res = new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } else if (request.method !== 'GET' && request.method !== 'HEAD') {
      res = new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    } else {
      res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        const nf = await env.ASSETS.fetch(new Request(new URL('/404', url), { method: 'GET' }));
        res = new Response(nf.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }
    return withHeaders(res, pathname, res.status === 404 ? { 'X-Robots-Tag': 'noindex' } : {});
  }
};
