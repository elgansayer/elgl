import { test, Page } from '@playwright/test';

const API = 'http://localhost:3000/api';
const MOCK_USER_ID = 'mock-user-123';
const ROOM_ID = 'admin-panel-adversarial-room';

function makeRoom() {
  return {
    id: ROOM_ID,
    title: 'Adversarial Study Group',
    subtitle: 'en -> ar',
    avatar: 'A',
    is_online: true,
    is_pinned: false,
    created_at: new Date().toISOString(),
    admin_id: MOCK_USER_ID,
  };
}

async function mockChatApi(page: Page) {
  const room = makeRoom();
  await page.route(`${API}/chat/rooms`, (route) => route.fulfill({ json: [room] }));
  await page.route(`${API}/chat/rooms/${ROOM_ID}`, (route) => route.fulfill({ json: room }));
  await page.route(`${API}/chat/messages/${ROOM_ID}*`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );
  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/safety/blocked-and-blocker-ids/${MOCK_USER_ID}`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(`${API}/groups`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 200, json: {} }));
}

test('debug admin panel', async ({ page }) => {
  const start = Date.now();
  page.on('console', (msg) => console.log(Date.now() - start, 'BROWSER:', msg.text()));
  page.on('pageerror', (err) => console.log(Date.now() - start, 'PAGEERROR:', err.message));
  page.on('request', (req) => {
    if (req.url().includes('translate-ui')) console.log(Date.now() - start, 'REQ:', req.url());
  });

  await mockChatApi(page);
  let translateUiRequested = false;
  await page.route('**/api/nlp/translate-ui', async (route) => {
    translateUiRequested = true;
    await route.fulfill({ json: { translations: {} } });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('hellotalk_locale', 'ar');
  });

  await page.goto(`/chat/${ROOM_ID}`);
  await page.waitForTimeout(5000);
  console.log('translateUiRequested', translateUiRequested);
  console.log('dir', await page.evaluate(() => document.documentElement.dir));
  console.log('lang', await page.evaluate(() => document.documentElement.lang));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('BODY:', bodyText);
});
