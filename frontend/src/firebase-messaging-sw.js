// Firebase Messaging Service Worker
// This file handles background push notifications

self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'HelloTalk',
        body: event.data.text(),
      };
    }
  }

  const notificationTitle = data.title || 'HelloTalk';
  const notificationOptions = {
    body: data.body || '',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    data: data.data || {},
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );

  // Forward the message to the client (for foreground handling)
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage(data);
    });
  });
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);

  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Determine URL to open based on notification data
  let url = '/';
  if (data.type === 'new_message' && data.room_id) {
    url = `/chat/${data.room_id}`;
  } else if (data.type === 'call_invite' && data.room_id) {
    url = `/call/${data.room_id}`;
  } else if (data.type === 'moment_like' || data.type === 'moment_comment') {
    if (data.moment_id) {
      url = `/moments/${data.moment_id}`;
    } else {
      url = '/moments';
    }
  } else if (data.type === 'gift') {
    url = '/gifts';
  } else if (data.type === 'friend_request') {
    url = '/profile/friends';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
