// Receives the contact form, checks the Turnstile spam test, and emails the owner through Resend.
// Settings (Cloudflare dashboard -> Pages project -> Settings -> Variables and Secrets):
//   TURNSTILE_SECRET  - Turnstile secret key (Encrypt)
//   RESEND_API_KEY    - Resend API key (Encrypt)
//   CONTACT_TO        - the email address that should receive enquiries
//   CONTACT_FROM      - optional; defaults to Resend's test sender "onboarding@resend.dev"
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const bad = (s) => /[\r\n]/.test(s);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }

  if (body.botcheck) return json({ ok: true }); // honeypot filled: pretend success

  const missing = ['TURNSTILE_SECRET', 'RESEND_API_KEY', 'CONTACT_TO'].filter((k) => !env[k]);
  if (missing.length) return json({ ok: false, error: `The form is not set up yet (missing ${missing.join(', ')}).` }, 500);

  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: clean(body['cf-turnstile-response'], 4096),
      remoteip: request.headers.get('CF-Connecting-IP') ?? '',
    }),
  }).then((r) => r.json()).catch(() => ({ success: false }));
  if (!verify.success) return json({ ok: false, error: 'Spam check failed. Please try again.' }, 400);

  const name = clean(body.name, 100), email = clean(body.email, 200), message = clean(body.message, 5000);
  const type = clean(body.shoot_type, 60), date = clean(body.date, 30);
  if (!name || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || bad(name) || bad(email)) {
    return json({ ok: false, error: 'Please fill in your name, email and message.' }, 400);
  }

  const text = `New enquiry from ${name} <${email}>\nPlanning: ${type || 'not specified'}\nDate: ${date || 'not specified'}\n\n${message}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM || 'Website <onboarding@resend.dev>',
      to: [env.CONTACT_TO], reply_to: email, subject: `Website enquiry from ${name}`, text,
    }),
  });
  if (!res.ok) return json({ ok: false, error: 'Could not send the email. Please try again later.' }, 502);
  return json({ ok: true });
}
