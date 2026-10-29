// Sends the contact form. "function" posts to our own /api/contact (checks Turnstile, then emails via Resend);
// "web3forms" / "formspree" post straight to those services; "mailto" is the fallback when nothing is set up.
const form = document.getElementById('contact-form');
const status = form.querySelector('.form__status');
const { method, key, email } = form.dataset;

const say = (msg, error = false) => {
  status.textContent = msg;
  status.classList.toggle('is-error', error);
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  if (data.botcheck) return; // honeypot: bots fill this in, people can't see it

  if (method === 'mailto') {
    const body = `${data.message}\n\nFrom: ${data.name} (${data.email})\nPlanning: ${data.shoot_type} ${data.date || ''}`;
    location.href = `mailto:${email}?subject=${encodeURIComponent('Enquiry from ' + data.name)}&body=${encodeURIComponent(body)}`;
    return;
  }

  const send = {
    function: () => fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    web3forms: () => fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...data, access_key: key, subject: `Enquiry from ${data.name}` }) }),
    formspree: () => fetch(`https://formspree.io/f/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) }),
  }[method];

  const button = form.querySelector('button');
  button.disabled = true;
  say('Sending...');
  try {
    const res = await send();
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false || json.success === false) throw new Error(json.error || json.message);
    form.reset();
    window.turnstile?.reset();
    say('Thank you! Your message is on its way. I will reply soon.');
  } catch (err) {
    say(`Sorry, that did not send${email ? `. Please email ${email} directly` : ''}.`, true);
    window.turnstile?.reset();
  } finally {
    button.disabled = false;
  }
});

// The message box starts small and grows as the visitor types.
const box = form.querySelector('textarea');
const grow = () => { box.style.height = 'auto'; box.style.height = box.scrollHeight + 'px'; };
box.addEventListener('input', grow);
