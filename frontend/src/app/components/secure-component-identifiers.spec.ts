import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SECURE_IDENTIFIER_SOURCES = [
  { path: 'daily-login-modal/daily-login-modal.component.ts', occurrences: 1 },
  { path: 'gift-picker/gift-picker.component.ts', occurrences: 2 },
  { path: 'live-chat-overlay/live-chat-overlay.component.ts', occurrences: 1 },
  { path: 'primitives/input/input.component.ts', occurrences: 1 },
  { path: 'primitives/select/select.component.ts', occurrences: 1 },
  { path: 'primitives/textarea/textarea.component.ts', occurrences: 1 },
  { path: 'tip-host-modal/tip-host-modal.component.ts', occurrences: 3 },
  { path: 'virtual-gift-modal/virtual-gift-modal.component.ts', occurrences: 2 },
] as const;

describe('secure component identifiers', () => {
  it.each(SECURE_IDENTIFIER_SOURCES)('uses Web Crypto for $path', ({ path, occurrences }) => {
    const source = readFileSync(resolve(__dirname, path), 'utf8');
    const secureCalls = source.match(/crypto\.randomUUID\(\)/g) ?? [];

    expect(secureCalls).toHaveLength(occurrences);
    expect(source).not.toContain('Math.random().toString(36)');
  });
});
