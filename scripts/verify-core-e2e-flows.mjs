import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');

const contracts = [
  {
    path: 'e2e/tests/auth.spec.ts',
    markers: [
      "from '@playwright/test'",
      "page.goto('/forgot-password')",
      "emailInput.fill('testuser@example.com')",
      "page.goto('/onboarding')",
      'nativeLangSelect.selectOption',
    ],
  },
  {
    path: 'e2e/tests/chat-messaging.spec.ts',
    markers: [
      "from '@playwright/test'",
      "page.goto('/chat')",
      "page.goto('/chat/room_test_001')",
      '[data-testid="chat-message-input"]',
      "messageInput.fill('Hello, this is a test message!')",
    ],
  },
  {
    path: 'e2e/tests/moment-creation.spec.ts',
    markers: [
      "from '@playwright/test'",
      "page.goto('/moments')",
      "const textarea = page.locator('textarea')",
      "textarea.fill('This is my test moment! Can anyone correct my English?')",
      'composeBtn.click()',
    ],
  },
];

const forbidden = [
  'test.skip(',
  'test.fixme(',
  'test.describe.skip(',
  'test.describe.fixme(',
  'describe.skip(',
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
      failures.push(
        `${contract.path}: missing required flow marker ${JSON.stringify(marker)}`,
      );
    }
  }

  for (const marker of forbidden) {
    if (source.includes(marker)) {
      failures.push(`${contract.path}: core flow must not be disabled with ${marker}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Core E2E flow contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Core E2E flow contract passed for ${contracts.length} Playwright specifications.`,
);
