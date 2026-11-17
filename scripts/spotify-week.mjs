// Tallies this week's Spotify plays for the homepage chart "My most listened this week".
//
// Spotify doesn't give play counts, only your last 50 plays. So this runs every hour
// (from .github/workflows/spotify-week.yml), reads plays newer than the last run, and adds
// them to this week's counts in data/spotify-week.json. The week starts Sunday at midnight,
// New York time, and the counts reset then.
//
// The file only holds this week's per-song counts and the time of the newest play counted,
// not a log of when you listened.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN
// (get the token once with scripts/spotify-auth.mjs).
// Test without Spotify: node scripts/spotify-week.mjs --fake path/to/recently-played.json
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const OUT = new URL('../data/spotify-week.json', import.meta.url);
const TZ = 'America/New_York';

// UTC milliseconds of the most recent Sunday 00:00 in New York.
export function weekStart(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const sundayUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day - dow);
  return sundayUTC - tzOffset(sundayUTC);
}
// How far New York's clock is ahead of UTC at a moment (negative: it's behind).
function tzOffset(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}

async function accessToken() {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) throw new Error('Missing SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET or SPOTIFY_REFRESH_TOKEN');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (!r.ok) throw new Error(`Spotify token request failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

// Plays newer than `after` (ms), oldest first. Spotify returns at most 50.
async function recentPlays(after) {
  const fake = process.argv.indexOf('--fake');
  let items;
  if (fake > 0) {
    items = JSON.parse(await readFile(process.argv[fake + 1], 'utf8')).items;
  } else {
    const token = await accessToken();
    const url = new URL('https://api.spotify.com/v1/me/player/recently-played');
    url.searchParams.set('limit', '50');
    if (after) url.searchParams.set('after', String(after));
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Spotify recently-played failed: ${r.status} ${await r.text()}`);
    items = (await r.json()).items || [];
  }
  return items
    .map(it => ({ at: Date.parse(it.played_at), track: it.track }))
    .filter(p => p.track && p.at > (after || 0))
    .sort((a, b) => a.at - b.at);
}

async function load() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return null; }
}

async function main() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!process.argv.includes('--fake') && !(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REFRESH_TOKEN)) {
    console.log('Spotify secrets aren’t set up yet, so there is nothing to count. Skipping.');
    return;
  }
  const now = new Date();
  const start = weekStart(now);
  let state = await load();
  // New week (or first run): start fresh, but keep the cursor so old plays aren't recounted.
  if (!state || state.weekStart !== new Date(start).toISOString()) {
    state = { weekStart: new Date(start).toISOString(), cursor: state?.cursor || null, updated: null, tracks: {} };
  }
  const after = Math.max(state.cursor ? Date.parse(state.cursor) : 0, start - 1);
  const plays = (await recentPlays(after)).filter(p => p.at >= start);

  for (const { at, track } of plays) {
    const t = state.tracks[track.id] ||= {
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      art: (track.album.images.at(-2) || track.album.images[0] || {}).url || null, // ~300px cover
      url: track.external_urls?.spotify || null,
      plays: 0,
      last: null,
    };
    t.plays++;
    t.last = new Date(at).toISOString();
  }
  // Only touch the file when something changed, so quiet hours make no commits.
  if (plays.length) state.cursor = new Date(plays.at(-1).at).toISOString();
  if (plays.length || !state.updated) state.updated = now.toISOString();

  await mkdir(dirname(OUT.pathname), { recursive: true });
  await writeFile(OUT, JSON.stringify(state, null, 2) + '\n');
  const top = Object.values(state.tracks).sort((a, b) => b.plays - a.plays).slice(0, 5);
  console.log(`Added ${plays.length} play(s). Week of ${state.weekStart}. Top: ${top.map(t => `${t.name} (${t.plays})`).join(', ') || 'none yet'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}
