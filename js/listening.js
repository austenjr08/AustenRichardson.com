// "My most listened this week" on the home page.
// Reads data/spotify-week.json, which a GitHub Action updates every hour from Spotify
// (see scripts/spotify-week.mjs). Weeks start Sunday at midnight, New York time.
(() => {
  const box = document.getElementById('listening');
  if (!box) return;
  const list = document.getElementById('listening-list');
  const foot = document.getElementById('listening-foot');
  const btn = document.getElementById('listening-btn');

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WEEK = 7 * 86400000;

  fetch('data/spotify-week.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (!data || !data.weekStart) return; // not set up yet: keep the chart hidden
      const start = Date.parse(data.weekStart);
      // If the hourly job hasn't run since last week, nothing counts for this week yet.
      const current = Date.now() - start < WEEK;
      const top = current
        ? Object.values(data.tracks || {}).sort((a, b) => b.plays - a.plays || (b.last || '').localeCompare(a.last || '')).slice(0, 5)
        : [];

      list.innerHTML = top.length
        ? top.map((t, i) => `
          <li><a href="${esc(t.url || '#')}" target="_blank" rel="noopener" title="${esc(t.name)} by ${esc(t.artist)} on Spotify">
            <span class="lt-rank">${i + 1}</span>
            ${t.art ? `<img class="lt-art" src="${esc(t.art)}" alt="" loading="lazy" width="40" height="40">` : '<span class="lt-art"></span>'}
            <span class="lt-text">
              <span class="lt-name">${esc(t.name)}</span>
              <span class="lt-artist">${esc(t.artist)}</span>
            </span>
            <span class="lt-plays">${t.plays}<small>play${t.plays === 1 ? '' : 's'}</small></span>
          </a></li>`).join('')
        : '<li class="listening-empty">Nothing played yet this week.</li>';

      const since = current ? new Date(start) : null;
      foot.textContent = since
        ? `Since ${since.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })} · from Spotify`
        : 'From Spotify';
      box.hidden = false;
    })
    .catch(() => {});

  // Small screens: the button opens and closes the chart.
  function setOpen(open) {
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  btn.addEventListener('click', e => { e.stopPropagation(); setOpen(!box.classList.contains('open')); });
  document.addEventListener('pointerdown', e => {
    if (box.classList.contains('open') && !e.target.closest('#listening')) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && box.classList.contains('open')) { setOpen(false); btn.focus(); }
  });
})();
