import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ServiceWorkerConfig {
  dataGroups?: Array<{ urls?: string[] }>;
}

describe('Word of the Day cache boundary', () => {
  it('never caches the authenticated response in the service worker', () => {
    const config: ServiceWorkerConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'ngsw-config.json'), 'utf8'),
    );
    const cachedUrls =
      config.dataGroups?.flatMap((group) => group.urls ?? []) ?? [];

    expect(cachedUrls).not.toContain('/api/word-of-the-day');
  });
});
