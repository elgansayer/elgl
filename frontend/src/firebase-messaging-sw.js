importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const params = new URL(location).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey') || 'YOUR_API_KEY',
  authDomain: params.get('authDomain') || 'YOUR_AUTH_DOMAIN',
  projectId: params.get('projectId') || 'YOUR_PROJECT_ID',
  storageBucket: params.get('storageBucket') || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: params.get('messagingSenderId') || 'YOUR_MESSAGING_SENDER_ID',
  appId: params.get('appId') || 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.warn('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Background message';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
