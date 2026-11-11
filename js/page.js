// Static starfield background for the content pages.
(() => {
  const c = document.getElementById('stars');
  if (!c) return;
  const g = c.getContext('2d');
  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    g.scale(dpr, dpr);
    const n = Math.round((w * h) / 2200);
    for (let i = 0; i < n; i++) {
      const r = Math.pow(Math.random(), 3) * 1.2 + 0.25;
      g.fillStyle = `rgba(225,230,255,${0.2 + Math.random() * 0.6})`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  draw();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
})();
