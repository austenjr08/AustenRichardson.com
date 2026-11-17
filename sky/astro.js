// Astronomy math for "Your Sky Tonight": where the Sun, Moon and planets are, as seen
// from a place on Earth at a given time. Everything is computed in the browser.
//
// Planets: JPL Keplerian elements (Standish, valid 1800–2050), good to a few arcminutes.
// Moon: simplified lunar theory with the main perturbations (Schlyter), good to ~0.1°.
// Accuracy is far better than the eye can tell on a sky chart; rise/set times are
// within a minute or two.
(function (root) {
  'use strict';

  const RAD = Math.PI / 180;
  const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD);
  const atan2d = (y, x) => Math.atan2(y, x) / RAD;
  const asind = x => Math.asin(Math.max(-1, Math.min(1, x))) / RAD;
  const norm360 = d => ((d % 360) + 360) % 360;

  const jd = date => date.getTime() / 86400000 + 2440587.5;
  const centuries = date => (jd(date) - 2451545.0) / 36525;

  // a (AU), e, I, L, long. of perihelion, long. of node (degrees), then rates per century.
  const ELEMENTS = {
    mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
      0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
      -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  };

  // Heliocentric ecliptic (J2000) x, y, z in AU.
  function helio(name, T) {
    const el = ELEMENTS[name];
    const a = el[0] + el[6] * T, e = el[1] + el[7] * T, I = el[2] + el[8] * T;
    const L = el[3] + el[9] * T, peri = el[4] + el[10] * T, node = el[5] + el[11] * T;
    const w = peri - node;
    const M = norm360(L - peri);
    // Kepler's equation by Newton's method (in radians).
    const Mr = M * RAD;
    let E = Mr + e * Math.sin(Mr);
    for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = cos(w), sw = sin(w), cN = cos(node), sN = sin(node), cI = cos(I), sI = sin(I);
    return {
      x: (cw * cN - sw * sN * cI) * xp + (-sw * cN - cw * sN * cI) * yp,
      y: (cw * sN + sw * cN * cI) * xp + (-sw * sN + cw * cN * cI) * yp,
      z: (sw * sI) * xp + (cw * sI) * yp,
    };
  }

  // Obliquity of the ecliptic, degrees.
  const obliquity = T => 23.43929111 - 0.0130042 * T;
  // General precession in ecliptic longitude since J2000, degrees.
  const precession = T => 1.396971 * T;

  // Ecliptic (of date) longitude/latitude → equatorial RA/Dec (of date), degrees.
  function eclToEq(lon, lat, T) {
    const ob = obliquity(T);
    const x = cos(lat) * cos(lon);
    const y = cos(lat) * sin(lon) * cos(ob) - sin(lat) * sin(ob);
    const z = cos(lat) * sin(lon) * sin(ob) + sin(lat) * cos(ob);
    return { ra: norm360(atan2d(y, x)), dec: asind(z) };
  }
  function eqToEcl(ra, dec, T) {
    const ob = obliquity(T);
    const x = cos(dec) * cos(ra);
    const y = cos(dec) * sin(ra) * cos(ob) + sin(dec) * sin(ob);
    const z = -cos(dec) * sin(ra) * sin(ob) + sin(dec) * cos(ob);
    return { lon: norm360(atan2d(y, x)), lat: asind(z) };
  }

  // J2000 RA/Dec of a star → RA/Dec of date (precession via the ecliptic; fine for charts).
  function precessStar(ra, dec, T) {
    const e = eqToEcl(ra, dec, 0);
    return eclToEq(e.lon + precession(T), e.lat, T);
  }

  // Geocentric position of a planet or the Sun.
  function planet(name, date) {
    const T = centuries(date);
    const E = helio('earth', T);
    const P = name === 'sun' ? { x: 0, y: 0, z: 0 } : helio(name, T);
    const x = P.x - E.x, y = P.y - E.y, z = P.z - E.z;
    const delta = Math.hypot(x, y, z);
    const lon = norm360(atan2d(y, x) + precession(T));
    const lat = asind(z / delta);
    const eq = eclToEq(lon, lat, T);
    const r = Math.hypot(P.x, P.y, P.z), R = Math.hypot(E.x, E.y, E.z);
    return { name, ...eq, lon, lat, delta, r, R };
  }

  // Apparent magnitude of a planet (standard approximations, ±0.3 mag).
  function magnitude(p) {
    const { r, delta, R } = p;
    const i = Math.acos(Math.max(-1, Math.min(1, (r * r + delta * delta - R * R) / (2 * r * delta)))) / RAD;
    const d = 5 * Math.log10(r * delta);
    switch (p.name) {
      case 'mercury': return -0.42 + d + 0.0380 * i - 0.000273 * i * i + 0.000002 * i * i * i;
      case 'venus': return -4.40 + d + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
      case 'mars': return -1.52 + d + 0.016 * i;
      case 'jupiter': return -9.40 + d + 0.005 * i;
      case 'saturn': return -8.88 + d + 0.044 * i;
      case 'uranus': return -7.19 + d;
      case 'neptune': return -6.87 + d;
      default: return 0;
    }
  }

  // The Moon: geocentric ecliptic position (of date), distance in Earth radii.
  function moon(date) {
    const d = jd(date) - 2451543.5;
    const T = centuries(date);
    const N = norm360(125.1228 - 0.0529538083 * d);
    const i = 5.1454;
    const w = norm360(318.0634 + 0.1643573223 * d);
    const a = 60.2666, e = 0.054900;
    const M = norm360(115.3654 + 13.0649929509 * d);
    let E = M * RAD + e * Math.sin(M * RAD) * (1 + e * Math.cos(M * RAD));
    for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M * RAD) / (1 - e * Math.cos(E));
    const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = atan2d(yv, xv), dist0 = Math.hypot(xv, yv);
    const xh = dist0 * (cos(N) * cos(v + w) - sin(N) * sin(v + w) * cos(i));
    const yh = dist0 * (sin(N) * cos(v + w) + cos(N) * sin(v + w) * cos(i));
    const zh = dist0 * (sin(v + w) * sin(i));
    let lon = atan2d(yh, xh), lat = atan2d(zh, Math.hypot(xh, yh)), dist = dist0;

    // Main perturbations.
    const Ms = norm360(356.0470 + 0.9856002585 * d);
    const ws = 282.9404 + 4.70935e-5 * d;
    const Ls = Ms + ws, Lm = N + w + M, D = Lm - Ls, F = Lm - N, Mm = M;
    lon += -1.274 * sin(Mm - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms) - 0.059 * sin(2 * Mm - 2 * D)
      - 0.057 * sin(Mm - 2 * D + Ms) + 0.053 * sin(Mm + 2 * D) + 0.046 * sin(2 * D - Ms) + 0.041 * sin(Mm - Ms)
      - 0.035 * sin(D) - 0.031 * sin(Mm + Ms) - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(Mm - 4 * D);
    lat += -0.173 * sin(F - 2 * D) - 0.055 * sin(Mm - F - 2 * D) - 0.046 * sin(Mm + F - 2 * D)
      + 0.033 * sin(F + 2 * D) + 0.017 * sin(2 * Mm + F);
    dist += -0.58 * cos(Mm - 2 * D) - 0.46 * cos(2 * D);

    lon = norm360(lon);
    const eq = eclToEq(lon, lat, T);
    return { name: 'moon', ...eq, lon, lat, dist };
  }

  // Moon phase: illuminated fraction (0–1), waxing or waning, and its age in days.
  function moonPhase(date) {
    const m = moon(date), s = planet('sun', date);
    const elong = norm360(m.lon - s.lon); // 0 = new, 180 = full
    const cosE = cos(m.lat) * cos(m.lon - s.lon);
    const illum = (1 - cosE) / 2;
    return { illum, waxing: elong < 180, elong, age: elong / 360 * 29.530589 };
  }
  function phaseName(p) {
    const e = p.elong;
    if (e < 6 || e > 354) return 'New Moon';
    if (e < 84) return 'Waxing Crescent';
    if (e < 96) return 'First Quarter';
    if (e < 174) return 'Waxing Gibbous';
    if (e < 186) return 'Full Moon';
    if (e < 264) return 'Waning Gibbous';
    if (e < 276) return 'Last Quarter';
    return 'Waning Crescent';
  }

  // Local sidereal time, degrees. lon is east-positive.
  function lst(date, lon) {
    const J = jd(date), T = (J - 2451545.0) / 36525;
    return norm360(280.46061837 + 360.98564736629 * (J - 2451545.0) + 0.000387933 * T * T + lon);
  }

  // RA/Dec → altitude/azimuth (azimuth from north, through east), degrees.
  function altAz(ra, dec, date, lat, lon) {
    const H = lst(date, lon) - ra;
    const alt = asind(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H));
    const az = norm360(atan2d(sin(H), cos(H) * sin(lat) - Math.tan(dec * RAD) * cos(lat)) + 180);
    return { alt, az };
  }

  // Position of a named body at a place and time, including the Moon's parallax
  // (the Moon is close enough to sit up to ~1° lower than its geocentric position).
  function where(name, date, lat, lon) {
    const p = name === 'moon' ? moon(date) : planet(name, date);
    const h = altAz(p.ra, p.dec, date, lat, lon);
    if (name === 'moon') h.alt -= asind(Math.cos(h.alt * RAD) / p.dist);
    return { ...p, ...h };
  }

  // Altitudes used for rising/setting (refraction and the size of the disc included).
  const HORIZON = { sun: -0.833, moon: 0.125 };
  const horizonFor = name => HORIZON[name] ?? -0.5667;

  // Times between start and end when the body crosses the horizon (or another altitude).
  // Samples every 10 minutes and interpolates; returns { rises: [Date], sets: [Date] }.
  function crossings(name, start, end, lat, lon, h0 = horizonFor(name)) {
    const step = 10 * 60000, rises = [], sets = [];
    let t0 = start.getTime(), a0 = where(name, start, lat, lon).alt - h0;
    for (let t1 = t0 + step; t1 <= end.getTime() + 1; t1 += step) {
      const a1 = where(name, new Date(t1), lat, lon).alt - h0;
      if ((a0 < 0) !== (a1 < 0)) {
        const t = new Date(t0 + (t1 - t0) * (a0 / (a0 - a1)));
        (a1 > 0 ? rises : sets).push(t);
      }
      t0 = t1; a0 = a1;
    }
    return { rises, sets };
  }

  // Angle on the sky between two RA/Dec positions, degrees.
  function separation(a, b) {
    return Math.acos(Math.max(-1, Math.min(1,
      sin(a.dec) * sin(b.dec) + cos(a.dec) * cos(b.dec) * cos(a.ra - b.ra)))) / RAD;
  }

  const api = { jd, centuries, planet, moon, moonPhase, phaseName, magnitude, lst, altAz, where,
    crossings, horizonFor, separation, precessStar, norm360 };
  root.Astro = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
