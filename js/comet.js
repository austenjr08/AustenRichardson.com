// Comet easter-egg page: certificate details, rotating space puns, and confetti.
(() => {
  // ---------- Certificate ----------
  const dateEl = document.getElementById('cert-date');
  dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const num = Date.now().toString(36).toUpperCase().slice(-6);
  document.getElementById('cert-number').textContent = `No. ${num}`;

  const nameInput = document.getElementById('catcher');
  document.getElementById('save').addEventListener('click', () => {
    if (!nameInput.value.trim()) nameInput.value = 'A Very Observant Visitor';
    window.print();
  });

  // ---------- Puns ----------
  const PUNS = [
    'I tried to start a band in space, but there was no atmosphere.',
    'How do you organize a party in space? You planet.',
    'Why did the comet break up with the asteroid? It needed more space.',
    'What did the comet say to the planet? “Nice to meteor.”',
    'How does the solar system hold up its pants? With an asteroid belt.',
    'What did Saturn say to Jupiter? “Give me a ring sometime.”',
    'What’s an astronaut’s favorite key on the keyboard? The space bar.',
    'Why didn’t the Dog Star laugh at the joke? It was too Sirius.',
    'What kind of music do planets listen to? Neptunes.',
    'I’m reading a book about anti-gravity. It’s impossible to put down.',
    'Why is the moon always broke? It’s down to its last quarter.',
    'The moon is never hungry. It’s always full.',
    'Where do astronauts park their spaceships? At a parking meteor.',
    'What do you call a tick on the moon? A luna-tick.',
    'Why did the sun skip college? It already had a million degrees.',
    'A photon checks into a hotel. “Any luggage?” “No thanks, I’m traveling light.”',
    'A neutron walks into a bar and asks for a drink. The bartender says, “For you? No charge.”',
    'Why don’t scientists trust atoms? They make up everything.',
    'How do you get a baby astronaut to sleep? You rocket.',
    'What did Mars say to Earth? “You’ve got life. I’ve only got dust.”',
  ];
  const punEl = document.getElementById('pun');
  let last = -1;
  function nextPun() {
    let i;
    do { i = Math.floor(Math.random() * PUNS.length); } while (i === last);
    last = i;
    punEl.classList.add('fading');
    setTimeout(() => { punEl.textContent = PUNS[i]; punEl.classList.remove('fading'); }, punEl.textContent ? 220 : 0);
  }
  nextPun();
  document.getElementById('another').addEventListener('click', nextPun);

  // ---------- Confetti ----------
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  const COLORS = ['#ffd166', '#ffb23f', '#ff6b6b', '#f06595', '#9fd8ff', '#6f8dff', '#63e6be', '#ffffff'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, pieces = [], running = false, lastT = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const rand = (a, b) => a + Math.random() * (b - a);

  function makePiece(x, y, vx, vy, delay) {
    return {
      x, y, vx, vy, delay,
      w: rand(6, 11), h: rand(10, 18),
      shape: Math.random() < 0.18 ? 'circle' : Math.random() < 0.12 ? 'star' : 'rect',
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: rand(0, Math.PI * 2), vr: rand(-6, 6),
      flip: rand(0, Math.PI * 2), vflip: rand(4, 10),
      sway: rand(0, Math.PI * 2), swayAmt: rand(20, 60),
    };
  }

  // A pop from a point, then a shower of pieces falling from the top of the screen.
  function launch(originX, originY, burstCount, rainCount) {
    if (reduced) { burstCount = Math.round(burstCount / 4); rainCount = Math.round(rainCount / 4); }
    for (let i = 0; i < burstCount; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const s = rand(350, 900);
      pieces.push(makePiece(originX, originY, Math.cos(a) * s, Math.sin(a) * s, 0));
    }
    for (let i = 0; i < rainCount; i++) {
      pieces.push(makePiece(rand(0, W), rand(-60, -20), rand(-40, 40), rand(60, 220), rand(0, 1.6)));
    }
    if (!running) { running = true; lastT = performance.now(); requestAnimationFrame(tick); }
  }

  function drawStar(r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - lastT) / 1000);
    lastT = now;
    ctx.clearRect(0, 0, W, H);
    const G = 900, DRAG = 1.6;
    for (const p of pieces) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.vy += G * dt * 0.55;
      p.vx -= p.vx * DRAG * dt;
      p.vy -= p.vy * DRAG * dt * 0.6;
      p.sway += dt * 3;
      p.x += (p.vx + Math.sin(p.sway) * p.swayAmt) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vflip * dt;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip)); // paper turning over in the air
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else if (p.shape === 'star') drawStar(p.w * 0.8);
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    pieces = pieces.filter((p) => p.y < H + 40 && p.x > -80 && p.x < W + 80);
    if (pieces.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  // Celebrate on arrival
  window.addEventListener('load', () => launch(W / 2, H * 0.35, 160, 170));
  // Pressing the wax seal throws more confetti from the seal itself
  document.getElementById('seal').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    launch(r.left + r.width / 2, r.top + r.height / 2, 120, 60);
  });
})();
