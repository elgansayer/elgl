importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const init = async () => {
  try {
    const params = new URL(location).searchParams;
    let config;

    if (params.get('apiKey')) {
      config = {
        apiKey: params.get('apiKey'),
        authDomain: params.get('authDomain'),
        projectId: params.get('projectId'),
        storageBucket: params.get('storageBucket'),
        messagingSenderId: params.get('messagingSenderId'),
        appId: params.get('appId'),
      };
    } else {
      const response = await fetch('/__/firebase/init.json');
      if (response.ok) {
        config = await response.json();
      }
    }

    if (config && config.apiKey) {
      firebase.initializeApp(config);
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
    } else {
      console.warn('[firebase-messaging-sw.js] No Firebase config found.');
    }
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error initializing Firebase:', error);
  }
};

init();
