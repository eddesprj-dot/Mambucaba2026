/* Mambucaba 2026 — Firebase Cloud Messaging background service worker */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAKZkbZ-6eVr-J2Rv2iCuCurHOTOb7EHtc',
  authDomain: 'mambucaba-2026.firebaseapp.com',
  projectId: 'mambucaba-2026',
  storageBucket: 'mambucaba-2026.firebasestorage.app',
  messagingSenderId: '231106595153',
  appId: '1:231106595153:web:fdbfd6ae291fb5e3ca6b70',
  measurementId: 'G-09QLJFYPTR',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Quando o FCM recebe um payload "notification", ele próprio cuida
  // da exibição em segundo plano. Mantemos o handler somente para
  // garantir a inicialização do Messaging no service worker.
  console.log('[firebase-messaging-sw] Mensagem recebida em segundo plano:', payload?.messageId || 'sem-id');
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = 'https://mambucaba-2026.web.app';

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(targetUrl);
  })());
});
