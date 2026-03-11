// Nom du cache (vous pouvez changer la version quand vous faites de grosses mises à jour)
const CACHE_NAME = 'coeur-marche-v1';

// Liste des fichiers à garder en mémoire (même sans internet)
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './IMG-20260115-WA0005.jpg' // Votre logo
];

// 1. Installation : on met les fichiers importants en cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Fichiers mis en cache !');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Utilisation : si on est hors-ligne, on utilise le cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
