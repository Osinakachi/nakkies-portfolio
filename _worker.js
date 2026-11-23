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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') return handleForm('contact', request, env);
    if (pathname === '/api/subscribe') return handleForm('subscribe', request, env);
    return env.ASSETS.fetch(request);
  }
};
