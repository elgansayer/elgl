import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');

const contracts = [
  {
    path: 'e2e/tests/auth.spec.ts',
    markers: [
      "from '@playwright/test'",
      "page.route('**/api/auth/request-password-reset'",
      "page.route('**/api/auth/reset-password'",
      'page.waitForRequest(',
      'expect(resetPayload).toEqual({ email: resetEmail })',
      'nativeLangSelect.selectOption',
    ],
  },
  {
    path: 'e2e/tests/chat-messaging.spec.ts',
    markers: [
      "from '@playwright/test'",
      'installChatApi(page)',
      "page.route('**/api/chat/messages'",
      '[data-testid="chat-message-input"]',
      'page.waitForRequest(',
      'expect(messagePayload).toMatchObject',
    ],
  },
  {
    path: 'e2e/tests/moment-creation.spec.ts',
    markers: [
      "from '@playwright/test'",
      "page.route('**/api/moments/feed**'",
      "page.route('**/api/nlp/grammar-check'",
      'page.waitForRequest(',
      'expect(momentPayload).toMatchObject',
      'retains a failed Moment draft',
    ],
  },
];

const forbidden = [
  'test.skip(',
  'test.fixme(',
  'test.describe.skip(',
  'test.describe.fixme(',
  'describe.skip(',
  'waitForTimeout(',
  '.isVisible().catch(',
];
const failures = [];

for (const contract of contracts) {
  const filePath = resolve(repositoryRoot, contract.path);
  let source;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (error) {
    failures.push(
      `${contract.path}: missing or unreadable (${error instanceof Error ? error.message : 'unknown error'})`,
    );
    continue;
  }

  for (const marker of contract.markers) {
    if (!source.includes(marker)) {
      failures.push(`${contract.path}: missing required flow marker ${JSON.stringify(marker)}`);
    }
  }

  for (const marker of forbidden) {
    if (source.includes(marker)) {
      failures.push(`${contract.path}: core flow must not use ${marker}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Core E2E flow contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Core E2E flow contract passed for ${contracts.length} deterministic Playwright specifications.`,
);
