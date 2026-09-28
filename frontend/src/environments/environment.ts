export const environment = {
  production: false,
  supabaseUrl: 'https://mock.supabase.co',
  supabaseAnonKey: 'mock-anon-key',
  // Keep the development API origin aligned with the E2E readiness probe.
  // Using `localhost` here can resolve to ::1 in Node SSR while Playwright has
  // only proved that the IPv4 listener on 127.0.0.1 is ready, producing noisy
  // `fetch failed` / ECONNREFUSED errors during webServer startup.
  apiUrl: 'http://127.0.0.1:3000/api',
  centrifugoUrl: 'ws://localhost:8000/connection/websocket',
  liveKitUrl: 'ws://localhost:7880',
  turnServerUrl: 'turn:turn.example.com:3478',
  turnUsername: 'guest',
  turnPassword: 'somepassword',
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_AUTH_DOMAIN',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_STORAGE_BUCKET',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
    vapidKey: 'YOUR_VAPID_KEY',
  },
};
