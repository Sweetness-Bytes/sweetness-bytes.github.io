/* The Sweetness website moved to /shop/ and the Manager app lives at /manager/.
   This replaces the old site-wide service worker: it clears the old caches and removes itself. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sweetness-core-") || k === "sweetness-runtime").map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
