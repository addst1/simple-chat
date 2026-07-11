// 설치 가능한 앱으로 만들기 위한 최소 서비스 워커 (오프라인 캐싱은 하지 않음)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// 새 메시지 푸시 알림 표시 (메시지 본문은 서버에서 보내지 않음, 알림 문구만 표시)
// 채팅창을 실제로 보고 있는 중이면(탭이 visible 상태) 알림을 띄우지 않음
self.addEventListener('push', (event) => {
  let data = { title: '간단 채팅', body: '새 메시지가 도착했습니다.' };
  try {
    if (event.data) data = event.data.json();
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const isViewing = clientList.some((c) => c.visibilityState === 'visible');
      if (isViewing) return; // 이미 채팅창을 보고 있으면 알림 생략

      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: 'icon.svg',
        badge: 'icon.svg',
      });
    })
  );
});

// 알림 클릭 시 채팅창으로 포커스 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
