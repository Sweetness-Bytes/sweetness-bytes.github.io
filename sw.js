/* Sweetness service worker — offline support for the site. */
const VERSION = "000e432c42";
const CORE = "sweetness-core-" + VERSION;
const RUNTIME = "sweetness-runtime";
const CORE_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];
const RUNTIME_LIMIT = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CORE).then((c) => c.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sweetness-core-") && k !== CORE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimRuntime() {
  const cache = await caches.open(RUNTIME);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - RUNTIME_LIMIT; i++) await cache.delete(keys[i]);
}

/* Pages: network first so customers always see the latest menu and prices; cached copy when offline. */
async function handleNavigation(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CORE);
      cache.put("index.html", fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cache = await caches.open(CORE);
    return (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
  }
}

/* Images, icons and fonts: serve from cache, refresh in the background. */
async function handleAsset(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        cache.put(request, res.clone()).then(trimRuntime);
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(handleNavigation(req));
    return;
  }
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if ((sameOrigin && /\.(webp|png|jpg|jpeg|svg|webmanifest)$/.test(url.pathname)) || isFont) {
    event.respondWith(handleAsset(req));
  }
});
