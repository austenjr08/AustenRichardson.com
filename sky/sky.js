// Your Sky Tonight: what's up tonight, where to look and when.
// Uses astro.js for positions. Nothing is sent anywhere; your location stays on your device.
(() => {
  'use strict';
  const A = window.Astro;
  const $ = id => document.getElementById(id);

  // Default place: Melbourne, Florida.
  const HOME = { lat: 28.0836, lon: -80.6081, name: 'Melbourne, FL' };

  const PLANETS = [
    { id: 'mercury', name: 'Mercury', color: '#c9c2b6' },
    { id: 'venus', name: 'Venus', color: '#f6e3a8' },
    { id: 'mars', name: 'Mars', color: '#ff7a4a' },
    { id: 'jupiter', name: 'Jupiter', color: '#e9c79c' },
    { id: 'saturn', name: 'Saturn', color: '#efd89a' },
    { id: 'uranus', name: 'Uranus', color: '#9fe8f0' },
    { id: 'neptune', name: 'Neptune', color: '#7f9bff' },
  ];

  // Bright stars: name, RA (hours, J2000), Dec (degrees, J2000), magnitude.
  const STARS = [
    ['Sirius', 6.752, -16.716, -1.46], ['Canopus', 6.399, -52.696, -0.74], ['Arcturus', 14.261, 19.182, -0.05],
    ['Vega', 18.616, 38.784, 0.03], ['Capella', 5.278, 45.998, 0.08], ['Rigel', 5.242, -8.202, 0.13],
    ['Procyon', 7.655, 5.225, 0.34], ['Betelgeuse', 5.919, 7.407, 0.5], ['Achernar', 1.629, -57.237, 0.46],
    ['Hadar', 14.064, -60.373, 0.61], ['Altair', 19.846, 8.868, 0.76], ['Acrux', 12.443, -63.099, 0.76],
    ['Aldebaran', 4.599, 16.509, 0.86], ['Antares', 16.490, -26.432, 0.96], ['Spica', 13.420, -11.161, 0.97],
    ['Pollux', 7.755, 28.026, 1.14], ['Fomalhaut', 22.961, -29.622, 1.16], ['Deneb', 20.690, 45.280, 1.25],
    ['Mimosa', 12.795, -59.689, 1.25], ['Regulus', 10.140, 11.967, 1.35], ['Adhara', 6.977, -28.972, 1.5],
    ['Castor', 7.577, 31.888, 1.58], ['Shaula', 17.560, -37.104, 1.62], ['Gacrux', 12.519, -57.113, 1.63],
    ['Bellatrix', 5.419, 6.350, 1.64], ['Elnath', 5.438, 28.608, 1.65], ['Alnilam', 5.604, -1.202, 1.69],
    ['Alnitak', 5.679, -1.943, 1.77], ['Mintaka', 5.533, -0.299, 2.23], ['Saiph', 5.796, -9.670, 2.07],
    ['Alioth', 12.900, 55.960, 1.77], ['Dubhe', 11.062, 61.751, 1.79], ['Merak', 11.031, 56.382, 2.37],
    ['Phecda', 11.897, 53.695, 2.44], ['Megrez', 12.257, 57.033, 3.31], ['Mizar', 13.399, 54.925, 2.23],
    ['Alkaid', 13.792, 49.313, 1.86], ['Polaris', 2.530, 89.264, 1.98], ['Kochab', 14.845, 74.156, 2.08],
    ['Mirfak', 3.405, 49.861, 1.79], ['Algol', 3.136, 40.956, 2.12], ['Alpheratz', 0.140, 29.091, 2.06],
    ['Mirach', 1.162, 35.621, 2.07], ['Almach', 2.065, 42.330, 2.1], ['Hamal', 2.120, 23.463, 2.0],
    ['Schedar', 0.675, 56.537, 2.24], ['Caph', 0.153, 59.150, 2.28], ['Navi', 0.945, 60.717, 2.47],
    ['Ruchbah', 1.430, 60.235, 2.68], ['Segin', 1.907, 63.670, 3.37], ['Denebola', 11.818, 14.572, 2.14],
    ['Algieba', 10.333, 19.842, 2.08], ['Zosma', 11.235, 20.524, 2.56], ['Chertan', 11.237, 15.430, 3.33],
    ['Alphecca', 15.578, 26.715, 2.23], ['Rasalhague', 17.582, 12.560, 2.08], ['Sadr', 20.370, 40.257, 2.23],
    ['Gienah', 20.770, 33.970, 2.48], ['Delta Cygni', 19.750, 45.131, 2.87], ['Albireo', 19.512, 27.960, 3.08],
    ['Enif', 21.736, 9.875, 2.39], ['Markab', 23.079, 15.205, 2.48], ['Scheat', 23.063, 28.083, 2.42],
    ['Algenib', 0.221, 15.184, 2.83], ['Acrab', 16.091, -19.806, 2.62], ['Dschubba', 16.006, -22.622, 2.29],
    ['Larawag', 16.836, -34.293, 2.29], ['Mu Scorpii', 16.864, -38.047, 3.0], ['Zeta Scorpii', 16.909, -42.362, 3.6],
    ['Eta Scorpii', 17.203, -43.239, 3.3], ['Sargas', 17.622, -42.998, 1.86], ['Girtab', 17.708, -39.030, 2.4],
    ['Lesath', 17.513, -37.296, 2.7], ['Kaus Australis', 18.403, -34.385, 1.85], ['Kaus Media', 18.350, -29.828, 2.7],
    ['Kaus Borealis', 18.466, -25.421, 2.81], ['Alnasl', 18.097, -30.424, 2.99], ['Nunki', 18.921, -26.297, 2.05],
    ['Ascella', 19.044, -29.880, 2.6], ['Phi Sagittarii', 18.761, -26.991, 3.17], ['Tau Sagittarii', 19.116, -27.671, 3.32],
    ['Menkalinan', 5.992, 44.948, 1.9], ['Alhena', 6.629, 16.399, 1.93], ['Mirzam', 6.378, -17.956, 1.98],
    ['Wezen', 7.140, -26.393, 1.83], ['Aludra', 7.402, -29.303, 2.45], ['Menkar', 3.038, 4.090, 2.53],
    ['Diphda', 0.727, -17.987, 2.04], ['Alphard', 9.460, -8.659, 1.98], ['Imai', 12.252, -58.749, 2.79],
    ['Pleiades', 3.791, 24.105, 1.6],
  ];

  // Constellation stick figures (pairs of star names) and their labels.
  const FIGURES = {
    Orion: [['Betelgeuse', 'Bellatrix'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'],
      ['Alnitak', 'Saiph'], ['Saiph', 'Rigel'], ['Rigel', 'Mintaka'], ['Betelgeuse', 'Alnitak']],
    'Big Dipper': [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'],
      ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']],
    Cassiopeia: [['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin']],
    Cygnus: [['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah', 'Sadr'], ['Sadr', 'Delta Cygni']],
    Pegasus: [['Markab', 'Scheat'], ['Scheat', 'Alpheratz'], ['Alpheratz', 'Algenib'], ['Algenib', 'Markab'], ['Markab', 'Enif']],
    Andromeda: [['Alpheratz', 'Mirach'], ['Mirach', 'Almach']],
    Leo: [['Regulus', 'Algieba'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Denebola', 'Chertan'], ['Chertan', 'Regulus']],
    Gemini: [['Castor', 'Pollux'], ['Pollux', 'Alhena']],
    Taurus: [['Aldebaran', 'Elnath'], ['Aldebaran', 'Pleiades']],
    Scorpius: [['Acrab', 'Dschubba'], ['Dschubba', 'Antares'], ['Antares', 'Larawag'], ['Larawag', 'Mu Scorpii'],
      ['Mu Scorpii', 'Zeta Scorpii'], ['Zeta Scorpii', 'Eta Scorpii'], ['Eta Scorpii', 'Sargas'], ['Sargas', 'Girtab'],
      ['Girtab', 'Shaula'], ['Shaula', 'Lesath']],
    Sagittarius: [['Kaus Australis', 'Kaus Media'], ['Kaus Media', 'Kaus Borealis'], ['Kaus Borealis', 'Phi Sagittarii'],
      ['Phi Sagittarii', 'Nunki'], ['Nunki', 'Tau Sagittarii'], ['Tau Sagittarii', 'Ascella'], ['Ascella', 'Phi Sagittarii'],
      ['Ascella', 'Kaus Australis'], ['Kaus Media', 'Alnasl'], ['Alnasl', 'Kaus Australis'], ['Kaus Media', 'Phi Sagittarii']],
    'Canis Major': [['Sirius', 'Mirzam'], ['Sirius', 'Adhara'], ['Adhara', 'Wezen'], ['Wezen', 'Aludra'], ['Sirius', 'Wezen']],
    'Southern Cross': [['Acrux', 'Gacrux'], ['Mimosa', 'Imai']],
  };

  // Annual meteor showers: peak month (1–12), day, typical meteors per hour at peak.
  const SHOWERS = [
    ['Quadrantids', 1, 3, 110], ['Lyrids', 4, 22, 18], ['Eta Aquariids', 5, 6, 50], ['Delta Aquariids', 7, 30, 25],
    ['Perseids', 8, 12, 100], ['Draconids', 10, 8, 10], ['Orionids', 10, 21, 20], ['Southern Taurids', 11, 5, 5],
    ['Northern Taurids', 11, 12, 5], ['Leonids', 11, 17, 15], ['Geminids', 12, 14, 150], ['Ursids', 12, 22, 10],
  ];

  // ---------- Formatting ----------
  const fmtTime = d => d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
  const fmtDay = d => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = az => COMPASS[Math.round(A.norm360(az) / 22.5) % 16];
  const height = alt => alt < 15 ? 'low' : alt < 35 ? 'fairly low' : alt < 60 ? 'high' : 'nearly overhead';
  function brightness(mag) {
    if (mag < -3) return 'brighter than anything but the Moon';
    if (mag < -1) return 'brighter than any star';
    if (mag < 1) return 'as bright as the brightest stars';
    if (mag < 3) return 'like a medium-bright star';
    if (mag < 6) return 'faint, needs a dark sky';
    return 'too faint for the eye';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- State ----------
  const place = { ...HOME };
  let nightDate = defaultNight();
  let night = null; // computed facts for the chosen night and place
  let chartTime = null;

  // "Tonight" is the evening of today, or of yesterday if it's still before noon.
  function defaultNight() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() < 12) d.setDate(d.getDate() - 1);
    return d;
  }
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  // ---------- Computing a night ----------
  function computeNight() {
    const { lat, lon } = place;
    const noon = new Date(nightDate.getFullYear(), nightDate.getMonth(), nightDate.getDate(), 12);
    const nextNoon = new Date(noon.getTime() + 86400000);
    const cross = h0 => A.crossings('sun', noon, nextNoon, lat, lon, h0);
    const first = arr => arr[0] || null;
    const last = arr => arr[arr.length - 1] || null;

    const sun = cross(A.horizonFor('sun'));
    const civil = cross(-6), astro = cross(-18);
    const sunset = first(sun.sets), sunrise = last(sun.rises);
    const dusk = first(civil.sets), dawn = last(civil.rises);
    const darkStart = first(astro.sets), darkEnd = last(astro.rises);

    // Chart covers sunset to sunrise (or 6 PM–6 AM where the Sun never sets or never rises).
    const start = sunset || new Date(noon.getTime() + 6 * 3600000);
    const end = sunrise && sunrise > start ? sunrise : new Date(noon.getTime() + 18 * 3600000);
    // Planets count as visible once the sky is reasonably dark (Sun 6° down).
    const obsStart = dusk || start, obsEnd = dawn && dawn > obsStart ? dawn : end;

    const moonX = A.crossings('moon', noon, nextNoon, lat, lon);
    const mid = new Date((obsStart.getTime() + obsEnd.getTime()) / 2);
    const phase = A.moonPhase(mid);

    // Sample each planet every 10 minutes through the dark hours.
    const step = 10 * 60000;
    const times = [];
    for (let t = obsStart.getTime(); t <= obsEnd.getTime(); t += step) times.push(new Date(t));
    const planets = PLANETS.map(p => analyzePlanet(p, times, mid));

    // Close pairs, reported at the time both are highest together (so they're actually up).
    const pairs = [];
    const bodies = planets.filter(p => p.visible).map(p => ({ name: p.name, id: p.id, samples: p.samples }));
    const moonSamples = times.map(t => ({ t, ...A.where('moon', t, lat, lon) }));
    if (moonSamples.some(x => x.alt > 8)) bodies.push({ name: 'the Moon', id: 'moon', samples: moonSamples });
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        let k = -1, bestLow = 8;
        bodies[i].samples.forEach((x, n) => {
          const low = Math.min(x.alt, bodies[j].samples[n].alt);
          if (low > bestLow) { bestLow = low; k = n; }
        });
        if (k < 0) continue;
        const t = times[k];
        const sep = A.separation(posAt(bodies[i].id, t), posAt(bodies[j].id, t));
        if (sep < 6) pairs.push({ a: bodies[i].name, b: bodies[j].name, sep, t, alt: bestLow, az: bodies[i].samples[k].az });
      }
    }

    // Stars precessed to this date once per night.
    const T = A.centuries(mid);
    const stars = STARS.map(([name, raH, dec, mag]) => ({ name, mag, ...A.precessStar(raH * 15, dec, T) }));

    night = { sunset, sunrise, dusk, dawn, darkStart, darkEnd, start, end, obsStart, obsEnd, mid,
      moonrise: first(moonX.rises), moonset: first(moonX.sets), phase, planets, pairs, stars };
  }

  const posAt = (id, t) => id === 'moon' ? A.moon(t) : A.planet(id, t);

  function analyzePlanet(p, times, mid) {
    const mag = A.magnitude(A.planet(p.id, mid));
    const elong = A.separation(A.planet(p.id, mid), A.planet('sun', mid));
    const samples = times.map(t => ({ t, ...A.where(p.id, t, place.lat, place.lon) }));
    const up = samples.filter(s => s.alt >= 8);
    const verdict = !up.length ? 'no' : mag <= 5 ? 'easy' : mag <= 7.5 ? 'bino' : 'scope';
    const info = { ...p, mag, elong, visible: up.length > 0, verdict, samples };
    if (!up.length) {
      const maxAlt = Math.max(...samples.map(s => s.alt));
      info.when = elong < 15 ? 'Too close to the Sun to see right now.'
        : maxAlt < 0 ? 'Below the horizon all night. It’s up during the day.'
        : 'Too low in the sky after dark to see well.';
      return info;
    }
    const best = up.reduce((a, b) => (b.alt > a.alt ? b : a));
    const startT = up[0].t, endT = up[up.length - 1].t;
    const fromDusk = startT - times[0] < 15 * 60000, untilDawn = times[times.length - 1] - endT < 15 * 60000;
    const where = `${height(best.alt)} in the ${compass(best.az)}`;
    const bestAt = `Highest around ${fmtTime(best.t)}, ${where}.`;
    // "Evening" if it climbs into view before midnight, "morning" if only after.
    const evening = startT.getHours() >= 12;
    if (fromDusk && untilDawn) info.when = `Up all night. ${bestAt}`;
    else if (fromDusk) info.when = `Evening: up after dark until about ${fmtTime(endT)}. ${bestAt}`;
    else if (untilDawn && evening) info.when = `Climbs into view around ${fmtTime(startT)} and stays up until dawn. ${bestAt}`;
    else if (untilDawn) info.when = `Morning: climbs into view around ${fmtTime(startT)} and stays up until dawn. ${bestAt}`;
    else info.when = `Up from about ${fmtTime(startT)} to ${fmtTime(endT)}. ${bestAt}`;
    return info;
  }

  // ---------- Rendering: header, glance, planets, extras ----------
  function render() {
    computeNight();
    const tonight = defaultNight();
    $('night-label').textContent = sameDay(nightDate, tonight) ? `Tonight · ${fmtDay(nightDate)}` : `Night of ${fmtDay(nightDate)}`;
    $('tonight-btn').hidden = sameDay(nightDate, tonight);
    $('place-label').textContent = place.name;

    const n = night;
    const pct = Math.round(n.phase.illum * 100);
    const moonTimes = [n.moonrise && `rises ${fmtTime(n.moonrise)}`, n.moonset && `sets ${fmtTime(n.moonset)}`].filter(Boolean).join(' · ') || 'up all night or all day';
    $('glance').innerHTML = [
      ['Sunset', fmtTime(n.sunset), n.dusk ? `Dark enough for planets by ${fmtTime(n.dusk)}` : ''],
      ['Fully dark', n.darkStart ? `${fmtTime(n.darkStart)} – ${fmtTime(n.darkEnd)}` : 'Never fully dark tonight', 'Best for faint stars'],
      ['Moon', `${moonSvg(n.phase)}<span>${A.phaseName(n.phase)}<span class="sub">${pct}% lit · ${moonTimes}</span></span>`, ''],
      ['Sunrise', fmtTime(n.sunrise), n.dawn ? `Sky brightens around ${fmtTime(n.dawn)}` : ''],
    ].map(([k, v, sub]) => `<div><dt>${k}</dt><dd>${v.startsWith('<svg') ? v : `<span>${v}${sub ? `<span class="sub">${sub}</span>` : ''}</span>`}</dd></div>`).join('');

    const order = { easy: 0, bino: 1, scope: 2, no: 3 };
    const label = { easy: 'Naked eye', bino: 'Binoculars', scope: 'Telescope', no: 'Not visible' };
    $('planet-list').innerHTML = n.planets.slice().sort((a, b) => order[a.verdict] - order[b.verdict] || a.mag - b.mag).map(p =>
      `<li class="${p.visible ? '' : 'dim'}">
        <span class="planet-dot" style="color:${p.color}" aria-hidden="true"></span>
        <span class="planet-name">${p.name}</span>
        <span class="verdict v-${p.verdict}">${label[p.verdict]}</span>
        <p class="planet-when">${esc(p.when)}</p>
        ${p.visible ? `<p class="planet-meta">Magnitude ${p.mag.toFixed(1)}, ${brightness(p.mag)}.</p>` : ''}
      </li>`).join('');

    const extras = [];
    for (const [name, m, d, rate] of SHOWERS) {
      const peak = new Date(nightDate.getFullYear(), m - 1, d);
      const days = Math.round((nightDate - peak) / 86400000);
      if (Math.abs(days) > 3) continue;
      const when = days === 0 ? 'peaks tonight' : days < 0 ? `peaks in ${-days} day${days === -1 ? '' : 's'}` : `peaked ${days} day${days === 1 ? '' : 's'} ago`;
      const moonNote = n.phase.illum > 0.6 ? ' A bright Moon will wash out the fainter ones.' : n.phase.illum < 0.3 ? ' The Moon is thin, so conditions are good.' : '';
      extras.push(`<div class="extra"><b>☄️ The ${name} meteor shower ${when}.</b><p>Up to about ${rate} meteors an hour from a dark site at the peak, best after midnight.${moonNote}</p></div>`);
    }
    for (const pr of n.pairs.sort((a, b) => a.sep - b.sep)) {
      const A_ = pr.a === 'the Moon' ? 'The Moon' : pr.a;
      extras.push(`<div class="extra"><b>✨ ${A_} and ${pr.b} are close together.</b><p>Only ${pr.sep.toFixed(1)}° apart, about ${Math.max(1, Math.round(pr.sep / 2))} finger${pr.sep >= 3 ? 's' : ''} wide at arm’s length. Best around ${fmtTime(pr.t)}, ${height(pr.alt)} in the ${compass(pr.az)}.</p></div>`);
    }
    $('extras').innerHTML = extras.length ? `<h2>Also tonight</h2>${extras.join('')}` : '';

    setupSlider();
  }

  // Small SVG of the Moon's phase (lit on the right when waxing, as seen from the north).
  function moonSvg(ph) {
    const r = 12, k = 1 - 2 * ph.illum; // ellipse half-width as a fraction of r
    const rx = Math.abs(k) * r;
    const right = ph.waxing;
    // Lit limb: a half circle on the lit side, closed by the terminator ellipse.
    const sweepLimb = right ? 1 : 0;
    const sweepTerm = (ph.illum < 0.5) === right ? 0 : 1;
    const d = `M13 1 A${r} ${r} 0 0 ${sweepLimb} 13 25 A${rx} ${r} 0 0 ${sweepTerm} 13 1 Z`;
    return `<svg class="moon-icon" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="${r}" fill="#2a2e45"/><path d="${d}" fill="#f1ecd9"/></svg>`;
  }

  // ---------- Sky chart ----------
  const canvas = $('chart');
  const ctx = canvas.getContext('2d');
  let hits = [];

  function setupSlider() {
    const n = night;
    const total = Math.round((n.end - n.start) / 60000);
    const s = $('time-slider');
    s.max = String(total);
    s.step = '5';
    const now = new Date();
    const nowIn = now >= n.start && now <= n.end;
    $('now-btn').hidden = !nowIn;
    // Default: now if it's dark, otherwise once the sky is fully dark (or 90 minutes after sunset).
    const target = nowIn ? now : (n.darkStart && n.darkStart < n.end ? n.darkStart : new Date(n.start.getTime() + 90 * 60000));
    s.value = String(Math.round((target - n.start) / 60000));
    onSlide();
  }

  function onSlide() {
    chartTime = new Date(night.start.getTime() + Number($('time-slider').value) * 60000);
    $('time-label').textContent = fmtTime(chartTime);
    drawChart();
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return w;
  }

  function drawChart() {
    if (!night) return;
    if (canvas.clientWidth < 80) return; // not laid out yet; the resize observer redraws it
    const W = sizeCanvas();
    const cx = W / 2, cy = W / 2, R = W / 2 - 26;
    const { lat, lon } = place;
    const t = chartTime;
    // Looking up: north at the top, east on the left.
    const proj = (alt, az) => {
      const r = (90 - alt) / 90 * R;
      return { x: cx - r * Math.sin(az * Math.PI / 180), y: cy - r * Math.cos(az * Math.PI / 180) };
    };
    hits = [];
    ctx.clearRect(0, 0, W, W);

    // Sky color follows the Sun.
    const sunAlt = A.where('sun', t, lat, lon).alt;
    const sky = sunAlt > -6 ? ['#22356a', '#14204a'] : sunAlt > -12 ? ['#121c43', '#0b1230'] : ['#070b20', '#040612'];
    const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    g.addColorStop(0, sky[1]); g.addColorStop(1, sky[0]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

    // Altitude rings at 30° and 60°.
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    for (const a of [30, 60]) { ctx.beginPath(); ctx.arc(cx, cy, (90 - a) / 90 * R, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);

    // Stars and figures.
    const starPos = new Map();
    for (const s of night.stars) {
      const h = A.altAz(s.ra, s.dec, t, lat, lon);
      starPos.set(s.name, { ...h, ...proj(h.alt, h.az), s });
    }
    ctx.strokeStyle = 'rgba(160,180,255,0.22)'; ctx.lineWidth = 1;
    const labels = [];
    for (const [fig, pairs] of Object.entries(FIGURES)) {
      const pts = [];
      for (const [a, b] of pairs) {
        const p = starPos.get(a), q = starPos.get(b);
        if (!p || !q || (p.alt < 0 && q.alt < 0)) continue;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        if (p.alt > 0) pts.push(p);
        if (q.alt > 0) pts.push(q);
      }
      if (pts.length >= 3) labels.push({ fig, x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
    }
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(160,180,255,0.45)';
    for (const l of labels) ctx.fillText(l.fig.toUpperCase(), l.x, l.y + 16);

    for (const { alt, x, y, s } of starPos.values()) {
      if (alt < 0) continue;
      const r = Math.max(0.7, 2.6 - 0.5 * s.mag);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.name === 'Pleiades' ? 'rgba(190,210,255,0.85)' : 'rgba(235,240,255,0.92)';
      ctx.fill();
      if (s.mag < 0.9) { ctx.fillStyle = 'rgba(225,230,255,0.55)'; ctx.fillText(s.name, x, y - 6); }
      hits.push({ x, y, r: Math.max(r, 6), title: s.name, sub: s.name === 'Pleiades' ? 'Star cluster' : `Star · magnitude ${s.mag.toFixed(1)}`, alt, az: starPos.get(s.name).az });
    }

    // Planets. Their labels are drawn after the clip, so they're never cut off at the edge.
    const tags = [];
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
    for (const p of PLANETS) {
      const w = A.where(p.id, t, lat, lon);
      if (w.alt < 0) continue;
      const { x, y } = proj(w.alt, w.az);
      const mag = A.magnitude(w);
      const r = Math.max(2.5, Math.min(6.5, 4.2 - 0.6 * mag));
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
      ctx.shadowBlur = 0;
      tags.push({ text: p.name, color: p.color, x, y, r });
      hits.push({ x, y, r: Math.max(r, 9), title: p.name, sub: `Planet · magnitude ${mag.toFixed(1)}`, alt: w.alt, az: w.az });
    }

    // Moon, with its lit side facing the Sun.
    const m = A.where('moon', t, lat, lon);
    if (m.alt > -1) {
      const { x, y } = proj(m.alt, m.az);
      const sw = A.where('sun', t, lat, lon);
      const sp = proj(sw.alt, sw.az);
      const ph = A.moonPhase(t);
      drawMoon(x, y, 9, Math.atan2(sp.y - y, sp.x - x), ph.illum);
      tags.push({ text: 'Moon', color: 'rgba(241,236,217,0.9)', x, y, r: 9 });
      hits.push({ x, y, r: 12, title: 'Moon', sub: `${A.phaseName(ph)} · ${Math.round(ph.illum * 100)}% lit`, alt: m.alt, az: m.az });
    }
    ctx.restore();

    // Labels above each dot, or below it if that would overlap a label already placed.
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
    const placed = [];
    const overlaps = b => placed.some(o => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
    for (const tg of tags) {
      const w = ctx.measureText(tg.text).width;
      const half = w / 2;
      const lx = Math.max(half + 2, Math.min(W - half - 2, tg.x));
      let ly = tg.y - tg.r - 5;
      let box = { x1: lx - half, x2: lx + half, y1: ly - 10, y2: ly + 2 };
      if (overlaps(box)) { ly = tg.y + tg.r + 13; box = { x1: lx - half, x2: lx + half, y1: ly - 10, y2: ly + 2 }; }
      placed.push(box);
      ctx.fillStyle = tg.color; ctx.fillText(tg.text, lx, ly);
    }

    // Horizon ring and compass points.
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    for (const [lbl, az] of [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]) {
      const a = az * Math.PI / 180, r = R + 14;
      ctx.fillStyle = lbl.length === 1 ? 'rgba(255,178,63,0.95)' : 'rgba(225,230,255,0.45)';
      ctx.fillText(lbl, cx - r * Math.sin(a), cy - r * Math.cos(a));
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Moon disc: dark circle, lit half toward the Sun, then the terminator ellipse.
  function drawMoon(x, y, r, angle, illum) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#3a3e55'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = '#f1ecd9'; ctx.fill();
    const k = 2 * illum - 1;
    ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = k > 0 ? '#f1ecd9' : '#3a3e55'; ctx.fill();
    ctx.restore();
  }

  // Tap or hover to name things on the chart.
  function showTip(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let best = null, bestD = Infinity;
    for (const h of hits) {
      const d = Math.hypot(h.x - px, h.y - py);
      if (d < Math.max(h.r, 10) && d < bestD) { best = h; bestD = d; }
    }
    const tip = $('chart-tip');
    if (!best) { tip.hidden = true; return; }
    tip.innerHTML = `${esc(best.title)}<br><small>${esc(best.sub)} · ${Math.round(best.alt)}° up in the ${compass(best.az)}</small>`;
    tip.style.left = `${best.x}px`; tip.style.top = `${best.y}px`;
    tip.hidden = false;
  }
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') showTip(e); });
  canvas.addEventListener('pointerdown', showTip);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') $('chart-tip').hidden = true; });

  // ---------- Controls ----------
  $('time-slider').addEventListener('input', () => { $('chart-tip').hidden = true; onSlide(); });
  $('now-btn').addEventListener('click', () => {
    $('time-slider').value = String(Math.round((Date.now() - night.start) / 60000));
    onSlide();
  });
  const shiftDay = n => { nightDate = new Date(nightDate.getFullYear(), nightDate.getMonth(), nightDate.getDate() + n); render(); };
  $('prev-day').addEventListener('click', () => shiftDay(-1));
  $('next-day').addEventListener('click', () => shiftDay(1));
  $('tonight-btn').addEventListener('click', () => { nightDate = defaultNight(); render(); });

  // One button: "Use my location", which then becomes "Use Melbourne, FL" to switch back.
  $('locate-btn').addEventListener('click', () => {
    const btn = $('locate-btn'), note = $('place-note');
    if (btn.dataset.mode === 'home') {
      Object.assign(place, HOME);
      btn.textContent = 'Use my location';
      delete btn.dataset.mode;
      note.textContent = '';
      render();
      return;
    }
    if (!navigator.geolocation) { note.textContent = 'Your browser can’t share a location.'; note.className = 'place-note bad'; return; }
    btn.disabled = true;
    note.textContent = 'Finding you…'; note.className = 'place-note';
    navigator.geolocation.getCurrentPosition(pos => {
      place.lat = pos.coords.latitude; place.lon = pos.coords.longitude;
      const ns = place.lat >= 0 ? 'N' : 'S', ew = place.lon >= 0 ? 'E' : 'W';
      place.name = `Your location (${Math.abs(place.lat).toFixed(1)}°${ns}, ${Math.abs(place.lon).toFixed(1)}°${ew})`;
      note.textContent = 'Using your location. It stays on this device.';
      btn.textContent = 'Use Melbourne, FL';
      btn.dataset.mode = 'home';
      btn.disabled = false;
      render();
    }, () => {
      note.textContent = 'Couldn’t get your location, so this is still showing Melbourne, FL.';
      note.className = 'place-note bad';
      btn.disabled = false;
    }, { timeout: 10000, maximumAge: 600000 });
  });

  // Redraw whenever the chart's size changes (including its first layout).
  let lastW = 0;
  new ResizeObserver(() => {
    if (canvas.clientWidth !== lastW) { lastW = canvas.clientWidth; drawChart(); }
  }).observe(canvas);

  render();
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.skyDebug = { get night() { return night; }, place };
})();
