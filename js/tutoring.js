// Tutoring page settings. EDIT HERE: prices, form endpoint, email for the form, payment.
// (Phone and email shown in the "Book a session" section are written directly in tutoring/index.html.)
// The page reads these values and fills them in, so there is only one place to change them.
const TUTORING = {
  PRICE_30: 15, // dollars per 30-minute session
  PRICE_60: 28, // dollars per 60-minute session. TODO: Austen to confirm this number.
  FIRST_SESSION_DISCOUNT: 'Half-price first session',

  // TODO: paste a form endpoint (e.g. https://formspree.io/f/xxxxxxx). Until then the form
  // opens the visitor's email app instead, addressed to CONTACT_EMAIL.
  FORM_ENDPOINT: '[FORM_ENDPOINT]',

  // Email the contact form sends to (via the visitor's email app) until FORM_ENDPOINT is set.
  CONTACT_EMAIL: 'austenjames08@gmail.com',

  // TODO: payment details. Leave a value as-is to hide it. Zelle is sent privately at booking
  // (a Zelle handle is usually a phone number or email, so it is never shown on the page).
  VENMO_HANDLE: '[VENMO_HANDLE]',
  CARD_PAYMENT_URL: '[CARD_PAYMENT_URL]',
};

(() => {
  const isSet = (v) => typeof v === 'string' ? v.trim() !== '' && !/^\[.*\]$/.test(v.trim()) : v != null;
  const money = (n) => { const v = Number(n); return `$${Number.isInteger(v) ? v : v.toFixed(2)}`; };

  // ---------- Prices ----------
  document.querySelectorAll('[data-price]').forEach((el) => {
    const key = el.dataset.price;
    if (key === '30') el.textContent = money(TUTORING.PRICE_30);
    if (key === '60') el.textContent = money(TUTORING.PRICE_60);
    if (key === 'first30') el.textContent = money(TUTORING.PRICE_30 / 2);
    if (key === 'first60') el.textContent = money(TUTORING.PRICE_60 / 2);
  });
  document.querySelectorAll('[data-discount]').forEach((el) => { el.textContent = TUTORING.FIRST_SESSION_DISCOUNT; });

  // ---------- Payment ----------
  const payExtra = document.getElementById('pay-extra');
  const bits = [];
  if (isSet(TUTORING.VENMO_HANDLE)) bits.push(`Venmo: ${TUTORING.VENMO_HANDLE}`);
  if (bits.length) payExtra.textContent = ` ${bits.join(' · ')}.`;
  const cardLink = document.getElementById('card-link');
  if (isSet(TUTORING.CARD_PAYMENT_URL)) { cardLink.href = TUTORING.CARD_PAYMENT_URL; cardLink.hidden = false; }

  // ---------- Contact form ----------
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const under18 = form.querySelectorAll('input[name="under18"]');
  const guardian = document.getElementById('f-guardian');
  const guardianRow = document.getElementById('guardian-row');

  function syncGuardian() {
    const minor = form.querySelector('input[name="under18"]:checked')?.value === 'yes';
    guardian.required = minor;
    guardianRow.classList.toggle('required', minor);
  }
  under18.forEach((r) => r.addEventListener('change', syncGuardian));
  syncGuardian();

  if (isSet(TUTORING.FORM_ENDPOINT)) form.action = TUTORING.FORM_ENDPOINT;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);

    // With a real endpoint: send the form there (nothing is stored by this website itself).
    if (isSet(TUTORING.FORM_ENDPOINT)) {
      status.textContent = 'Sending…';
      try {
        const res = await fetch(TUTORING.FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error();
        form.reset(); syncGuardian();
        status.textContent = 'Thanks! Your message was sent. I’ll reply by email.';
      } catch (err) {
        status.textContent = 'Sorry, that didn’t send. Please try again or email me directly.';
      }
      return;
    }

    // No endpoint yet: open the visitor's own email app with the message filled in.
    if (isSet(TUTORING.CONTACT_EMAIL)) {
      const lines = [
        `Student name: ${data.get('name')}`,
        `Contact email: ${data.get('email')}`,
        `Student under 18: ${data.get('under18') === 'yes' ? 'Yes' : 'No'}`,
        `Parent/guardian email: ${data.get('guardian') || '—'}`,
        `Grade: ${data.get('grade')}`,
        `Course: ${data.get('course')}`,
        '',
        `${data.get('message')}`,
      ];
      const subject = encodeURIComponent(`Tutoring inquiry: ${data.get('course')}`);
      const body = encodeURIComponent(lines.join('\n'));
      window.location.href = `mailto:${TUTORING.CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      status.textContent = 'Your email app should open with the message ready to send.';
      return;
    }

    status.textContent = 'The contact form isn’t set up yet. Please check back soon.';
  });
})();
