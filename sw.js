// Conserva l'app sul telefono per aprirla anche senza rete.
// La pagina e i file del sito: prima la rete (così gli aggiornamenti arrivano subito), se manca si usa la copia salvata.
// Librerie e caratteri da CDN: la copia salvata, aggiornata in sottofondo.
// I dati (Firestore) e il login non passano da qui: li conserva Firebase.
const CACHE = "casa-v1";
const SHELL = ["./", "index.html", "config.js", "manifest.json", "icon-32.png", "icon-180.png", "icon-192.png", "icon-512.png"];
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    // il controllo della versione chiede la pagina con ?v=…: sempre dalla rete, mai salvato
    if (u.searchParams.has("v")) return;
    e.respondWith(fromNetwork(r));
    return;
  }
  if (CDN.test(r.url)) e.respondWith(fromCache(r, e));
});
async function fromNetwork(r) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(r);
    if (res.ok) c.put(r.mode === "navigate" ? "index.html" : r, res.clone());
    return res;
  } catch (err) {
    return (await c.match(r.mode === "navigate" ? "index.html" : r, { ignoreSearch: true })) || Response.error();
  }
}
async function fromCache(r, e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(r);
  const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}
