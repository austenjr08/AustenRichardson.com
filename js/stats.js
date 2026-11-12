// Privacy-friendly visitor stats: no cookies, no IP addresses, nothing personal.
// Each page view (and a few fun events) is sent to a Google Apps Script that adds a row
// to the "Visitor Stats" spreadsheet in Austen's Google Drive.
(() => {
  // Web app URL from Apps Script (Deploy → Web app). Empty = stats switched off.
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbykwtgXMuClrXkpQo0UINql3SLstRq4Xlk2CnyBaJJoWST1w8QkdcuGNrvK0zN4AlBsYQ/exec';
  // Only count the real site, so local testing never shows up in the spreadsheet.
  const LIVE = /(^|\.)austenrichardson\.com$/i.test(location.hostname);

  // A random ID that lasts only for this tab's visit, so one person clicking around
  // counts as one visit. It is never stored after the tab closes.
  let vid = '';
  try {
    vid = sessionStorage.getItem('vid') || '';
    if (!vid) { vid = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('vid', vid); }
  } catch (e) {}

  function cameFrom() {
    if (!document.referrer) return 'direct';
    try {
      const h = new URL(document.referrer).hostname.replace(/^www\./, '');
      return /(^|\.)austenrichardson\.com$/i.test(h) ? 'inside site' : h;
    } catch (e) { return 'unknown'; }
  }

  function device() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (!coarse) return 'desktop';
    return Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'phone';
  }

  function send(event, detail) {
    if (!ENDPOINT || !LIVE) return;
    const page = location.pathname.replace(/\/index\.html$/, '/').replace(/^\/pages\//, '').replace(/\.html$/, '') || '/';
    const body = JSON.stringify({
      event, detail: detail || '', page: page === '/' ? 'home' : page,
      ref: cameFrom(), device: device(), screen: `${screen.width}x${screen.height}`, vid,
    });
    try {
      if (!navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) throw 0;
    } catch (e) {
      fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body }).catch(() => {});
    }
  }

  window.siteStats = { send };
  send('page view');
})();
