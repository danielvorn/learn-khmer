/* Service worker for Learn Khmer.
 *
 * Strategy
 *   shell        precached on install, so the app opens offline after one online visit
 *   audio / json cache-first, filled in as used, plus a background warm-up of the audio
 *   fonts        cache-first (Google Fonts is a third party, so responses are opaque)
 *   Listen API   never cached — it is random remote speech data and must stay live
 *
 * Bump VERSION to invalidate everything.
 */
const VERSION = 'lk-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// Relative so this works under a GitHub Pages sub-path as well as a domain root.
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// Audio is the actual content of a language app, so it is worth having offline. It is
// warmed in the background rather than precached: ~2.8MB blocking install would mean a
// flaky connection leaves you with no service worker at all.
const AUDIO_FILES = [
  ...Array.from({ length: 33 }, (_, i) => `./audio/consonants/c-${String(i + 1).padStart(2, '0')}.mp3`),
  ...Array.from({ length: 10 }, (_, i) => `./audio/digraphs/d-${String(i + 1).padStart(2, '0')}.mp3`),
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NEVER_CACHE = ['datasets-server.huggingface.co'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // individually, so one failure cannot fail the whole install
    await Promise.allSettled(SHELL_FILES.map(f => cache.add(new Request(f, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
    warmAudio();               // deliberately not awaited
  })());
});

async function warmAudio() {
  const cache = await caches.open(RUNTIME);
  for (const file of AUDIO_FILES) {
    try {
      if (await cache.match(file)) continue;
      const res = await fetch(file);
      if (res && res.ok) await cache.put(file, res.clone());
    } catch (e) { /* offline or missing: try again next activation */ }
  }
}

self.addEventListener('message', event => {
  if (event.data === 'warm-audio') warmAudio();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (NEVER_CACHE.some(h => url.hostname.endsWith(h))) return;   // straight to network

  // Media: Safari asks for byte ranges, and handing it a whole cached body breaks
  // playback, so a range request is served as a real 206 slice out of the cache.
  if (req.headers.has('range')) {
    event.respondWith(rangeFromCache(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  if (FONT_HOSTS.includes(url.hostname) || url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // opaque cross-origin font responses have status 0 but are still usable
    if (res && (res.ok || res.type === 'opaque')) {
      const cache = await caches.open(RUNTIME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

// Fresh HTML when online so updates land, cached shell when not.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(SHELL);
      cache.put('./index.html', res.clone());
    }
    return res;
  } catch (e) {
    return (await caches.match('./index.html', { ignoreVary: true }))
        || (await caches.match('./', { ignoreVary: true }))
        || new Response('Offline', { status: 503 });
  }
}

async function rangeFromCache(req) {
  const stripped = new Request(req.url, { headers: stripRange(req.headers) });
  let res = await caches.match(stripped, { ignoreVary: true });
  if (!res) {
    try {
      const net = await fetch(stripped);
      if (net && net.ok) {
        const cache = await caches.open(RUNTIME);
        await cache.put(stripped, net.clone());
        res = net;
      }
    } catch (e) { /* fall through */ }
  }
  if (!res) {
    try { return await fetch(req); } catch (e) { return new Response('', { status: 504 }); }
  }

  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return new Response(buf, { status: 200, headers: res.headers });
  const start = m[1] ? parseInt(m[1], 10) : 0;
  const end = m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
  if (start >= buf.byteLength) {
    return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${buf.byteLength}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

function stripRange(headers) {
  const out = new Headers();
  headers.forEach((v, k) => { if (k.toLowerCase() !== 'range') out.append(k, v); });
  return out;
}
