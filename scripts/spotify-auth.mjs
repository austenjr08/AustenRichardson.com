// One-time Spotify login for the weekly listening chart. Run it on your own computer:
//
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-auth.mjs
//
// It prints a link. Open it, approve, and it prints a refresh token to save as the
// SPOTIFY_REFRESH_TOKEN secret on GitHub. The token stays on your machine and GitHub;
// nothing else sees it.
//
// In the Spotify developer dashboard, the app's Redirect URI must be exactly:
//   http://127.0.0.1:8888/callback
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first (from your app in developer.spotify.com).');
  process.exit(1);
}
const REDIRECT = 'http://127.0.0.1:8888/callback';
const state = randomBytes(12).toString('hex');

const auth = new URL('https://accounts.spotify.com/authorize');
auth.search = new URLSearchParams({
  client_id: id,
  response_type: 'code',
  redirect_uri: REDIRECT,
  scope: 'user-read-recently-played',
  state,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
    res.writeHead(400).end('Login was cancelled or didn’t match. Run the script again.');
    return;
  }
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT }),
  });
  const body = await r.json();
  if (!r.ok || !body.refresh_token) {
    res.writeHead(500).end('Spotify didn’t return a token. Check the terminal.');
    console.error('Token request failed:', body);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Done! You can close this tab and go back to the terminal.');
    console.log('\nYour refresh token (save it as the GitHub secret SPOTIFY_REFRESH_TOKEN):\n');
    console.log(body.refresh_token + '\n');
  }
  server.close();
});

server.listen(8888, '127.0.0.1', () => {
  console.log('Open this link in your browser and approve access:\n');
  console.log(auth.toString() + '\n');
});
