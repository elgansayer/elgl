import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(process.cwd(), 'src/app');
const legacyAliases = [
  'settings/notification-customization',
  'notification-preferences',
  'account/deletion',
  'message-filters',
  'my-subscription',
  'language-parties',
  'language-islands',
  'chat-settings',
  'device-transfer',
  'groups/create',
  'data-storage',
  'help-about',
  'communities',
  'visitors',
  'language',
  'blocks',
  'version',
  'gdpr',
  'help',
  'vip',
] as const;
const routeDelimiters = ["'", '"', String.fromCharCode(96)] as const;
const routeSuffixes = ['/', '?', "'", '"', String.fromCharCode(96), '$', undefined] as const;

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionSources(path);
    }
    if (!['.html', '.ts'].includes(extname(entry.name))) {
      return [];
    }
    if (
      entry.name.endsWith('.spec.ts') ||
      entry.name.endsWith('.generated.ts') ||
      entry.name.endsWith('.routes.ts')
    ) {
      return [];
    }
    return [path];
  });
}

describe('canonical internal navigation contract', () => {
  it('keeps compatibility aliases in route definitions, not production navigation', () => {
    const violations: string[] = [];

    for (const file of productionSources(appRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const alias of legacyAliases) {
        for (const delimiter of routeDelimiters) {
          const prefix = `${delimiter}/${alias}`;
          let index = source.indexOf(prefix);
          while (index >= 0) {
            const suffix = source[index + prefix.length];
            if (routeSuffixes.includes(suffix)) {
              const line = source.slice(0, index).split('\n').length;
              violations.push(`${relative(appRoot, file)}:${line} uses /${alias}`);
            }
            index = source.indexOf(prefix, index + prefix.length);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
