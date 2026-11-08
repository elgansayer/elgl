import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface AssetGroupConfig {
  name: string;
  installMode?: 'prefetch' | 'lazy';
  updateMode?: 'prefetch' | 'lazy';
  resources: {
    files?: string[];
    urls?: string[];
  };
}

interface DataGroupConfig {
  name: string;
  urls: string[];
  cacheConfig: {
    maxSize: number;
    maxAge: string;
    timeout?: string;
    strategy?: 'freshness' | 'performance';
  };
}

interface ServiceWorkerConfig {
  index: string;
  assetGroups?: AssetGroupConfig[];
  dataGroups?: DataGroupConfig[];
  navigationUrls?: string[];
  navigationRequestStrategy?: 'freshness' | 'performance';
}

function resolveFrontendPath(relativePath: string): string {
  const candidates = [
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), 'frontend', relativePath),
  ];
  const matched = candidates.find((candidate) => existsSync(candidate));
  if (!matched) {
    throw new Error(`Unable to locate ${relativePath}`);
  }
  return matched;
}

describe('Service Worker asset caching contract', () => {
  const ngswPath = resolveFrontendPath('ngsw-config.json');
  const ngswContent = readFileSync(ngswPath, 'utf8');
  const ngswConfig = JSON.parse(ngswContent) as ServiceWorkerConfig;

  it('configures prefetch asset caching for core application shell', () => {
    const appGroup = ngswConfig.assetGroups?.find((group) => group.name === 'app');
    expect(appGroup).toBeDefined();
    expect(appGroup?.installMode).toBe('prefetch');
    expect(appGroup?.updateMode).toBe('prefetch');

    const files = appGroup?.resources.files ?? [];
    expect(files).toContain('/index.html');
    expect(files).toContain('/manifest.webmanifest');
    expect(files).toContain('/*.css');
    expect(files).toContain('/*.js');
  });

  it('configures lazy asset caching for static images, icons, and fonts', () => {
    const assetsGroup = ngswConfig.assetGroups?.find((group) => group.name === 'assets');
    expect(assetsGroup).toBeDefined();
    expect(assetsGroup?.installMode).toBe('lazy');
    expect(assetsGroup?.updateMode).toBe('prefetch');

    const files = assetsGroup?.resources.files ?? [];
    expect(files).toContain('/assets/**');
    expect(files).toContain(
      '/*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2)',
    );
  });

  it('configures lazy caching for Cloudflare R2 media hosting without remote fonts', () => {
    const mediaGroup = ngswConfig.assetGroups?.find((group) => group.name === 'media');
    expect(mediaGroup).toBeDefined();
    expect(mediaGroup?.installMode).toBe('lazy');
    expect(mediaGroup?.updateMode).toBe('lazy');

    const urls = mediaGroup?.resources.urls ?? [];
    expect(urls).toContain('https://**.cloudflare.com/**');
    expect(urls).toContain('https://**.r2.cloudflarestorage.com/**');

    expect(ngswContent).not.toContain('fonts.googleapis.com');
    expect(ngswContent).not.toContain('fonts.gstatic.com');
  });

  it('conforms to the Angular service worker schema without invalid properties', () => {
    const schemaPath = resolveFrontendPath(
      'node_modules/@angular/service-worker/config/schema.json',
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
      properties?: {
        assetGroups?: { items?: { properties?: Record<string, unknown> } };
        dataGroups?: { items?: { properties?: Record<string, unknown> } };
      };
    };

    const allowedAssetProps = new Set(
      Object.keys(schema.properties?.assetGroups?.items?.properties ?? {}),
    );
    for (const group of ngswConfig.assetGroups ?? []) {
      for (const prop of Object.keys(group)) {
        expect(allowedAssetProps.has(prop)).toBe(true);
      }
    }
  });

  it('includes required PWA meta tags, apple-touch-icon, and noscript in index.html', () => {
    const indexPath = resolveFrontendPath('src/index.html');
    const indexHtml = readFileSync(indexPath, 'utf8');

    expect(indexHtml).toContain('<link rel="manifest" href="manifest.webmanifest" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#121212" />');
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" href="assets/icons/icon-192x192.png" />',
    );
    expect(indexHtml).toContain('<noscript>');
    expect(indexHtml).toContain('JavaScript is required to run this application.');
  });

  it('enables the service worker in angular.json and registers SwUpdateService in app.config.ts', () => {
    const angularPath = resolveFrontendPath('angular.json');
    const angularJson = JSON.parse(readFileSync(angularPath, 'utf8')) as {
      projects?: {
        frontend?: {
          architect?: {
            build?: {
              options?: {
                serviceWorker?: string;
              };
            };
          };
        };
      };
    };

    const swOption =
      angularJson.projects?.frontend?.architect?.build?.options?.serviceWorker;
    expect(swOption).toBe('ngsw-config.json');

    const appConfigPath = resolveFrontendPath('src/app/app.config.ts');
    const appConfigContent = readFileSync(appConfigPath, 'utf8');

    expect(appConfigContent).toContain("provideServiceWorker('ngsw-worker.js'");
    expect(appConfigContent).toContain('initialiseServiceWorkerUpdates');
  });
});
