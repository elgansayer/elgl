import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ServiceWorkerConfig {
  dataGroups?: Array<{ urls?: string[] }>;
}

describe('discovery cache privacy boundary', () => {
  it('never caches authenticated discovery responses in the service worker', () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'ngsw-config.json'), 'utf8'),
    ) as ServiceWorkerConfig;
    const cachedUrls = config.dataGroups?.flatMap((group) => group.urls ?? []) ?? [];

    expect(cachedUrls).not.toContain('/api/discovery/**');
  });
});
