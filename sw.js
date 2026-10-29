const CACHE = "finenglish-84-v8";
const PHRASE_AUDIO = [
  "work-as-a-data-analyst", "be-responsible-for", "analyze-financial-data", "prepare-reports",
  "identify-trends", "support-decision-making", "improve-efficiency", "meet-a-deadline"
].map(name => `./${name}.mp3`);
const ASSETS = ["./", "./index.html", "./styles.css?v=7", "./plan-data.js?v=7", "./app.js?v=7", "./manifest.webmanifest", "./icon.svg", "./week1-listening.mp3", ...PHRASE_AUDIO];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
