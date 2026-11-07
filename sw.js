/* 스스로 — 오프라인용 서비스워커 (http/https로 열었을 때만 동작)
   파일을 고치면 VERSION을 올려야 폰에 새 버전이 반영된다. */
const VERSION = 'ssro-v7';
const FILES = [
  './', './index.html', './css/app.css', './js/core.js', './js/extract.js', './js/gen.js', './js/app.js',
  './lib/pdf.min.js', './lib/pdf.worker.min.js', './lib/jszip.min.js', './manifest.webmanifest',
  './icons/icon-64.png', './icons/icon-192.png', './icons/logo.png', './icons/apple-touch-icon.png', './icons/icon-512.png', './icons/icon-512-maskable.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
