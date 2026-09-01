import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const economyService = readFileSync(
  resolve(process.cwd(), 'src/economy/economy.service.ts'),
  'utf8',
);

describe('economy reward RNG contract', () => {
  it('uses the exclusive-upper-bound crypto API for rewards 5 through 10', () => {
    expect(economyService).toMatch(/const reward = crypto\.randomInt\(5, 11\);/);
    expect(economyService).not.toMatch(/Math\.random\(\)/);
  });
});
