// 설치 가능한 앱으로 만들기 위한 최소 서비스 워커 (오프라인 캐싱은 하지 않음)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
