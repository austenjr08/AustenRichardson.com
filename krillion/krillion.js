// Lana Del Krillion: a music trivia game where the nichest answer wins.
//
// Any real answer counts. Each answer is checked live:
//   - Deezer (public API, JSONP) for whether it exists and how popular it is
//   - MusicBrainz (public API) for facts: country, year formed or born, band vs. solo, genre tags
// The less popular a valid answer is, the more points it scores.
(() => {
  'use strict';

  const ROUNDS = 7;
  const TIME_LIMIT = 25; // seconds per question

  // ---------- Data ----------

  // Well-known artists in every genre. "Name a song / album by X" and "Name someone who's
  // collaborated with X" questions are built from these.
  const POOL = {
    pop: ['Taylor Swift', 'Lana Del Rey', 'Ariana Grande', 'Billie Eilish', 'Dua Lipa', 'Sabrina Carpenter',
      'Olivia Rodrigo', 'Lady Gaga', 'Harry Styles', 'Chappell Roan', 'Charli xcx', 'Katy Perry', 'Rihanna',
      'Madonna', 'Britney Spears', 'Lorde', 'Miley Cyrus'],
    hiphop: ['Drake', 'Kendrick Lamar', 'Kanye West', 'Eminem', 'Travis Scott', 'Tyler, The Creator',
      'Nicki Minaj', 'J. Cole', 'Doja Cat', 'Lil Wayne', 'Outkast', 'Mac Miller', 'A$AP Rocky'],
    rock: ['The Beatles', 'Queen', 'Led Zeppelin', 'Nirvana', 'Radiohead', 'Arctic Monkeys', 'Fleetwood Mac',
      'The Rolling Stones', 'Red Hot Chili Peppers', 'Foo Fighters', 'Pink Floyd', 'Green Day', 'David Bowie'],
    country: ['Morgan Wallen', 'Zach Bryan', 'Dolly Parton', 'Johnny Cash', 'Luke Combs', 'Chris Stapleton',
      'Kacey Musgraves', 'Shania Twain', 'Willie Nelson', 'Carrie Underwood'],
    rnb: ['SZA', 'The Weeknd', 'Beyoncé', 'Frank Ocean', 'Usher', 'Stevie Wonder', 'Marvin Gaye',
      'Daniel Caesar', 'Alicia Keys', 'Whitney Houston', 'Bruno Mars'],
    electronic: ['Daft Punk', 'Calvin Harris', 'Avicii', 'Skrillex', 'Fred again..', 'Disclosure',
      'Aphex Twin', 'Kygo', 'Justice'],
    indie: ['Mitski', 'Phoebe Bridgers', 'Tame Impala', 'The Strokes', 'Vampire Weekend', 'Mac DeMarco',
      'Arcade Fire', 'The Smiths', 'Clairo', 'Beach House'],
    latin: ['Bad Bunny', 'Shakira', 'Karol G', 'Peso Pluma', 'J Balvin', 'Rosalía', 'Daddy Yankee', 'Marc Anthony'],
    metal: ['Metallica', 'Iron Maiden', 'Black Sabbath', 'Slipknot', 'System Of A Down', 'Linkin Park', 'Deftones'],
    kpop: ['BTS', 'BLACKPINK', 'TWICE', 'Stray Kids', 'NewJeans', 'SEVENTEEN'],
    jazz: ['Miles Davis', 'Frank Sinatra', 'Nina Simone', 'Ella Fitzgerald', 'Louis Armstrong', 'John Coltrane'],
  };

  // Genres for "Name a ___ artist". dz = Deezer genre IDs, tags = MusicBrainz tag keywords.
  const GENRES = {
    pop:        { label: 'pop', dz: [132], tags: ['pop'] },
    hiphop:     { label: 'hip-hop', dz: [116], tags: ['hip hop', 'hip-hop', 'rap', 'trap'] },
    rock:       { label: 'rock', dz: [152], tags: ['rock'] },
    country:    { label: 'country', dz: [84], tags: ['country'] },
    rnb:        { label: 'R&B or soul', dz: [165, 169], tags: ['r&b', 'rnb', 'rhythm and blues', 'soul', 'funk'] },
    electronic: { label: 'electronic', dz: [106, 113], tags: ['electronic', 'electronica', 'house', 'techno', 'edm', 'dance', 'dubstep', 'trance', 'drum and bass', 'idm', 'synth'] },
    indie:      { label: 'indie or alternative', dz: [85], tags: ['indie', 'alternative'] },
    latin:      { label: 'Latin', dz: [197, 122, 67, 65, 71], tags: ['latin', 'reggaeton', 'salsa', 'regional mexican', 'cumbia', 'bachata', 'corrido', 'banda'] },
    metal:      { label: 'metal', dz: [464], tags: ['metal'] },
    kpop:       { label: 'K-pop', dz: [16], tags: ['k-pop', 'kpop', 'korean'] },
    jazz:       { label: 'jazz', dz: [129], tags: ['jazz'] },
    folk:       { label: 'folk', dz: [466], tags: ['folk'] },
    blues:      { label: 'blues', dz: [153], tags: ['blues'] },
    reggae:     { label: 'reggae', dz: [144], tags: ['reggae', 'dancehall', 'ska'] },
    punk:       { label: 'punk', dz: [], tags: ['punk'] },
    shoegaze:   { label: 'shoegaze', dz: [], tags: ['shoegaze', 'dream pop'] },
    emo:        { label: 'emo', dz: [], tags: ['emo'] },
    grunge:     { label: 'grunge', dz: [], tags: ['grunge'] },
    disco:      { label: 'disco', dz: [], tags: ['disco'] },
    bossanova:  { label: 'bossa nova', dz: [], tags: ['bossa nova', 'mpb'] },
    gospel:     { label: 'gospel', dz: [186], tags: ['gospel', 'christian'] },
    afrobeats:  { label: 'Afrobeats', dz: [2], tags: ['afrobeats', 'afrobeat', 'afropop', 'afro'] },
  };

  // Genre buttons on the start screen. sub = which genres its "Name a ___ artist" rounds can ask about.
  const CHOICES = [
    { id: 'all', label: 'Everything', sub: Object.keys(GENRES) },
    { id: 'pop', label: 'Pop', sub: ['pop', 'disco'] },
    { id: 'hiphop', label: 'Hip-Hop', sub: ['hiphop'] },
    { id: 'rock', label: 'Rock', sub: ['rock', 'punk', 'grunge', 'blues'] },
    { id: 'country', label: 'Country', sub: ['country', 'folk', 'blues'] },
    { id: 'rnb', label: 'R&B & Soul', sub: ['rnb', 'gospel', 'afrobeats'] },
    { id: 'electronic', label: 'Electronic', sub: ['electronic', 'disco'] },
    { id: 'indie', label: 'Indie & Alt', sub: ['indie', 'shoegaze', 'emo', 'folk'] },
    { id: 'latin', label: 'Latin', sub: ['latin', 'bossanova', 'reggae'] },
    { id: 'metal', label: 'Metal', sub: ['metal', 'punk', 'grunge'] },
    { id: 'kpop', label: 'K-Pop', sub: ['kpop', 'pop'] },
    { id: 'jazz', label: 'Jazz', sub: ['jazz', 'bossanova', 'blues'] },
  ];

  const WORDS = ['love', 'night', 'girl', 'heart', 'baby', 'summer', 'fire', 'dream', 'blue', 'rain', 'dance',
    'money', 'home', 'sun', 'moon', 'cry', 'gold', 'wild', 'dark', 'sweet', 'california', 'paradise',
    'cherry', 'young', 'heaven', 'angel', 'ocean', 'diamond', 'kiss', 'queen'];

  // MusicBrainz gives a country code, and sometimes only a region or city in "area".
  // The extra names here let those still count.
  const COUNTRIES = [
    { code: 'GB', name: 'the UK', areas: ['United Kingdom', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'London', 'Manchester', 'Liverpool', 'Glasgow', 'Birmingham', 'Bristol', 'Sheffield', 'Leeds'] },
    { code: 'CA', name: 'Canada', areas: ['Canada', 'Toronto', 'Montreal', 'Montréal', 'Vancouver', 'Ontario', 'Quebec', 'Québec', 'British Columbia', 'Alberta'] },
    { code: 'AU', name: 'Australia', areas: ['Australia', 'Sydney', 'Melbourne', 'Perth', 'Brisbane', 'Adelaide'] },
    { code: 'SE', name: 'Sweden', areas: ['Sweden', 'Stockholm', 'Gothenburg', 'Göteborg', 'Malmö'] },
    { code: 'IS', name: 'Iceland', areas: ['Iceland', 'Reykjavík', 'Reykjavik'] },
    { code: 'JP', name: 'Japan', areas: ['Japan', 'Tokyo', 'Osaka'] },
    { code: 'KR', name: 'South Korea', areas: ['South Korea', 'Seoul', 'Busan'] },
    { code: 'FR', name: 'France', areas: ['France', 'Paris', 'Lyon', 'Marseille'] },
    { code: 'DE', name: 'Germany', areas: ['Germany', 'Berlin', 'Hamburg', 'Munich', 'München', 'Cologne', 'Köln'] },
    { code: 'BR', name: 'Brazil', areas: ['Brazil', 'Rio de Janeiro', 'São Paulo', 'Bahia'] },
    { code: 'MX', name: 'Mexico', areas: ['Mexico', 'Mexico City', 'Ciudad de México', 'Guadalajara', 'Monterrey', 'Sinaloa', 'Culiacán'] },
    { code: 'NG', name: 'Nigeria', areas: ['Nigeria', 'Lagos'] },
    { code: 'IE', name: 'Ireland', areas: ['Ireland', 'Dublin', 'Cork'] },
    { code: 'JM', name: 'Jamaica', areas: ['Jamaica', 'Kingston'] },
    { code: 'NZ', name: 'New Zealand', areas: ['New Zealand', 'Auckland', 'Wellington'] },
    { code: 'NO', name: 'Norway', areas: ['Norway', 'Oslo', 'Bergen'] },
    { code: 'CO', name: 'Colombia', areas: ['Colombia', 'Medellín', 'Bogotá', 'Barranquilla', 'Cali'] },
    { code: 'PR', name: 'Puerto Rico', areas: ['Puerto Rico', 'San Juan'] },
    { code: 'ES', name: 'Spain', areas: ['Spain', 'Madrid', 'Barcelona', 'Catalonia', 'Andalusia'] },
    { code: 'IT', name: 'Italy', areas: ['Italy', 'Rome', 'Milan', 'Naples'] },
    { code: 'NL', name: 'the Netherlands', areas: ['Netherlands', 'Amsterdam', 'Rotterdam', 'Utrecht'] },
    { code: 'FI', name: 'Finland', areas: ['Finland', 'Helsinki'] },
    { code: 'AR', name: 'Argentina', areas: ['Argentina', 'Buenos Aires'] },
  ];

  const BAND_DECADES = [1960, 1970, 1980, 1990, 2000, 2010];
  const BORN_DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000];
  const LETTERS = 'ABCDEFGHIJKLMNOPRSTVWY'.split('');

  // Rarity categories, by points on a single answer, from most to least niche.
  // Every answer lands in exactly one: 0 | 1–20 | 21–40 | 41–60 | 61–80 | 81–99 | 100.
  const TIERS = [
    { min: 100, name: 'Lana Del Krillion', cls: 't-krill', emoji: '🦐', blurb: 'nobody else would say this' },
    { min: 81, name: 'Underground', cls: 't-under', emoji: '🔦', blurb: 'basically a secret' },
    { min: 61, name: 'Crate Digger', cls: 't-crate', emoji: '💿', blurb: 'real fans only' },
    { min: 41, name: 'Deep Cut', cls: 't-deep', emoji: '🌊', blurb: 'off the beaten path' },
    { min: 21, name: 'Fan Favorite', cls: 't-fan', emoji: '🎟️', blurb: 'well known' },
    { min: 1,  name: 'Radio Hit', cls: 't-radio', emoji: '📻', blurb: 'everyone says this' },
    { min: 0,  name: 'Wrong Turn', cls: 't-miss', emoji: '✖️', blurb: 'skipped or out of time' },
  ];
  const tierFor = pts => TIERS.find(t => pts >= t.min);
  const tierRange = t => {
    const i = TIERS.indexOf(t), hi = i === 0 ? 100 : TIERS[i - 1].min - 1;
    return t.min === hi ? String(hi) : `${t.min}–${hi}`;
  };

  // The road trip: the car drives from Compton toward the beach, one point = one step.
  // Milestones are total-point values; the car "hits" each one as it drives past.
  const MILESTONES = [
    { v: 60,  label: 'Rosecrans Ave', emoji: '🛣️' },
    { v: 140, label: 'Taco Truck', emoji: '🌮' },
    { v: 230, label: 'Swap Meet', emoji: '🛍️' },
    { v: 320, label: 'Record Store', emoji: '💿' },
    { v: 420, label: 'Lowrider Show', emoji: '🚗' },
    { v: 520, label: 'Sunset Blvd', emoji: '🌅' },
    { v: 610, label: 'Santa Monica', emoji: '🎡' },
    { v: 700, label: 'Venice Beach', emoji: '🌊' },
  ];

  // Final status, by average points per round: from playing basements to playing stadiums.
  const STATUS = [
    { min: 85, name: 'Superstar', emoji: '🌟', blurb: 'Stadiums, magazine covers, the whole thing.' },
    { min: 72, name: 'Headliner', emoji: '🎤', blurb: 'Your name is at the top of the poster.' },
    { min: 60, name: 'Rising Star', emoji: '🚀', blurb: 'The blogs are starting to notice.' },
    { min: 48, name: 'Opening Act', emoji: '🎸', blurb: 'Warming up the crowd for someone famous.' },
    { min: 36, name: 'Local Legend', emoji: '🏙️', blurb: 'Everyone in town knows your name.' },
    { min: 24, name: 'Open Mic', emoji: '🎙️', blurb: 'Five minutes and a borrowed guitar.' },
    { min: 0,  name: 'Underground', emoji: '🕳️', blurb: 'Playing basements. Everyone starts somewhere.' },
  ];

  // ---------- Helpers ----------

  const $ = id => document.getElementById(id);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Normalize for comparing names: case, accents, "the", "&", punctuation.
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/\$/g, 's')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, 'and').replace(/^the\s+/, '')
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, '');
  }

  // Song or album title without "(Remastered 2011)", "[feat. X]" or " - Radio Edit".
  const cleanTitle = t => String(t).replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').trim();

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // 1 = identical, 0 = nothing in common.
  function sim(a, b) {
    const x = norm(a), y = norm(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    return 1 - lev(x, y) / Math.max(x.length, y.length);
  }
  const close = (a, b, t = 0.8) => sim(a, b) >= t;

  // How well a typed answer matches a song or album title, so short forms count:
  //   3 = same title (typos allowed)            "Ultravilence" → Ultraviolence
  //   2 = the start of the title                "Birds in the Trap" → Birds In The Trap Sing McKnight
  //   1 = the title's initials, or all its words "NFR" → Norman Fucking Rockwell!
  //   0 = no match
  const words = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').split(/[^a-z0-9$']+/).map(w => w.replace(/'/g, '')).filter(Boolean);
  function titleMatch(title, typed) {
    if (close(title, typed, 0.82)) return 3;
    const t = norm(title), x = norm(typed);
    if (x.length >= 4 && t.startsWith(x) && x.length >= t.length * 0.35) return 2;
    const tw = words(title), xw = words(typed);
    if (x.length >= 2 && tw.length >= 2 && tw.map(w => w[0]).join('') === x) return 1;
    if (xw.length >= 2 && xw.every(w => tw.includes(w))) return 1;
    return 0;
  }
  // Index of the best match in a list of titles (earlier = more popular wins ties), or -1.
  function bestTitle(titles, typed) {
    let best = -1, bestScore = 0;
    titles.forEach((t, i) => {
      const sc = titleMatch(t, typed);
      if (sc > bestScore) { best = i; bestScore = sc; }
    });
    return best;
  }

  // ---------- APIs ----------

  // Deezer has no CORS headers, but supports JSONP. It allows about 50 requests per 5 seconds,
  // so requests are spaced out, and a "quota exceeded" reply is waited out and retried.
  const dzCache = new Map();
  let dzN = 0, dzNext = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function dz(path, params = {}) {
    const q = new URLSearchParams({ ...params, output: 'jsonp' });
    const key = path + '?' + q;
    if (dzCache.has(key)) return dzCache.get(key);
    const p = (async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = Math.max(0, dzNext - Date.now());
        dzNext = Date.now() + wait + 120;
        await sleep(wait);
        try { return await dzOnce(path, q); } catch (e) {
          if (!/quota/i.test(e.message) || attempt >= 3) throw e;
          await sleep(2000 * (attempt + 1));
        }
      }
    })();
    dzCache.set(key, p);
    p.catch(() => dzCache.delete(key));
    return p;
  }
  function dzOnce(path, params) {
    const q = new URLSearchParams(params);
    return new Promise((resolve, reject) => {
      const cb = 'lanaDz' + (++dzN);
      q.set('callback', cb);
      const s = document.createElement('script');
      const done = () => { clearTimeout(timer); delete window[cb]; s.remove(); };
      const timer = setTimeout(() => { done(); reject(new Error('timeout')); }, 12000);
      window[cb] = d => { done(); d && d.error ? reject(new Error(d.error.message || 'deezer')) : resolve(d); };
      s.onerror = () => { done(); reject(new Error('network')); };
      s.src = `https://api.deezer.com/${path}?${q}`;
      document.head.appendChild(s);
    });
  }

  // MusicBrainz asks for at most one request per second.
  // A 503 means "slow down", so wait and retry a few times before giving up.
  const mbCache = new Map();
  let mbNext = 0;
  function mbSlot(extra = 0) {
    const wait = Math.max(0, mbNext - Date.now()) + extra;
    mbNext = Date.now() + wait + 1100;
    return new Promise(r => setTimeout(r, wait));
  }
  async function mbFetch(url) {
    for (let attempt = 0; ; attempt++) {
      await mbSlot(attempt * 1500);
      const r = await fetch(url);
      if (r.ok) return r.json();
      if (r.status !== 503 || attempt >= 4) throw new Error('musicbrainz ' + r.status);
    }
  }
  function mb(path, params) {
    const q = new URLSearchParams({ ...params, fmt: 'json' });
    const key = path + '?' + q;
    if (mbCache.has(key)) return mbCache.get(key);
    const p = mbFetch(`https://musicbrainz.org/ws/2/${path}?${q}`);
    mbCache.set(key, p);
    p.catch(() => mbCache.delete(key));
    return p;
  }
  const luceneQuote = s => '"' + String(s).replace(/["\\]/g, '\\$&') + '"';

  // Best Deezer artist for a typed name: a close name match with the most fans
  // (so "Drake" finds Drake, not a 200-fan Drake impersonator).
  async function findArtist(name) {
    const d = await dz('search/artist', { q: name, limit: 15 });
    const hits = (d.data || []).filter(a => close(a.name, name));
    if (!hits.length) return null;
    hits.sort((a, b) => b.nb_fan - a.nb_fan);
    const a = hits[0];
    return { id: a.id, name: a.name, fans: a.nb_fan, img: a.picture_medium };
  }

  // MusicBrainz artists whose name (or alias) closely matches.
  async function mbArtists(name) {
    const d = await mb('artist', { query: 'artist:' + luceneQuote(name), limit: 8 });
    return (d.artists || []).filter(a =>
      close(a.name, name, 0.85) || (a.aliases || []).some(al => close(al.name, name, 0.85)));
  }

  // An artist's top 100 songs, most played first, one entry per title.
  async function topSongs(a) {
    const top = await dz(`artist/${a.id}/top`, { limit: 100 });
    const list = [];
    for (const t of top.data || []) {
      const c = cleanTitle(t.title);
      if (!list.some(x => norm(x.title) === norm(c))) list.push({ title: c, raw: t });
    }
    return list;
  }
  // An artist's albums and EPs (no singles), most fans first, one entry per title.
  async function albumList(a) {
    const d = await dz(`artist/${a.id}/albums`, { limit: 150 });
    const byTitle = new Map();
    for (const x of (d.data || []).filter(x => x.record_type !== 'single')) {
      const k = norm(cleanTitle(x.title));
      if (!byTitle.has(k) || byTitle.get(k).fans < x.fans) byTitle.set(k, x);
    }
    return { list: [...byTitle.values()].sort((x, y) => y.fans - x.fans), singles: (d.data || []).filter(x => x.record_type === 'single') };
  }

  // ---------- Example answers (for the end-of-game review) ----------
  // Each question type can list real answers with the points they'd score. The review groups
  // them by rarity category and shows a few from each.

  // Run fn over items with at most n at a time.
  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) { const i = next++; try { out[i] = await fn(items[i]); } catch (e) { out[i] = null; } }
    }));
    return out;
  }

  // Score a list of artist names the same way an answer would be scored.
  async function scoreNames(names) {
    const seen = new Set();
    const uniq = names.filter(n => { const k = norm(n); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    // findArtist gives null for "not on Deezer" (as niche as it gets); a failed lookup is dropped.
    const found = await pool(uniq, 4, n => findArtist(n).then(a => ({ a }), () => null));
    return uniq.map((n, i) => {
      const f = found[i];
      if (!f) return null;
      return f.a ? { name: f.a.name, pts: artistPoints(f.a.fans) } : { name: n, pts: 100 };
    }).filter(Boolean);
  }

  // Artist names from a MusicBrainz search. Better-documented artists (more tags) come first,
  // which mixes in well-known names rather than only obscure ones.
  const PLACEHOLDERS = /^(various artists|traditional|anonymous|unknown|\[.*\])$/i;
  async function mbNames(query, { take = 36, tag = null } = {}) {
    const d = await mb('artist', { query, limit: 100 });
    // With a genre tag, only keep artists where it's one of their main tags, so a stray
    // "shoegaze" tag on Oasis doesn't make Oasis a shoegaze example.
    const mainTag = a => {
      const tags = (a.tags || []).slice().sort((x, y) => y.count - x.count).slice(0, 6);
      return tags.some(t => t.name.toLowerCase().includes(tag));
    };
    return (d.artists || [])
      .filter(a => !PLACEHOLDERS.test(a.name) && (!tag || mainTag(a)))
      .sort((a, b) => (b.tags || []).length - (a.tags || []).length)
      .slice(0, take).map(latinName);
  }
  // Deezer lists 坂本龍一 as "Ryuichi Sakamoto", so use an English alias (or the
  // "Sakamoto, Ryuichi" sort name) when MusicBrainz's main name isn't in Latin letters.
  function latinName(a) {
    if (!/[^\u0000-\u024f\s]/.test(a.name)) return a.name;
    const al = (a.aliases || []).find(x => x.locale === 'en' && x.primary) || (a.aliases || []).find(x => x.locale === 'en');
    if (al) return al.name;
    const sn = a['sort-name'] || '';
    if (sn && !/[^\u0000-\u024f\s]/.test(sn)) return sn.includes(', ') ? sn.split(', ').reverse().join(' ') : sn;
    return a.name;
  }

  // ---------- Scoring ----------

  // Artist popularity → points. ~15M Deezer fans or more → 5, 1M → ~26, 100K → ~49, 10K → ~71, 1K → ~93.
  const artistPoints = fans => clamp(Math.round(100 * (Math.log10(15e6) - Math.log10(fans + 1)) / (Math.log10(15e6) - Math.log10(500))), 5, 100);
  // Deezer track rank (0 to ~1,000,000) → points.
  const trackPoints = rank => clamp(Math.round(5 + 95 * (900000 - rank) / 800000), 5, 100);
  // Position in a ranked list (1 = most popular) → points.
  const positionPoints = (pos, size) => clamp(Math.round(5 + 95 * Math.log(pos) / Math.log(Math.max(size, 10))), 5, 100);

  // ---------- Question types ----------
  // Each type builds a question for the chosen genre. A question has:
  //   type, text, hint, fields ([{id, label}]), and check(answers) → result or throws Miss(reason).

  class Miss extends Error {}

  const TYPES = {
    songBy(g) {
      const artist = pick(poolFor(g));
      return {
        type: 'Song', text: `Name a song by ${artist}`, hint: 'Deep cuts beat the singles.',
        fields: [{ id: 'song', label: 'Song title' }],
        async examples() {
          const a = await findArtist(artist);
          const list = await topSongs(a);
          const ex = list.map((x, i) => ({ name: x.title, pts: positionPoints(i + 1, list.length + 1) }));
          // Album tracks outside the top 100 are the deepest cuts.
          const { list: albums } = await albumList(a);
          for (const al of albums.slice(-2)) {
            const tr = await dz(`album/${al.id}/tracks`, { limit: 50 });
            for (const t of tr.data || []) {
              const c = cleanTitle(t.title);
              if (!list.some(x => norm(x.title) === norm(c))) ex.push({ name: c, pts: 100 });
            }
          }
          return ex;
        },
        async check({ song }) {
          const a = await findArtist(artist);
          if (!a) throw new Error('lookup');
          const list = await topSongs(a);
          let pos = bestTitle(list.map(x => x.title), song) + 1;
          let track = pos ? list[pos - 1].raw : null;
          if (!pos) {
            // Not in their top 100: look for it anywhere in their catalog.
            const s = await dz('search', { q: `${song} ${a.name}`, limit: 40 });
            const theirs = (s.data || []).filter(t => t.artist.id === a.id);
            track = theirs[bestTitle(theirs.map(t => cleanTitle(t.title)), song)];
            if (!track) throw new Miss(`Couldn’t find a song called “${song}” by ${a.name}.`);
            pos = list.length + 1;
          }
          const pts = positionPoints(pos, list.length + 1);
          return {
            pts, name: cleanTitle(track.title), img: track.album && track.album.cover_medium,
            detail: pos <= list.length ? `#${pos} most played ${a.name} song` : `Outside ${a.name}’s top ${list.length}`,
            common: list.slice(0, 3).map(x => x.title),
          };
        },
      };
    },

    albumBy(g) {
      const artist = pick(poolFor(g));
      return {
        type: 'Album', text: `Name an album or EP by ${artist}`, hint: 'Studio albums, EPs, live albums and compilations all count.',
        fields: [{ id: 'album', label: 'Album title' }],
        async examples() {
          const { list } = await albumList(await findArtist(artist));
          return list.map((x, i) => ({ name: cleanTitle(x.title), pts: list.length < 2 ? 5 : positionPoints(i + 1, list.length) }));
        },
        async check({ album }) {
          const a = await findArtist(artist);
          if (!a) throw new Error('lookup');
          const { list, singles } = await albumList(a);
          const pos = bestTitle(list.map(x => cleanTitle(x.title)), album) + 1;
          if (!pos) {
            const single = singles[bestTitle(singles.map(x => cleanTitle(x.title)), album)];
            throw new Miss(single ? `“${cleanTitle(single.title)}” is a single, not an album or EP.` : `Couldn’t find an album called “${album}” by ${a.name}.`);
          }
          const hit = list[pos - 1];
          return {
            pts: list.length < 2 ? 5 : positionPoints(pos, list.length), name: cleanTitle(hit.title), img: hit.cover_medium,
            detail: `#${pos} of ${list.length} ${a.name} releases by Deezer fans`,
            common: list.slice(0, 3).map(x => cleanTitle(x.title)),
          };
        },
      };
    },

    collab(g) {
      const artist = pick(poolFor(g));
      return {
        type: 'Collab', text: `Name an artist who has a song with ${artist}`, hint: 'Features count, in either direction.',
        fields: [{ id: 'who', label: 'Artist' }],
        async examples() {
          const a = await findArtist(artist);
          const top = await dz(`artist/${a.id}/top`, { limit: 100 });
          const ids = new Map();
          for (const t of top.data || []) for (const c of t.contributors || []) if (c.id !== a.id) ids.set(c.id, c.name);
          const info = await pool([...ids.keys()].slice(0, 30), 4, id => dz(`artist/${id}`));
          return info.filter(Boolean).map(x => ({ name: x.name, pts: artistPoints(x.nb_fan || 0) }));
        },
        async check({ who }) {
          const [a, b] = await Promise.all([findArtist(artist), findArtist(who)]);
          if (!a) throw new Error('lookup');
          if (!b) throw new Miss(`Couldn’t find an artist called “${who}”.`);
          if (a.id === b.id) throw new Miss('Nice try. They can’t collaborate with themselves.');
          const s = await dz('search', { q: `${a.name} ${b.name}`, limit: 50 });
          const tracks = s.data || [];
          const mentions = (t, x) => norm(t.title).includes(norm(x.name));
          let found = tracks.find(t => (t.artist.id === a.id && mentions(t, b)) || (t.artist.id === b.id && mentions(t, a)));
          if (!found) {
            // Feature credits aren't always in the title, so check full contributor lists.
            const cands = tracks.filter(t => t.artist.id === a.id || t.artist.id === b.id).slice(0, 6);
            for (const t of cands) {
              const full = await dz(`track/${t.id}`);
              const ids = (full.contributors || []).map(c => c.id);
              if (ids.includes(a.id) && ids.includes(b.id)) { found = t; break; }
            }
          }
          if (!found) throw new Miss(`Couldn’t find a song with both ${a.name} and ${b.name}.`);
          return {
            pts: artistPoints(b.fans), name: b.name, img: b.img,
            detail: `${fmt(b.fans)} fans · on “${cleanTitle(found.title)}”`,
          };
        },
      };
    },

    genreArtist(g) {
      const key = pick(CHOICES.find(c => c.id === g).sub);
      const genre = GENRES[key];
      const an = /^[aeiou]/i.test(genre.label) ? 'an' : 'a';
      return {
        type: 'Genre', text: `Name ${an} ${genre.label} artist`, hint: 'Solo artists and bands both count.',
        fields: [{ id: 'who', label: 'Artist' }],
        async examples() {
          const tag = genre.tags[0];
          return scoreNames(await mbNames(`tag:${luceneQuote(tag)}`, { tag }));
        },
        async check({ who }) {
          const a = await findArtist(who);
          if (!a) throw new Miss(`Couldn’t find an artist called “${who}”.`);
          let ok = false;
          if (genre.dz.length) {
            const al = await dz(`artist/${a.id}/albums`, { limit: 40 });
            ok = (al.data || []).some(x => genre.dz.includes(x.genre_id));
          }
          let tags = [];
          if (!ok) {
            const cands = await mbArtists(a.name);
            tags = [...new Set(cands.flatMap(c => (c.tags || []).map(t => t.name.toLowerCase())))];
            ok = tags.some(t => genre.tags.some(k => t.includes(k)));
          }
          if (!ok) {
            const said = tags.length ? ` Their tags say: ${tags.slice(0, 4).join(', ')}.` : '';
            throw new Miss(`Couldn’t confirm ${a.name} as ${genre.label}.${said}`);
          }
          return { pts: artistPoints(a.fans), name: a.name, img: a.img, detail: `${fmt(a.fans)} fans on Deezer` };
        },
      };
    },

    wordSong() {
      const word = pick(WORDS);
      const hasWord = t => new RegExp('\\b' + word, 'i').test(t);
      return {
        type: 'Title', text: `Name a song with “${word}” in the title`, hint: 'Any artist, any era. Just the title.',
        fields: [{ id: 'song', label: 'Song title' }],
        async examples() {
          const pages = await Promise.all([0, 100, 200].map(index => dz('search', { q: word, limit: 100, index })));
          const seen = new Set();
          const ex = [];
          for (const t of pages.flatMap(p => p.data || [])) {
            const c = cleanTitle(t.title);
            if (!hasWord(c) || seen.has(norm(c))) continue;
            seen.add(norm(c));
            ex.push({ name: c, sub: t.artist.name, pts: trackPoints(t.rank) });
          }
          return ex;
        },
        async check({ song }) {
          // Title only, so score the best-known song with that title: a title shared with a
          // big hit is a common answer even if you meant a deeper cut.
          const s = await dz('search', { q: song, limit: 50 });
          // Best-matching titles first (exact beats a short form), then the most popular of those.
          const scored = (s.data || []).map(t => ({ t, sc: titleMatch(cleanTitle(t.title), song) })).filter(x => x.sc);
          if (!scored.length) throw new Miss(`Couldn’t find a song called “${song}”.`);
          // Check the word against the full title, so a short form like "Crazy in L" still counts.
          const withWord = scored.filter(x => hasWord(cleanTitle(x.t.title)));
          if (!withWord.length) throw new Miss(`“${cleanTitle(scored[0].t.title)}” doesn’t have “${word}” in it.`);
          const top = Math.max(...withWord.map(x => x.sc));
          const hits = withWord.filter(x => x.sc === top).map(x => x.t);
          hits.sort((x, y) => y.rank - x.rank);
          const t = hits[0];
          return {
            pts: trackPoints(t.rank), name: cleanTitle(t.title), img: t.album && t.album.cover_medium,
            detail: `${t.artist.name} · popularity ${Math.round(t.rank / 10000)}/100`,
          };
        },
      };
    },

    country() {
      const c = pick(COUNTRIES);
      return {
        type: 'Origin', text: `Name an artist from ${c.name}`, hint: 'Where they were born or formed.',
        fields: [{ id: 'who', label: 'Artist' }],
        async examples() { return scoreNames(await mbNames(`country:${c.code}`)); },
        async check({ who }) {
          const a = await findArtist(who);
          const name = a ? a.name : who;
          const cands = await mbArtists(name);
          if (!cands.length) throw new Miss(`Couldn’t find an artist called “${who}”.`);
          const from = x => x.country === c.code || [x.area, x['begin-area']].some(ar => ar && c.areas.includes(ar.name));
          if (!cands.some(from)) {
            const top = cands[0];
            const place = (top.area && top.area.name) || top.country;
            throw new Miss(place ? `MusicBrainz has ${top.name} from ${place}.` : `Couldn’t confirm ${top.name} is from ${c.name}.`);
          }
          return scoreArtist(a, name);
        },
      };
    },

    bandDecade() {
      const d = pick(BAND_DECADES);
      return {
        type: 'Era', text: `Name a band that formed in the ${d}s`, hint: 'Groups only, no solo artists.',
        fields: [{ id: 'who', label: 'Band' }],
        async examples() { return scoreNames(await mbNames(`type:group AND begin:[${d} TO ${d + 10}}`)); },
        async check({ who }) {
          const a = await findArtist(who);
          const name = a ? a.name : who;
          const cands = await mbArtists(name);
          if (!cands.length) throw new Miss(`Couldn’t find a band called “${who}”.`);
          const groups = cands.filter(x => x.type === 'Group');
          if (!groups.length) throw new Miss(`${cands[0].name} is a solo artist, not a band.`);
          const year = x => parseInt(((x['life-span'] || {}).begin || '').slice(0, 4), 10);
          if (!groups.some(x => year(x) >= d && year(x) < d + 10)) {
            const y = year(groups[0]);
            throw new Miss(y ? `${groups[0].name} formed in ${y}.` : `Couldn’t find when ${groups[0].name} formed.`);
          }
          return scoreArtist(a, name);
        },
      };
    },

    bornDecade() {
      const d = pick(BORN_DECADES);
      return {
        type: 'Era', text: `Name a solo artist born in the ${d}s`, hint: 'Singers, rappers, producers, anyone solo.',
        fields: [{ id: 'who', label: 'Artist' }],
        async examples() { return scoreNames(await mbNames(`type:person AND begin:[${d} TO ${d + 10}}`)); },
        async check({ who }) {
          const a = await findArtist(who);
          const name = a ? a.name : who;
          const cands = await mbArtists(name);
          if (!cands.length) throw new Miss(`Couldn’t find an artist called “${who}”.`);
          const people = cands.filter(x => x.type === 'Person');
          if (!people.length) throw new Miss(`${cands[0].name} is a group, not a solo artist.`);
          const year = x => parseInt(((x['life-span'] || {}).begin || '').slice(0, 4), 10);
          if (!people.some(x => year(x) >= d && year(x) < d + 10)) {
            const y = year(people[0]);
            throw new Miss(y ? `${people[0].name} was born in ${y}.` : `Couldn’t find when ${people[0].name} was born.`);
          }
          return scoreArtist(a, name);
        },
      };
    },

    letter() {
      const L = pick(LETTERS);
      return {
        type: 'Letter', text: `Name an artist whose name starts with “${L}”`, hint: 'Leading “The” doesn’t count. The Strokes is an S.',
        fields: [{ id: 'who', label: 'Artist' }],
        async examples() {
          const pages = await Promise.all([L, L + 'a', L + 'e', L + 'o', L + 'i'].map(q => dz('search/artist', { q, limit: 100 })));
          return pages.flatMap(p => p.data || [])
            .filter(a => norm(a.name)[0] === L.toLowerCase() && a.nb_fan > 0)
            .map(a => ({ name: a.name, pts: artistPoints(a.nb_fan) }));
        },
        async check({ who }) {
          const a = await findArtist(who);
          if (!a) throw new Miss(`Couldn’t find an artist called “${who}”.`);
          if (norm(a.name)[0] !== L.toLowerCase()) throw new Miss(`${a.name} doesn’t start with “${L}”.`);
          return { pts: artistPoints(a.fans), name: a.name, img: a.img, detail: `${fmt(a.fans)} fans on Deezer` };
        },
      };
    },
  };

  // Score an artist confirmed by MusicBrainz. Not on Deezer at all = as niche as it gets.
  function scoreArtist(a, name) {
    if (!a) return { pts: 100, name, detail: 'Not even on Deezer' };
    return { pts: artistPoints(a.fans), name: a.name, img: a.img, detail: `${fmt(a.fans)} fans on Deezer` };
  }

  function poolFor(g) {
    return g === 'all' ? Object.values(POOL).flat() : POOL[g];
  }

  // Every question asked this session, so a question never comes up twice, even across games.
  // Kept in sessionStorage, so a page refresh doesn't reset it, but a new tab starts fresh.
  const USED_KEY = 'ldk-used-questions';
  const used = new Set((() => { try { return JSON.parse(sessionStorage.getItem(USED_KEY)) || []; } catch (e) { return []; } })());
  const saveUsed = () => { try { sessionStorage.setItem(USED_KEY, JSON.stringify([...used])); } catch (e) {} };

  // Seven rounds, mixing question types. Core types come first in line; any type whose
  // questions have all been asked this session is passed over for another type.
  function buildGame(g) {
    const core = ['songBy', 'genreArtist', 'wordSong', 'collab'];
    const extra = ['albumBy', 'country', 'bandDecade', 'bornDecade', 'letter'];
    const all = Object.keys(TYPES);
    let queue = shuffle(core).concat(shuffle(extra));
    for (let i = 0; i < 12; i++) queue = queue.concat(shuffle(all));
    const qs = [];
    const fresh = q => !used.has(q.text) && !qs.some(x => x.text === q.text);
    for (const t of queue) {
      if (qs.length >= ROUNDS) break;
      for (let n = 0; n < 200; n++) {
        const q = TYPES[t](g);
        if (fresh(q)) { qs.push(q); break; }
      }
    }
    // Only if every question for this genre has been asked: forget the oldest ones and go again.
    if (qs.length < ROUNDS) {
      const old = [...used].slice(0, Math.ceil(used.size / 2));
      old.forEach(t => used.delete(t));
      return buildGame(g);
    }
    qs.forEach(q => used.add(q.text));
    saveUsed();
    return shuffle(qs);
  }

  // ---------- UI ----------

  let genre = 'all';
  let game = null; // { qs, i, results: [{q, r|null}], total, timeLeft, lastMiss }

  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    // One road scene, shown above the question during play and above the results at the end.
    const scene = $('road');
    scene.hidden = id === 'screen-start';
    $('ladder').hidden = id === 'screen-end';
    if (id === 'screen-round') $('screen-round').insertBefore(scene, $('q-card'));
    if (id === 'screen-end') $('screen-end').insertBefore(scene, $('final-card'));
    window.scrollTo({ top: 0 });
  }

  // ---------- Road scene ----------

  const ROAD_X0 = 128, ROAD_LEN = 578; // car's front bumper starts at x=128 and can travel 578 units
  const MAX_PTS = ROUNDS * 100;
  const xFor = pts => ROAD_X0 + (Math.min(pts, MAX_PTS) / MAX_PTS) * ROAD_LEN;

  function palm(x, h, flip) {
    const top = 128 - h, lean = flip ? -10 : 10;
    const frond = (dx, dy) => `<path d="M${x + lean} ${top} q${dx * 0.5} ${-8 + dy * 0.2} ${dx} ${dy}" />`;
    return `<g class="palm"><path class="trunk" d="M${x} 128 Q${x + lean * 0.3} ${top + h / 2} ${x + lean} ${top}" />` +
      `<g class="fronds">${frond(-26, 10)}${frond(26, 10)}${frond(-18, 18)}${frond(18, 18)}${frond(-6, -4)}${frond(8, -2)}</g></g>`;
  }

  function buildScene() {
    const skyline = [[0, 104, 40], [46, 98, 30], [82, 108, 50], [140, 100, 34], [180, 92, 22], [208, 106, 46],
      [262, 100, 38], [306, 110, 60], [372, 96, 28], [406, 104, 44], [456, 112, 70], [530, 108, 40]]
      .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${128 - y}" />`).join('');
    const signs = MILESTONES.map((m, i) => {
      const x = xFor(m.v), y = i % 2 ? 80 : 58, w = m.label.length * 6.2 + 26;
      const px = Math.min(x, 716 - w / 2); // keep the last plates inside the scene
      return `<g class="sign" data-v="${m.v}" style="transform-origin:${px}px ${y + 9}px">` +
        `<line x1="${x}" y1="${y + 18}" x2="${x}" y2="130" class="post" />` +
        `<rect x="${px - w / 2}" y="${y}" width="${w}" height="18" rx="4" class="plate" />` +
        `<text x="${px}" y="${y + 12.5}" text-anchor="middle">${m.emoji} ${m.label}</text></g>`;
    }).join('');
    const spokes = [0, 45, 90, 135].map(a => `<line x1="-7" y1="0" x2="7" y2="0" transform="rotate(${a})" />`).join('');
    const wheel = cx => `<g transform="translate(${cx} 166)"><circle r="9.5" class="tire" /><g class="spin"><circle r="6.5" class="rim" />${spokes}</g></g>`;

    $('road-scene').innerHTML = `
      <svg viewBox="0 0 720 190" role="img" aria-label="Road trip progress">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#241736" /><stop offset="0.55" stop-color="#b8436a" /><stop offset="1" stop-color="#f6a35b" />
          </linearGradient>
        </defs>
        <rect width="720" height="130" fill="url(#sky)" />
        <circle cx="640" cy="112" r="38" class="sun" />
        <g class="skyline">${skyline}</g>
        <path class="ocean" d="M600 116 H720 V128 H600 Z" />
        ${palm(70, 70, false)}${palm(250, 84, true)}${palm(470, 76, false)}${palm(585, 92, true)}${palm(690, 66, false)}
        <rect y="126" width="720" height="8" class="curb" />
        <rect y="134" width="720" height="56" class="asphalt" />
        <line x1="0" y1="160" x2="720" y2="160" class="lane" />
        <g class="start-sign"><line x1="40" y1="64" x2="40" y2="130" class="post" />
          <rect x="6" y="44" width="68" height="22" rx="3" /><text x="40" y="54" text-anchor="middle">CITY OF</text>
          <text x="40" y="63" text-anchor="middle">COMPTON</text></g>
        ${signs}
        <g id="car" class="car">
          <g transform="translate(108 172) scale(1.3) translate(-108 -172)">
          <g class="car-bounce">
            <!-- the pop star -->
            <g class="star">
              <path class="hair" d="M48 132 C42 116 46 100 58 99 C70 98 75 112 70 132 Z" />
              <rect x="52" y="117" width="12" height="16" rx="4" class="dress" />
              <circle cx="58" cy="108" r="6.5" class="skin" />
              <path class="hair" d="M51 107 C51 99 65 98 65 106 C62 102 55 102 51 107 Z" />
              <path class="bow" d="M60 99 l6 -4 l0 7 Z M60 99 l-1 -6 l6 3 Z" />
              <path class="shades" d="M53.5 107 a1.6 1.6 0 0 1 3 0 l-1.5 2.4 Z M58.5 107 a1.6 1.6 0 0 1 3 0 l-1.5 2.4 Z" />
              <path class="lips" d="M56.6 111.8 q1.4 1 2.8 0" />
              <path class="arm wave" d="M63 120 L70 112 L72 103" />
            </g>
            <path class="windshield" d="M76 136 L82 122" />
            <path class="body" d="M14 152 C14 142 20 138 30 137 L96 136 C104 136 108 141 108 150 L108 158 C108 161 106 162 103 162 L18 162 C15 162 14 160 14 157 Z" />
            <path class="chrome" d="M18 150 H106" />
            <circle cx="105" cy="146" r="2.2" class="headlight" />
            ${wheel(36)}${wheel(88)}
          </g>
          </g>
        </g>
        <text id="odometer" x="12" y="20" class="odometer">0 pts</text>
      </svg>
      <div class="road-toast" id="road-toast" aria-live="polite"></div>`;
  }

  // Car is drawn with its front bumper at x=108, so shift it so the bumper sits at the point position.
  const carShift = pts => xFor(pts) - 108;
  let roadTimers = [];
  let reached = null; // furthest milestone hit this game

  function resetRoad() {
    roadTimers.forEach(clearTimeout);
    roadTimers = [];
    reached = null;
    const car = $('car');
    car.style.transition = 'none';
    car.style.transform = `translateX(${carShift(0)}px)`;
    car.classList.remove('driving', 'stalled');
    for (const s of document.querySelectorAll('#road .sign')) s.classList.remove('lit', 'hit');
    $('odometer').textContent = '0 pts';
    $('road-toast').classList.remove('show');
  }

  function toast(text) {
    const t = $('road-toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth; // restart the animation
    t.classList.add('show');
  }

  // Drive from one total to another, hitting any milestones in between.
  function drive(from, to) {
    const car = $('car');
    if (to <= from) {
      $('odometer').textContent = `${to} pts`;
      car.classList.remove('stalled'); void car.offsetWidth; car.classList.add('stalled');
      toast('🛑 Stalled out. No points, no miles.');
      return;
    }
    const ms = Math.round(clamp(700 + (to - from) * 16, 900, 2600));
    car.style.transition = `transform ${ms}ms linear`;
    car.style.transform = `translateX(${carShift(to)}px)`;
    car.classList.add('driving');
    roadTimers.push(setTimeout(() => car.classList.remove('driving'), ms));
    // Odometer counts up while the car drives.
    const t0 = performance.now();
    const tick = now => {
      const f = clamp((now - t0) / ms, 0, 1);
      $('odometer').textContent = `${Math.round(from + (to - from) * f)} pts`;
      if (f < 1 && game && game.total === to) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (const m of MILESTONES) {
      if (m.v <= from || m.v > to) continue;
      roadTimers.push(setTimeout(() => {
        const sign = document.querySelector(`#road .sign[data-v="${m.v}"]`);
        sign.classList.add('lit', 'hit');
        car.classList.remove('bump'); void car.offsetWidth; car.classList.add('bump');
        reached = m;
        toast(`${m.emoji} Made it to ${m.label}! (${m.v} pts)`);
      }, ms * (m.v - from) / (to - from)));
    }
  }

  function renderStart() {
    $('tier-legend').innerHTML = TIERS.map(t =>
      `<li><span>${t.emoji}&nbsp; <b>${t.name}</b> · ${t.blurb}</span><span>${tierRange(t)} pts</span></li>`).reverse().join('');
    $('genre-chips').innerHTML = CHOICES.map(c =>
      `<button class="chip" role="radio" aria-checked="${c.id === genre}" data-g="${c.id}">${c.label}</button>`).join('');
  }

  $('genre-chips').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    genre = b.dataset.g;
    renderStart();
  });

  $('start-btn').addEventListener('click', () => {
    game = { qs: buildGame(genre), i: 0, results: [], total: 0 };
    resetRoad();
    renderLadder(null);
    show('screen-round');
    renderRound();
  });

  function renderRound() {
    const q = game.qs[game.i];
    game.lastMiss = '';
    $('round-count').textContent = `Round ${game.i + 1} / ${ROUNDS}`;
    $('round-score').textContent = `${game.total} pts`;
    $('progress-bar').style.width = `${(game.i / ROUNDS) * 100}%`;
    $('q-type').textContent = q.type;
    $('q-text').textContent = q.text;
    $('q-hint').textContent = q.hint;
    $('inputs').innerHTML = q.fields.map(f =>
      `<label class="field"><span>${f.label}</span><input name="${f.id}" required maxlength="120" spellcheck="false"></label>`).join('');
    $('answer-form').hidden = false;
    $('result').hidden = true;
    setMsg('');
    setBusy(false);
    startTimer();
    $('inputs').querySelector('input').focus();
  }

  // ---------- Countdown ----------
  // 25 seconds per question, as many guesses as you like. The clock pauses while an answer
  // is being checked, so slow music databases never cost you time.
  let timerId = 0, timerLast = 0, timerPaused = false;

  function startTimer() {
    stopTimer();
    game.timeLeft = TIME_LIMIT * 1000;
    timerPaused = false;
    timerLast = performance.now();
    renderTimer();
    timerId = setInterval(tickTimer, 100);
  }
  function stopTimer() { clearInterval(timerId); timerId = 0; }
  function tickTimer() {
    const now = performance.now();
    if (!timerPaused) game.timeLeft -= now - timerLast;
    timerLast = now;
    renderTimer();
    if (game.timeLeft <= 0) {
      stopTimer();
      finishRound(null, 'Time’s up!');
    }
  }
  function renderTimer() {
    const left = Math.max(0, game.timeLeft);
    const secs = Math.ceil(left / 1000);
    $('timer-num').textContent = `${secs}s`;
    $('timer-bar').style.width = `${(left / (TIME_LIMIT * 1000)) * 100}%`;
    $('timer').classList.toggle('low', secs <= 5);
    $('timer').classList.toggle('paused', timerPaused);
  }

  function setMsg(text, cls = '') {
    const m = $('msg');
    m.textContent = text;
    m.className = 'msg ' + cls;
  }

  function setBusy(b) {
    $('submit-btn').disabled = b;
    $('skip-btn').disabled = b;
    for (const i of $('inputs').querySelectorAll('input')) i.readOnly = b;
  }

  $('answer-form').addEventListener('submit', async e => {
    e.preventDefault();
    const q = game.qs[game.i];
    const answers = {};
    for (const f of q.fields) answers[f.id] = new FormData(e.target).get(f.id).trim();
    if (Object.values(answers).some(v => !v)) return;

    setBusy(true);
    timerPaused = true;
    renderTimer();
    setMsg('Flipping through the record crates… (clock paused)', 'wait');
    try {
      const r = await q.check(answers);
      finishRound(r);
    } catch (err) {
      setBusy(false);
      timerPaused = false;
      timerLast = performance.now();
      renderTimer();
      if (err instanceof Miss) {
        game.lastMiss = err.message;
        setMsg(err.message + ' Try another!', 'bad');
      } else {
        console.error(err);
        setMsg('Couldn’t reach the music databases. Check your connection and try again.', 'bad');
      }
      const first = $('inputs').querySelector('input');
      first.select();
      first.focus();
    }
  });

  $('skip-btn').addEventListener('click', () => finishRound(null, 'Skipped.'));

  function finishRound(r, why) {
    stopTimer();
    const q = game.qs[game.i];
    game.results.push({ q, r });
    const before = game.total;
    if (r) game.total += r.pts;
    drive(before, game.total);
    $('round-score').textContent = `${game.total} pts`;
    $('progress-bar').style.width = `${((game.i + 1) / ROUNDS) * 100}%`;
    $('answer-form').hidden = true;
    setMsg('');

    const tier = tierFor(r ? r.pts : 0);
    $('r-tier').textContent = `${tier.emoji} ${tier.name} · ${tierRange(tier)} pts`;
    $('r-tier').className = 'tier ' + tier.cls;
    renderLadder(tier);
    $('r-name').textContent = r ? r.name : why;
    $('r-detail').textContent = r ? r.detail : (game.lastMiss ? `Last guess: ${game.lastMiss}` : '');
    $('r-points').textContent = r ? `+${r.pts}` : '0';
    const img = $('r-img');
    if (r && r.img) { img.src = r.img; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
    $('r-common').innerHTML = r && r.common && r.common.length
      ? `Most common answers: ${r.common.map(c => `<b>${esc(c)}</b>`).join(', ')}` : '';
    $('next-btn').textContent = game.i + 1 >= ROUNDS ? 'See your status' : 'Next';
    $('result').hidden = false;
    $('next-btn').focus({ preventScroll: true });
    // Keep the road in view so the drive is visible.
    const top = $('road').getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) $('road').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('next-btn').addEventListener('click', () => {
    game.i++;
    if (game.i >= ROUNDS) renderEnd();
    else renderRound();
  });

  function renderEnd() {
    const avg = game.total / ROUNDS;
    const st = STATUS.find(e => avg >= e.min);
    const up = STATUS[STATUS.indexOf(st) - 1];
    const genreLabel = CHOICES.find(c => c.id === genre).label;
    $('final-era').textContent = `${st.emoji} ${st.name}`;
    $('final-blurb').textContent = st.blurb + (up ? ` (${up.name} starts at ${up.min * ROUNDS} points.)` : '');
    $('final-score').textContent = `${game.total} / ${ROUNDS * 100} points · ${genreLabel}`;
    $('final-squares').textContent = game.results.map(x => tierFor(x.r ? x.r.pts : 0).emoji).join('');
    $('final-trip').textContent = reached ? `Road trip: made it to ${reached.label} ${reached.emoji}` : 'Road trip: never left Compton';
    $('recap').innerHTML = game.results.map(({ q, r }, i) => {
      const t = tierFor(r ? r.pts : 0);
      return `<li><details data-i="${i}"><summary>` +
        `<span class="rv-q">${esc(q.text)}</span>` +
        `<span class="rv-a"><b>${r ? esc(r.name) : 'No answer'}</b> · <span class="tier ${t.cls}">${t.emoji} ${t.name}</span> · ${r ? r.pts : 0} pts</span>` +
        `</summary><div class="rv-ex"></div></details></li>`;
    }).join('');
    $('share-msg').textContent = '';
    show('screen-end');
    if (window.siteStats) window.siteStats.send('krillion', `${genreLabel}: ${game.total}`);
  }

  // Tap a question in the review to see example answers from every rarity category.
  $('recap').addEventListener('toggle', async e => {
    const det = e.target;
    if (!det.open || det.dataset.loaded) return;
    det.dataset.loaded = '1';
    const box = det.querySelector('.rv-ex');
    const { q } = game.results[+det.dataset.i];
    box.innerHTML = '<p class="rv-wait">Digging up examples…</p>';
    try {
      const all = (await q.examples()).filter(Boolean);
      box.innerHTML = TIERS.filter(t => t.min > 0).reverse().map(t => {
        const inTier = all.filter(x => tierFor(x.pts) === t).sort((a, b) => a.pts - b.pts);
        // Up to 4, spread across the range.
        const picks = inTier.length <= 4 ? inTier : [0, 1, 2, 3].map(k => inTier[Math.round(k * (inTier.length - 1) / 3)]);
        const list = picks.length
          ? picks.map(x => `<span class="rv-pick">${esc(x.name)}${x.sub ? ` <small>${esc(x.sub)}</small>` : ''} <em>${x.pts}</em></span>`).join('')
          : '<span class="rv-none">none found</span>';
        return `<div class="rv-row"><span class="tier ${t.cls}">${t.emoji} ${t.name} <small>${tierRange(t)}</small></span><div class="rv-picks">${list}</div></div>`;
      }).join('');
    } catch (err) {
      console.error(err);
      delete det.dataset.loaded;
      box.innerHTML = '<p class="rv-wait">Couldn’t load examples. Close and tap again to retry.</p>';
    }
  }, true);

  $('share-btn').addEventListener('click', async () => {
    const text = `🦐 Lana Del Krillion (${CHOICES.find(c => c.id === genre).label})\n` +
      `${game.total}/${ROUNDS * 100} · ${$('final-era').textContent} status\n` +
      `${$('final-trip').textContent}\n` +
      `${$('final-squares').textContent}\n${location.origin}${location.pathname}`;
    try {
      await navigator.clipboard.writeText(text);
      $('share-msg').textContent = 'Copied!';
    } catch (e) {
      $('share-msg').textContent = text;
    }
  });

  $('again-btn').addEventListener('click', () => { show('screen-start'); renderStart(); });

  // The rarity ladder under the road: every category with its point range; the last answer's is lit.
  function renderLadder(active) {
    $('ladder').innerHTML = TIERS.slice().reverse().map(t =>
      `<li class="${t.cls}${t === active ? ' on' : ''}">${t.emoji} ${t.name} <span>${tierRange(t)}</span></li>`).join('');
  }

  // Local testing only: lets each question type be run straight from the console.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.krillionDebug = { TYPES, Miss, drive, resetRoad, buildGame };

  buildScene();
  renderStart();
})();
