/*
 * AustenRichardson.com — interactive solar system
 *
 * World units: 1 unit = the screen's short half-axis (scaled by S to pixels).
 * Physics: Newtonian gravity from the star only (GM chosen so Mercury laps in
 * MERCURY_PERIOD seconds). Orbits are integrated with a leapfrog (symplectic)
 * integrator, so Kepler's laws (T² ∝ a³, equal areas, ellipses) emerge on their own.
 */
'use strict';
(() => {
  const canvas = document.getElementById('space');
  const ctx = canvas.getContext('2d');
  const resetBtn = document.getElementById('reset');
  const masthead = document.getElementById('masthead');
  const hint = document.getElementById('hint');

  // One-time hint: shown once per visit, fades on the first interaction.
  if (hint) {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = touch ? 'tap a planet to explore \u00b7 drag one to throw it' : 'click a planet to explore \u00b7 drag one to throw it';
    if (sessionStorage.getItem('hintSeen')) hint.remove();
    else requestAnimationFrame(() => hint.classList.add('show'));
  }
  function dismissHint() {
    if (!hint || !hint.isConnected || hint.classList.contains('gone')) return;
    hint.classList.add('gone');
    try { sessionStorage.setItem('hintSeen', '1'); } catch (_) {}
  }

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  // ---------- Tunables ----------
  const MERCURY_A = 0.16;
  const MERCURY_PERIOD = 6; // seconds per Mercury orbit
  const GM = (TAU * TAU * MERCURY_A ** 3) / MERCURY_PERIOD ** 2;
  const STAR_R = 0.075;
  const MAX_APOAPSIS = 1.15; // fling cap: farthest point of any orbit (keeps it bound)
  const COMET_INTERVAL = 30; // seconds of on-screen time between comets
  const FIRST_COMET = 10; // seconds until the first comet
  const BOOM_AT = 0.8; // seconds from swallow to explosion
  const RESPAWN_AFTER = 1.6; // seconds after explosion the eaten planet returns
  const RESET_DELAY = 10; // seconds after explosion the reset button appears
  const CLICK_SLOP_PX = 6;
  const CLICK_MAX_MS = 600;
  const TRAIL_N = 170;
  const ROGUE_TRAIL_N = 36;
  const ROGUE_MIN = 0.12, ROGUE_CRUISE = 0.3, ROGUE_MAX = 0.5;

  // Distances are compressed to fit the screen; eccentricities, perihelion
  // directions and mean longitudes are real (J2000 elements), so the starting
  // layout matches where the planets actually are today.
  const PLANETS = [
    { id: 'mercury', a: 0.16, e: 0.2056, r: 0.012, color: '#b9b2a6', L0: 252.25032, Ldot: 149472.67411, peri: 77.4578 },
    { id: 'venus',   a: 0.24, e: 0.0068, r: 0.018, color: '#f0cf8a', L0: 181.9791,  Ldot: 58517.81539,  peri: 131.60247 },
    { id: 'earth',   a: 0.32, e: 0.0167, r: 0.019, color: '#6fb2ff', L0: 100.46457, Ldot: 35999.37245,  peri: 102.93768 },
    { id: 'mars',    a: 0.40, e: 0.0934, r: 0.014, color: '#ff7a4a', L0: -4.55343,  Ldot: 19140.30268,  peri: -23.94363 },
    { id: 'jupiter', a: 0.52, e: 0.0489, r: 0.038, color: '#e3b98a', L0: 34.39644,  Ldot: 3034.74613,   peri: 14.72848 },
    { id: 'saturn',  a: 0.68, e: 0.0565, r: 0.030, color: '#efd89a', L0: 49.95424,  Ldot: 1222.49362,   peri: 92.59888, rings: true },
    { id: 'uranus',  a: 0.81, e: 0.0457, r: 0.024, color: '#9fe8f0', L0: 313.2381,  Ldot: 428.48203,    peri: 170.95428 },
    { id: 'neptune', a: 0.93, e: 0.0113, r: 0.023, color: '#6f8dff', L0: -55.12003, Ldot: 218.45945,    peri: 44.96476 },
  ];

  // ---------- State ----------
  let W = 0, H = 0, DPR = 1, S = 1, cx = 0, cy = 0, hw = 1, hh = 1, yTop = 1, yBot = 1;
  let starfield = null, starSprite = null, twinkles = [];
  const sprites = {};
  let bodies = [];
  let mode = 'orbit'; // 'orbit' | 'collapse' | 'rogue'
  let sn = null; // supernova state
  let comet = null, cometTimer = COMET_INTERVAL - FIRST_COMET;
  let particles = [];
  let press = null;
  let simTime = 0;

  // ---------- Helpers ----------
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const toScreenX = (x) => cx + x * S;
  const toScreenY = (y) => cy - y * S;
  const toWorld = (px, py) => ({ x: (px - cx) / S, y: -(py - cy) / S });

  // ---------- Orbital mechanics ----------
  function orbitInfo(x, y, vx, vy) {
    const r = Math.hypot(x, y);
    const E = (vx * vx + vy * vy) / 2 - GM / r;
    const h = x * vy - y * vx;
    const e = Math.sqrt(Math.max(0, 1 + (2 * E * h * h) / (GM * GM)));
    if (E >= 0) return { E, e, a: Infinity, q: (h * h) / GM / (1 + e), Q: Infinity, T: Infinity };
    const a = -GM / (2 * E);
    return { E, e, a, q: a * (1 - e), Q: a * (1 + e), T: TAU * Math.sqrt((a * a * a) / GM) };
  }

  // Limit fling speed (never above escape velocity) so the orbit's farthest
  // point stays within MAX_APOAPSIS. Bisection on speed along the throw direction.
  function capVelocity(x, y, vx, vy) {
    const r = Math.hypot(x, y);
    const Qmax = Math.max(MAX_APOAPSIS, r * 1.001);
    if (orbitInfo(x, y, vx, vy).Q <= Qmax) return [vx, vy];
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (orbitInfo(x, y, vx * m, vy * m).Q <= Qmax) lo = m; else hi = m;
    }
    return [vx * lo, vy * lo];
  }

  function tuneIntegrator(b) {
    const o = orbitInfo(b.x, b.y, b.vx, b.vy);
    const q = Math.max(o.q, STAR_R * 0.6);
    b.h = clamp(0.008 * Math.sqrt((q * q * q) / GM), 0.0005, 0.03);
    b.trailDT = isFinite(o.T) ? clamp(o.T / 240, 0.01, 0.6) : 0.05;
  }

  // Leapfrog (kick-drift-kick). Returns true if the body entered radius hitR.
  function gravityStep(b, dt, hitR) {
    const n = Math.max(1, Math.ceil(dt / b.h));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      let r2 = b.x * b.x + b.y * b.y;
      let f = -GM / (r2 * Math.sqrt(r2));
      b.vx += 0.5 * h * f * b.x; b.vy += 0.5 * h * f * b.y;
      b.x += h * b.vx; b.y += h * b.vy;
      r2 = b.x * b.x + b.y * b.y;
      if (hitR && r2 < hitR * hitR) return true;
      f = -GM / (r2 * Math.sqrt(r2));
      b.vx += 0.5 * h * f * b.x; b.vy += 0.5 * h * f * b.y;
    }
    return false;
  }

  function setFromEphemeris(b) {
    const d = b.def;
    const T = (Date.now() - Date.UTC(2000, 0, 1, 12)) / (86400000 * 36525); // centuries since J2000
    const L = (d.L0 + d.Ldot * T) * DEG;
    const w = d.peri * DEG;
    const e = d.e;
    const M = (((L - w) % TAU) + TAU) % TAU;
    let E = M;
    for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const p = d.a * (1 - e * e);
    const r = p / (1 + e * Math.cos(nu));
    const th = nu + w;
    b.x = r * Math.cos(th);
    b.y = r * Math.sin(th);
    const k = Math.sqrt(GM / p);
    const vpx = -k * Math.sin(nu), vpy = k * (e + Math.cos(nu));
    b.vx = vpx * Math.cos(w) - vpy * Math.sin(w);
    b.vy = vpx * Math.sin(w) + vpy * Math.cos(w);
  }

  function makeBody(def) {
    const b = {
      def, x: 0, y: 0, vx: 0, vy: 0, h: 0.01, trailDT: 0.05,
      trail: [], trailClock: 0, held: false, eaten: false,
      scale: 1, spawnT: -1, mass: def.r ** 3,
    };
    setFromEphemeris(b);
    tuneIntegrator(b);
    // Pre-fill the trail by integrating backwards in time.
    const g = { x: b.x, y: b.y, vx: -b.vx, vy: -b.vy, h: b.h };
    for (let i = 0; i < TRAIL_N - 10; i++) {
      gravityStep(g, b.trailDT, 0);
      b.trail.unshift({ x: g.x, y: g.y });
    }
    return b;
  }

  function pushTrail(o, dt, interval, max) {
    o.trailClock += dt;
    if (o.trailClock >= interval) {
      o.trailClock = 0;
      o.trail.push({ x: o.x, y: o.y });
      if (o.trail.length > max) o.trail.splice(0, o.trail.length - max);
    }
  }

  const collR = (b) => b.def.r * (b.def.rings ? 1.3 : 1) * b.scale;
  const eatR = (b) => STAR_R + b.def.r * 0.5;

  // ---------- Supernova ----------
  function swallow(b) {
    if (press && press.grabbed && press.hit.body === b) press = null;
    b.held = false;
    b.eaten = true;
    b.eatFrom = { x: b.x, y: b.y };
    b.trail = [];
    if (mode === 'orbit') {
      releaseHeld();
      mode = 'collapse';
      sn = { t: 0, boomed: false, eaten: [b], neb: makeNebula(), resetShown: false };
      b.eatT = 0;
      canvas.style.cursor = 'default';
    } else if (sn) {
      b.eatT = sn.t;
      sn.eaten.push(b);
    }
  }

  function boom() {
    if (window.siteStats) window.siteStats.send("supernova", sn.eaten.map((b) => b.def.id).join(", "));
    mode = 'rogue';
    sn.boomed = true;
    press = null;
    canvas.style.cursor = 'default';
    for (const b of bodies) {
      if (b.eaten) continue;
      b.held = false;
      const r = Math.hypot(b.x, b.y) || 1;
      const out = rand(0.2, 0.42);
      const side = rand(-0.15, 0.15);
      b.vx = (b.x / r) * out - (b.y / r) * side;
      b.vy = (b.y / r) * out + (b.x / r) * side;
      b.trail = b.trail.slice(-ROGUE_TRAIL_N);
    }
    if (comet) comet.free = true;
    spawnDebris();
  }

  function respawn(b) {
    const r = b.def.r * 1.3;
    let x = 0, y = 0;
    for (let tries = 0; tries < 80; tries++) {
      x = rand(-hw + r, hw - r);
      y = rand(-yBot + r, yTop - r);
      let ok = true;
      for (const o of bodies) {
        if (o === b || o.eaten) continue;
        if (Math.hypot(o.x - x, o.y - y) < collR(o) + r + 0.03) { ok = false; break; }
      }
      if (ok) break;
    }
    const a = rand(0, TAU);
    b.x = x; b.y = y;
    b.vx = Math.cos(a) * ROGUE_CRUISE; b.vy = Math.sin(a) * ROGUE_CRUISE;
    b.eaten = false; b.spawnT = 0; b.scale = 0; b.trail = []; b.trailClock = 0;
  }

  function resetSystem() {
    mode = 'orbit';
    sn = null;
    particles = [];
    press = null;
    resetBtn.classList.remove('show');
    resetBtn.blur();
    bodies = PLANETS.map(makeBody);
  }
  resetBtn.addEventListener('click', resetSystem);

  function makeNebula() {
    const warm = ['255,80,50', '255,130,60', '255,60,110', '255,170,90'];
    const cool = ['90,190,255', '150,110,255', '80,240,210'];
    const blobs = [], fil = [];
    for (let i = 0; i < 160; i++) {
      const d = Math.pow(Math.random(), 0.55);
      const pal = d > 0.55 ? (Math.random() < 0.75 ? warm : cool) : (Math.random() < 0.6 ? cool : warm);
      blobs.push({ a: rand(0, TAU), d, s: rand(0.05, 0.16) * (0.6 + d * 0.6), col: pick(pal), al: rand(0.04, 0.11), spin: rand(-0.02, 0.02), ph: rand(0, TAU) });
    }
    for (let i = 0; i < 80; i++) {
      fil.push({ a: rand(0, TAU), d0: rand(0.15, 0.5), d1: rand(0.75, 1.08), bend: rand(-0.25, 0.25), col: pick(warm), al: rand(0.12, 0.3), w: rand(0.6, 1.6) });
    }
    return { blobs, fil, rot: rand(0, TAU) };
  }

  function spawnDebris() {
    const cols = ['255,245,220', '255,200,120', '255,140,70', '255,90,60', '170,210,255'];
    particles = [];
    for (let i = 0; i < 650; i++) {
      const a = rand(0, TAU);
      const sp = 0.15 + Math.pow(Math.random(), 1.5) * 1.6;
      particles.push({
        x: Math.cos(a) * STAR_R * 0.3, y: Math.sin(a) * STAR_R * 0.3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        age: 0, life: rand(1.5, 5), size: rand(0.6, 2.2), col: pick(cols),
      });
    }
  }

  // ---------- Comet ----------
  function spawnComet() {
    const hd = Math.hypot(hw, hh) + 0.25;
    const c = { x: 0, y: 0, vx: 0, vy: 0, h: 0.01, trail: [], trailClock: 0, age: 0, free: mode === 'rogue' };
    if (!c.free) {
      // Hyperbolic (unbound) Kepler orbit, entering from off-screen.
      const q = rand(0.25, 0.6), e = rand(3, 8), p = q * (1 + e);
      const nu = -Math.acos(clamp((p / hd - 1) / e, -1, 1));
      const r = p / (1 + e * Math.cos(nu));
      let x = r * Math.cos(nu), y = r * Math.sin(nu);
      const k = Math.sqrt(GM / p);
      let vx = -k * Math.sin(nu), vy = k * (e + Math.cos(nu));
      if (Math.random() < 0.5) { y = -y; vy = -vy; }
      const w = rand(0, TAU), cw = Math.cos(w), sw = Math.sin(w);
      c.x = x * cw - y * sw; c.y = x * sw + y * cw;
      c.vx = vx * cw - vy * sw; c.vy = vx * sw + vy * cw;
      c.h = clamp(0.008 * Math.sqrt(q ** 3 / GM), 0.0005, 0.03);
    } else {
      const a = rand(0, TAU);
      c.x = Math.cos(a) * hd; c.y = Math.sin(a) * hd;
      const tx = rand(-0.6, 0.6), ty = rand(-0.6, 0.6);
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      c.vx = (dx / d) * 0.32; c.vy = (dy / d) * 0.32;
    }
    comet = c;
  }

  function updateComet(dt) {
    const c = comet;
    if (!c) return;
    c.age += dt;
    if (!c.free) gravityStep(c, dt, 0);
    else { c.x += c.vx * dt; c.y += c.vy * dt; }
    pushTrail(c, dt, 0.05, 40);
    const r = Math.hypot(c.x, c.y);
    if (c.age > 3 && r > Math.hypot(hw, hh) + 0.3 && c.x * c.vx + c.y * c.vy > 0) comet = null;
  }

  // ---------- Update ----------
  function updateOrbiting(dt) {
    for (const b of bodies) {
      if (b.eaten) continue;
      if (!b.held) {
        if (gravityStep(b, dt, eatR(b))) { swallow(b); continue; }
        pushTrail(b, dt, b.trailDT, TRAIL_N);
      } else {
        if (Math.hypot(b.x, b.y) < eatR(b)) { swallow(b); continue; }
        pushTrail(b, dt, 0.03, TRAIL_N);
      }
    }
  }

  function collide(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy), min = collR(a) + collR(b);
    if (d >= min || d === 0) return;
    const nx = dx / d, ny = dy / d;
    const ima = a.held ? 0 : 1 / a.mass, imb = b.held ? 0 : 1 / b.mass;
    if (ima + imb === 0) return;
    const overlap = min - d;
    a.x -= (nx * overlap * ima) / (ima + imb); a.y -= (ny * overlap * ima) / (ima + imb);
    b.x += (nx * overlap * imb) / (ima + imb); b.y += (ny * overlap * imb) / (ima + imb);
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv >= 0) return;
    const j = (-2 * rv) / (ima + imb); // perfectly elastic
    a.vx -= j * ima * nx; a.vy -= j * ima * ny;
    b.vx += j * imb * nx; b.vy += j * imb * ny;
  }

  function updateRogue(dt) {
    const list = bodies.filter((b) => !b.eaten);
    for (const b of list) {
      if (b.spawnT >= 0) {
        b.spawnT += dt;
        const p = Math.min(1, b.spawnT / 0.8);
        b.scale = Math.max(0, easeOutBack(p));
        if (p >= 1) { b.spawnT = -1; b.scale = 1; }
      }
      if (b.held) { pushTrail(b, dt, 0.03, ROGUE_TRAIL_N); continue; }
      // Random wander: gently turn heading, keep speed in a lively range.
      const turn = (Math.random() - 0.5) * 1.4 * dt;
      const c = Math.cos(turn), s = Math.sin(turn);
      let vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
      let sp = Math.hypot(vx, vy);
      if (sp < 1e-4) { const a = rand(0, TAU); vx = Math.cos(a) * ROGUE_MIN; vy = Math.sin(a) * ROGUE_MIN; sp = ROGUE_MIN; }
      let target = sp;
      if (sp > ROGUE_MAX) target = sp * Math.exp(-0.8 * dt);
      else if (sp < ROGUE_MIN) target = sp + (ROGUE_MIN - sp) * (1 - Math.exp(-2 * dt));
      b.vx = (vx / sp) * target; b.vy = (vy / sp) * target;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const r = collR(b);
      if (b.x < -hw + r) { b.x = -hw + r; b.vx = Math.abs(b.vx); }
      if (b.x > hw - r) { b.x = hw - r; b.vx = -Math.abs(b.vx); }
      if (b.y < -yBot + r) { b.y = -yBot + r; b.vy = Math.abs(b.vy); }
      if (b.y > yTop - r) { b.y = yTop - r; b.vy = -Math.abs(b.vy); }
      pushTrail(b, dt, 0.03, ROGUE_TRAIL_N);
    }
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) collide(list[i], list[j]);
  }

  function updateParticles(dt) {
    if (!particles.length) return;
    const drag = Math.exp(-0.7 * dt);
    for (const p of particles) {
      p.age += dt;
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
  }

  function update(dt) {
    simTime += dt;
    cometTimer += dt;
    if (cometTimer >= COMET_INTERVAL) {
      cometTimer -= COMET_INTERVAL;
      if (!comet) spawnComet();
    }
    if (mode === 'orbit' || mode === 'collapse') updateOrbiting(dt);
    if (sn) {
      sn.t += dt;
      if (!sn.boomed && sn.t >= BOOM_AT) boom();
      if (sn.boomed) {
        const tb = sn.t - BOOM_AT;
        for (const b of sn.eaten) if (b.eaten && tb >= RESPAWN_AFTER) respawn(b);
        if (tb >= RESET_DELAY && !sn.resetShown) { sn.resetShown = true; resetBtn.classList.add('show'); }
      }
    }
    if (mode === 'rogue') updateRogue(dt);
    updateComet(dt);
    updateParticles(dt);
  }

  // ---------- Sprites ----------
  function baseGradient(g, R, c0, c1, c2) {
    const gr = g.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R * 1.05);
    gr.addColorStop(0, c0); gr.addColorStop(0.6, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
  }
  function blob(g, x, y, rad, rng, color, n = 9) {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = rng() * rad * 0.7, rr = rad * (0.3 + rng() * 0.5);
      const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
      g.moveTo(bx + rr, by); g.arc(bx, by, rr, 0, TAU);
    }
    g.fill();
  }
  function bands(g, R, colors, rng, turbulence) {
    let lat = -Math.PI / 2, i = 0;
    while (lat < Math.PI / 2) {
      const dl = (0.08 + rng() * 0.16);
      const y0 = R * Math.sin(lat), y1 = R * Math.sin(Math.min(Math.PI / 2, lat + dl));
      g.fillStyle = colors[i % colors.length];
      g.fillRect(-R, y0, 2 * R, y1 - y0 + 0.6);
      lat += dl; i++;
    }
    for (let k = 0; k < turbulence; k++) {
      const y = R * Math.sin(rand(-1.4, 1.4));
      g.globalAlpha = 0.35 + rng() * 0.3;
      g.fillStyle = colors[(rng() * colors.length) | 0];
      g.beginPath();
      g.ellipse((rng() * 2 - 1) * R, y, R * (0.05 + rng() * 0.18), R * (0.015 + rng() * 0.035), 0, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function paintPlanet(g, id, R, rng) {
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    switch (id) {
      case 'mercury':
        baseGradient(g, R, '#cfcac2', '#8f8a83', '#5b5752');
        for (let i = 0; i < 26; i++) {
          const x = (rng() * 2 - 1) * R, y = (rng() * 2 - 1) * R, rr = R * (0.05 + rng() * 0.14);
          g.fillStyle = 'rgba(55,50,46,0.35)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(230,225,215,0.22)'; g.lineWidth = Math.max(0.5, rr * 0.25);
          g.beginPath(); g.arc(x - rr * 0.15, y - rr * 0.15, rr, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
        }
        break;
      case 'venus':
        baseGradient(g, R, '#fbeec8', '#e2bf7c', '#a97a3c');
        g.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          g.strokeStyle = `rgba(255,248,225,${0.12 + rng() * 0.18})`;
          g.lineWidth = R * (0.08 + rng() * 0.14);
          g.beginPath();
          g.ellipse((rng() - 0.5) * R, (rng() - 0.5) * R * 1.6, R * (0.5 + rng() * 0.7), R * (0.15 + rng() * 0.3), rng() * 0.6 - 0.3, rng() * TAU, rng() * TAU + 2);
          g.stroke();
        }
        break;
      case 'earth':
        baseGradient(g, R, '#5aa6f0', '#1c4f9e', '#08214f');
        for (let i = 0; i < 6; i++) blob(g, (rng() * 2 - 1) * R * 0.8, (rng() * 2 - 1) * R * 0.7, R * (0.25 + rng() * 0.25), rng, '#3f8c46', 10);
        for (let i = 0; i < 5; i++) blob(g, (rng() * 2 - 1) * R * 0.7, (rng() * 2 - 1) * R * 0.6, R * (0.1 + rng() * 0.12), rng, 'rgba(150,130,80,0.8)', 6);
        g.fillStyle = 'rgba(240,248,255,0.92)';
        g.beginPath(); g.ellipse(0, -R * 1.02, R * 0.62, R * 0.24, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, R * 1.02, R * 0.7, R * 0.26, 0, 0, TAU); g.fill();
        for (let i = 0; i < 20; i++) {
          g.fillStyle = `rgba(255,255,255,${0.35 + rng() * 0.35})`;
          g.beginPath();
          g.ellipse((rng() * 2 - 1) * R, (rng() * 2 - 1) * R, R * (0.15 + rng() * 0.3), R * (0.03 + rng() * 0.06), rng() * 0.8 - 0.4, 0, TAU);
          g.fill();
        }
        break;
      case 'mars':
        baseGradient(g, R, '#e8875a', '#b8502a', '#6a2512');
        for (let i = 0; i < 7; i++) blob(g, (rng() * 2 - 1) * R * 0.8, (rng() * 2 - 1) * R * 0.6, R * (0.15 + rng() * 0.25), rng, 'rgba(90,35,18,0.38)', 7);
        g.fillStyle = 'rgba(255,245,240,0.9)';
        g.beginPath(); g.ellipse(0, -R * 1.0, R * 0.45, R * 0.2, 0, 0, TAU); g.fill();
        break;
      case 'jupiter':
        bands(g, R, ['#efe2c8', '#c79a6c', '#f4e9d4', '#ad7a52', '#ddc19a', '#9a6a46', '#e9d5b4'], rng, 70);
        g.fillStyle = '#c4583a';
        g.beginPath(); g.ellipse(R * 0.3, R * 0.38, R * 0.24, R * 0.13, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(245,215,190,0.6)'; g.lineWidth = Math.max(0.6, R * 0.04);
        g.beginPath(); g.ellipse(R * 0.3, R * 0.38, R * 0.28, R * 0.16, 0, 0, TAU); g.stroke();
        break;
      case 'saturn':
        bands(g, R, ['#efdfb6', '#d8bf88', '#f4e8c8', '#c9ad78', '#e6d2a0'], rng, 40);
        break;
      case 'uranus':
        baseGradient(g, R, '#d8fbfb', '#8fd9e3', '#4b9fb3');
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(-R, -R * 0.15, 2 * R, R * 0.12);
        break;
      case 'neptune':
        baseGradient(g, R, '#86a9ff', '#3c62d8', '#152775');
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(-R, -R * 0.4, 2 * R, R * 0.1);
        g.fillRect(-R, R * 0.25, 2 * R, R * 0.08);
        g.fillStyle = 'rgba(15,25,90,0.75)';
        g.beginPath(); g.ellipse(-R * 0.25, R * 0.1, R * 0.2, R * 0.11, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.beginPath(); g.ellipse(-R * 0.1, R * 0.28, R * 0.14, R * 0.03, 0, 0, TAU); g.fill();
        break;
    }
    // Limb darkening
    const ld = g.createRadialGradient(0, 0, 0, 0, 0, R);
    ld.addColorStop(0.62, 'rgba(0,0,0,0)');
    ld.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = ld; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.restore();
  }

  function makeSprite(R, painter) {
    const size = 2 * R + 4;
    const c = document.createElement('canvas');
    c.width = Math.ceil(size * DPR); c.height = Math.ceil(size * DPR);
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    g.translate(size / 2, size / 2);
    painter(g, R);
    return { img: c, size };
  }

  function buildSprites() {
    PLANETS.forEach((def, i) => {
      sprites[def.id] = makeSprite(Math.max(2, def.r * S), (g, R) => paintPlanet(g, def.id, R, mulberry32(1000 + i * 77)));
    });
    starSprite = makeSprite(STAR_R * S, (g, R) => {
      const rng = mulberry32(42);
      g.save();
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.35, '#fff1b8');
      gr.addColorStop(0.7, '#ffc65a'); gr.addColorStop(0.92, '#ff9a2a'); gr.addColorStop(1, '#ff7b18');
      g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
      for (let i = 0; i < 900; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * R, rr = R * (0.02 + rng() * 0.05);
        g.fillStyle = rng() < 0.5 ? 'rgba(255,250,210,0.09)' : 'rgba(190,80,0,0.07)';
        g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, TAU); g.fill();
      }
      for (let i = 0; i < 3; i++) {
        const a = rng() * TAU, d = rng() * R * 0.6;
        g.fillStyle = 'rgba(120,40,0,0.3)';
        g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, R * 0.04, 0, TAU); g.fill();
      }
      const ld = g.createRadialGradient(0, 0, 0, 0, 0, R);
      ld.addColorStop(0.7, 'rgba(150,40,0,0)');
      ld.addColorStop(1, 'rgba(150,40,0,0.45)');
      g.fillStyle = ld; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.restore();
    });
  }

  function buildStarfield() {
    starfield = document.createElement('canvas');
    starfield.width = Math.ceil(W * DPR); starfield.height = Math.ceil(H * DPR);
    const g = starfield.getContext('2d');
    g.scale(DPR, DPR);
    const bg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    bg.addColorStop(0, '#070a1c'); bg.addColorStop(1, '#010208');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // Milky Way band
    g.save();
    g.translate(W / 2, H / 2); g.rotate(-0.5);
    const L = Math.hypot(W, H);
    for (let i = 0; i < 40; i++) {
      const x = rand(-L / 2, L / 2), y = (Math.random() + Math.random() + Math.random() - 1.5) * H * 0.12;
      const rr = rand(60, 180);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, pick(['rgba(120,110,180,0.05)', 'rgba(90,120,190,0.05)', 'rgba(170,130,160,0.035)']));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < (W * H) / 900; i++) {
      const x = rand(-L / 2, L / 2), y = (Math.random() + Math.random() + Math.random() - 1.5) * H * 0.15;
      g.fillStyle = `rgba(220,225,255,${rand(0.05, 0.35)})`;
      g.fillRect(x, y, 0.8, 0.8);
    }
    g.restore();
    for (let i = 0; i < (W * H) / 1800; i++) {
      const r = Math.pow(Math.random(), 3) * 1.3 + 0.25;
      g.fillStyle = `rgba(${pick(['255,255,255', '200,215,255', '255,235,210', '255,210,190'])},${rand(0.25, 0.9)})`;
      g.beginPath(); g.arc(rand(0, W), rand(0, H), r, 0, TAU); g.fill();
    }
    twinkles = [];
    for (let i = 0; i < 70; i++) twinkles.push({ x: rand(0, W), y: rand(0, H), r: rand(0.6, 1.5), ph: rand(0, TAU), sp: rand(0.8, 3) });
  }

  // ---------- Rendering ----------
  function drawTrail(pts, head, color, maxAlpha, width, taper) {
    const n = pts.length;
    if (n < 2) return;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const chunks = 12;
    for (let c = 0; c < chunks; c++) {
      const i0 = Math.floor((c * (n - 1)) / chunks), i1 = Math.floor(((c + 1) * (n - 1)) / chunks);
      if (i1 <= i0) continue;
      const f = (c + 1) / chunks;
      ctx.globalAlpha = maxAlpha * f;
      ctx.lineWidth = taper ? width * f : width;
      ctx.beginPath();
      ctx.moveTo(toScreenX(pts[i0].x), toScreenY(pts[i0].y));
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(toScreenX(pts[i].x), toScreenY(pts[i].y));
      if (c === chunks - 1 && head) ctx.lineTo(toScreenX(head.x), toScreenY(head.y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(sx, sy, pr, front) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.4);
    ctx.beginPath();
    if (front) ctx.rect(-pr * 3, 0, pr * 6, pr * 3); else ctx.rect(-pr * 3, -pr * 3, pr * 6, pr * 3);
    ctx.clip();
    ctx.scale(1, 0.32);
    const rings = [
      [1.3, 0.14, 'rgba(190,170,130,0.45)'],
      [1.62, 0.36, 'rgba(232,212,170,0.78)'],
      [2.02, 0.06, 'rgba(20,15,10,0.4)'],
      [2.18, 0.2, 'rgba(205,185,145,0.6)'],
    ];
    for (const [rad, w, col] of rings) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w * pr;
      ctx.beginPath(); ctx.arc(0, 0, rad * pr, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlanetAt(b, x, y, sc) {
    const def = b.def;
    const sx = toScreenX(x), sy = toScreenY(y);
    const pr = def.r * S * sc;
    if (pr < 0.3) return;
    if (def.rings) drawRings(sx, sy, pr, false);
    const sp = sprites[def.id];
    const k = (pr / Math.max(2, def.r * S));
    ctx.drawImage(sp.img, sx - (sp.size / 2) * k, sy - (sp.size / 2) * k, sp.size * k, sp.size * k);
    // Day/night shading: lit from the center
    const r = Math.hypot(x, y);
    if (r > 1e-4) {
      const ux = -x / r, uy = y / r; // screen-space direction to the star
      const g = ctx.createLinearGradient(sx + ux * pr, sy + uy * pr, sx - ux * pr, sy - uy * pr);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.42, 'rgba(0,0,0,0)');
      g.addColorStop(0.64, 'rgba(3,4,14,0.6)');
      g.addColorStop(1, 'rgba(3,4,14,0.92)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, pr + 0.3, 0, TAU); ctx.fill();
    }
    if (def.id === 'earth' || def.id === 'venus' || def.id === 'neptune') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const col = def.id === 'earth' ? '110,170,255' : def.id === 'venus' ? '255,220,160' : '110,140,255';
      const g = ctx.createRadialGradient(sx, sy, pr * 0.92, sx, sy, pr * 1.25);
      g.addColorStop(0, `rgba(${col},0.32)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, pr * 1.25, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (def.rings) drawRings(sx, sy, pr, true);
  }

  function drawStar(mul, white) {
    const r = STAR_R * S * mul, t = simTime;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = 1 + 0.05 * Math.sin(t * 1.3) + 0.03 * Math.sin(t * 2.9 + 1.2);
    const R = r * 5.5 * fl;
    const g = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, R);
    g.addColorStop(0, 'rgba(255,200,110,0.55)');
    g.addColorStop(0.12, 'rgba(255,150,60,0.26)');
    g.addColorStop(0.35, 'rgba(255,100,30,0.08)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // Corona streamers
    const N = 28;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + 0.15 * Math.sin(t * 0.2 + i);
      const n1 = Math.sin(t * 0.7 + i * 2.31) * 0.5 + 0.5, n2 = Math.sin(t * 0.43 + i * 1.7) * 0.5 + 0.5;
      const len = r * (1.5 + 1.1 * n1 * n2);
      const wd = r * 0.22;
      const ux = Math.cos(a), uy = Math.sin(a);
      const bx = cx + ux * r * 0.8, by = cy + uy * r * 0.8;
      const g2 = ctx.createLinearGradient(bx, by, cx + ux * len, cy + uy * len);
      g2.addColorStop(0, 'rgba(255,190,100,0.16)');
      g2.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(bx - uy * wd, by + ux * wd);
      ctx.lineTo(cx + ux * len, cy + uy * len);
      ctx.lineTo(bx + uy * wd, by - ux * wd);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.02);
    const s = starSprite.size * mul;
    ctx.drawImage(starSprite.img, -s / 2, -s / 2, s, s);
    ctx.restore();
    if (white > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${white})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      const g3 = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 3);
      g3.addColorStop(0, `rgba(220,235,255,${white * 0.6})`); g3.addColorStop(1, 'rgba(220,235,255,0)');
      ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(cx, cy, r * 3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawNebula(tb) {
    const neb = sn.neb;
    const grow = 1 - Math.exp(-tb / 2.6);
    const Rn = 0.58 * S * grow;
    if (Rn < 1) return;
    const fade = Math.min(1, tb / 1.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of neb.blobs) {
      const a = b.a + neb.rot + tb * b.spin;
      const d = b.d * Rn;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const rr = b.s * S * (0.4 + 0.6 * grow) * (1 + 0.06 * Math.sin(simTime * 0.5 + b.ph));
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(${b.col},${b.al * fade})`);
      g.addColorStop(1, `rgba(${b.col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.lineCap = 'round';
    for (const f of neb.fil) {
      const a = f.a + neb.rot;
      const x0 = cx + Math.cos(a) * f.d0 * Rn, y0 = cy + Math.sin(a) * f.d0 * Rn;
      const x1 = cx + Math.cos(a + f.bend * 0.3) * f.d1 * Rn, y1 = cy + Math.sin(a + f.bend * 0.3) * f.d1 * Rn;
      const am = a + f.bend, dm = ((f.d0 + f.d1) / 2) * Rn;
      ctx.strokeStyle = `rgba(${f.col},${f.al * fade})`;
      ctx.lineWidth = f.w;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx + Math.cos(am) * dm, cy + Math.sin(am) * dm, x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPulsar(tb) {
    const t = simTime;
    const fadeIn = Math.min(1, tb / 1.5);
    const pulse = (0.55 + 0.45 * Math.pow(Math.abs(Math.sin(t * 6)), 6)) * fadeIn;
    const ang = t * 2.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const k of [0, Math.PI]) {
      const a = ang + k, ux = Math.cos(a), uy = Math.sin(a);
      const len = 0.42 * S, w = 0.018 * S;
      const g = ctx.createLinearGradient(cx, cy, cx + ux * len, cy + uy * len);
      g.addColorStop(0, `rgba(180,220,255,${0.4 * pulse})`); g.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + ux * len - uy * w, cy + uy * len + ux * w);
      ctx.lineTo(cx + ux * len + uy * w, cy + uy * len - ux * w);
      ctx.fill();
    }
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.07 * S);
    gr.addColorStop(0, `rgba(210,235,255,${0.7 * pulse})`); gr.addColorStop(1, 'rgba(210,235,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 0.07 * S, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${fadeIn})`;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, 0.008 * S), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawExplosion(tb) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (tb < 1.6) {
      const rr = (0.08 + tb * 0.55) * S, al = 1 - tb / 1.6;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, `rgba(255,255,255,${al})`);
      g.addColorStop(0.4, `rgba(255,200,120,${al * 0.7})`);
      g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
    }
    for (let k = 0; k < 3; k++) {
      const tt = tb - k * 0.12;
      if (tt < 0 || tt > 2.2) continue;
      const life = 1 - tt / 2.2;
      ctx.strokeStyle = `rgba(255,230,200,${0.7 * life})`;
      ctx.lineWidth = (6 - 2 * k) * life + 1;
      ctx.beginPath(); ctx.arc(cx, cy, tt * 2 * S, 0, TAU); ctx.stroke();
    }
    for (const p of particles) {
      const a = 1 - p.age / p.life;
      ctx.fillStyle = `rgba(${p.col},${a})`;
      ctx.beginPath(); ctx.arc(toScreenX(p.x), toScreenY(p.y), p.size, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawComet(c) {
    const sx = toScreenX(c.x), sy = toScreenY(c.y);
    drawTrail(c.trail, c, 'rgb(255,236,205)', 0.45, Math.max(2, 0.012 * S), true);
    const r = Math.hypot(c.x, c.y);
    let dx, dy;
    if (!c.free && r > 0) { dx = c.x / r; dy = c.y / r; } // ion tail points away from the star
    else { const v = Math.hypot(c.vx, c.vy) || 1; dx = -c.vx / v; dy = -c.vy / v; }
    const L = (c.free ? 0.28 : clamp(0.1 / r, 0.15, 0.55)) * S;
    const ux = dx, uy = -dy, px = -uy, py = ux;
    const w0 = 0.006 * S + 1, w1 = 0.035 * S;
    const ex = sx + ux * L, ey = sy + uy * L;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, 'rgba(160,215,255,0.55)'); g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx + px * w0, sy + py * w0);
    ctx.lineTo(ex + px * w1, ey + py * w1);
    ctx.lineTo(ex - px * w1, ey - py * w1);
    ctx.lineTo(sx - px * w0, sy - py * w0);
    ctx.fill();
    const rr = Math.max(10, 0.04 * S);
    const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    cg.addColorStop(0, 'rgba(225,242,255,0.9)'); cg.addColorStop(0.25, 'rgba(150,210,255,0.35)'); cg.addColorStop(1, 'rgba(150,210,255,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.6, 0.005 * S), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(starfield, 0, 0, W, H);
    for (const s of twinkles) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * (0.5 + 0.5 * Math.sin(s.ph + simTime * s.sp))})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }

    const tb = sn && sn.boomed ? sn.t - BOOM_AT : -1;
    let shake = 0;
    if (mode === 'collapse' && sn.t > 0.35) shake = ((sn.t - 0.35) / (BOOM_AT - 0.35)) * 3;
    if (tb >= 0 && tb < 0.8) shake = 10 * (1 - tb / 0.8);
    ctx.save();
    if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    if (tb >= 0) { drawNebula(tb); drawPulsar(tb); }

    for (const b of bodies) if (!b.eaten) drawTrail(b.trail, b, b.def.color, mode === 'rogue' ? 0.3 : 0.35, 1.2, false);

    if (mode === 'orbit') drawStar(1, 0);
    else if (mode === 'collapse') {
      for (const b of sn.eaten) {
        const p = Math.min(1, (sn.t - b.eatT) / 0.35);
        if (p < 1) drawPlanetAt(b, b.eatFrom.x * (1 - p * p), b.eatFrom.y * (1 - p * p), 1 - p);
      }
      const t = sn.t;
      let mul, white;
      if (t < 0.35) { mul = 1 + 0.3 * (t / 0.35); white = 0.3 * (t / 0.35); }
      else { const u = (t - 0.35) / (BOOM_AT - 0.35); mul = 1.3 - 1.05 * u * u; white = 0.3 + 0.7 * u; }
      drawStar(mul, white);
    }

    for (const b of bodies) if (!b.eaten) drawPlanetAt(b, b.x, b.y, b.scale);
    if (comet) drawComet(comet);
    if (tb >= 0) drawExplosion(tb);
    ctx.restore();

    if (tb >= 0 && tb < 1.1) {
      ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - tb / 1.1) ** 2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Input ----------
  function hitTest(px, py) {
    if (comet) {
      if (Math.hypot(px - toScreenX(comet.x), py - toScreenY(comet.y)) < Math.max(0.05 * S, 22)) return { kind: 'comet' };
    }
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (b.eaten) continue;
      const pr = b.def.r * S * b.scale;
      const rad = Math.max(pr * (b.def.rings ? 2 : 1.35), 14);
      if (Math.hypot(px - toScreenX(b.x), py - toScreenY(b.y)) < rad) return { kind: 'planet', body: b };
    }
    const dc = Math.hypot(px - cx, py - cy);
    if (mode === 'orbit' && dc < STAR_R * S * 1.15) return { kind: 'star' };
    if (mode === 'rogue' && dc < Math.max(0.06 * S, 20)) return { kind: 'star' };
    return null;
  }

  function navigate(hit) {
    const page = hit.kind === 'star' ? 'about' : hit.kind === 'comet' ? 'comet' : hit.body.def.id;
    // Tell the comet page this visit came from a real catch, so it counts toward the sighting number.
    if (hit.kind === 'comet') { try { sessionStorage.setItem('cometCaught', '1'); } catch (e) {} }
    window.location.href = `pages/${page}.html`;
  }

  function updateCursor(e) {
    if (press && press.grabbed) { canvas.style.cursor = 'grabbing'; return; }
    canvas.style.cursor = hitTest(e.clientX, e.clientY) ? 'pointer' : 'default';
  }

  function moveHeld(px, py) {
    const b = press.hit.body;
    const w = toWorld(px, py);
    const r = collR(b) || b.def.r;
    b.x = clamp(w.x + press.ox, -hw + r, hw - r);
    b.y = clamp(w.y + press.oy, -yBot + r, yTop - r);
    const now = performance.now();
    press.samples.push({ t: now, x: b.x, y: b.y });
    while (press.samples.length > 2 && now - press.samples[0].t > 150) press.samples.shift();
    const a = press.samples[0], span = (now - a.t) / 1000;
    if (span > 0.012) { b.vx = (b.x - a.x) / span; b.vy = (b.y - a.y) / span; }
  }

  function releaseHeld() {
    if (!press || !press.grabbed) { press = null; return; }
    const b = press.hit.body;
    const now = performance.now();
    const recent = press.samples.filter((p) => now - p.t <= 90);
    let vx = 0, vy = 0;
    if (recent.length >= 2) {
      const a = recent[0], span = (now - a.t) / 1000;
      if (span > 0.012) { vx = (b.x - a.x) / span; vy = (b.y - a.y) / span; }
    }
    b.held = false;
    if (mode === 'rogue') {
      const sp = Math.hypot(vx, vy);
      if (sp > 1.5) { vx *= 1.5 / sp; vy *= 1.5 / sp; }
      b.vx = vx; b.vy = vy;
    } else {
      [b.vx, b.vy] = capVelocity(b.x, b.y, vx, vy);
      tuneIntegrator(b);
    }
    press = null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dismissHint();
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;
    if (mode === 'collapse' && hit.kind !== 'comet') return;
    press = { hit, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), grabbed: false, moved: false, samples: [], ox: 0, oy: 0 };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) { updateCursor(e); return; }
    if (!press.moved && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > CLICK_SLOP_PX) {
      press.moved = true;
      const b = press.hit.body;
      if (press.hit.kind === 'planet' && mode !== 'collapse' && !b.eaten) {
        const w = toWorld(e.clientX, e.clientY);
        press.ox = b.x - w.x; press.oy = b.y - w.y;
        press.grabbed = true;
        b.held = true;
        b.trailClock = 0;
        press.samples = [{ t: performance.now(), x: b.x, y: b.y }];
        canvas.style.cursor = 'grabbing';
      }
    }
    if (press.grabbed) moveHeld(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (press.grabbed) releaseHeld();
    else {
      const hit = press.hit;
      const isClick = !press.moved && performance.now() - press.t0 < CLICK_MAX_MS;
      press = null;
      if (isClick) { navigate(hit); return; }
    }
    updateCursor(e);
  });

  canvas.addEventListener('pointercancel', () => { if (press && press.grabbed) releaseHeld(); press = null; });

  // ---------- Boot ----------
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(W * DPR); canvas.height = Math.ceil(H * DPR);
    // Leave room for the name header: the system is centred in the space below it.
    const top = masthead ? masthead.getBoundingClientRect().bottom + 6 : 0;
    const avail = Math.max(H - top, H * 0.5);
    S = (Math.min(W, avail) / 2) * 0.94;
    cx = W / 2; cy = H - avail / 2;
    hw = cx / S; yTop = cy / S; yBot = (H - cy) / S; hh = Math.max(yTop, yBot);
    buildStarfield();
    buildSprites();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', () => { press = null; last = performance.now(); });

  resize();
  bodies = PLANETS.map(makeBody);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (window.innerWidth !== W || window.innerHeight !== H) resize();
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
