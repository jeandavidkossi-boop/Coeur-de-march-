// Nom du cache (tu peux changer la version v1 en v2 quand tu fais de grosses mises à jour)
const CACHE_NAME = 'coeur-marche-bouafle-v1';

// Liste des fichiers à mettre en cache pour le mode hors-ligne
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './sw.js',
  './manifest.json',
  './IMG-20260115-WA0005.jpg', // Ton logo
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 1. Installation : On télécharge les fichiers importants
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache ouvert - Fichiers en cours de sauvegarde');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activation : On nettoie les vieux caches si nécessaire
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. Stratégie de chargement : Réseau d'abord, sinon Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
