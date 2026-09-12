import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Voiceroom preview public API contract', () => {
  const source = readFileSync(
    resolve(__dirname, 'voiceroom-preview.component.ts'),
    'utf8',
  );

  it('loads share metadata through the unauthenticated preview endpoint', () => {
    expect(source).toContain(
      '${environment.apiUrl}/audio-rooms/preview/${roomId}',
    );
    expect(source).not.toContain(
      '${environment.apiUrl}/audio-rooms/${roomId}',
    );
  });
});
