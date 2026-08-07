import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

interface ParsedDeepLink {
  readonly host: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
}

function tryParseHellotalkUri(uri: string): ParsedDeepLink | null {
  if (!uri.startsWith('hellotalk://')) return null;

  const withoutScheme = uri.slice('hellotalk://'.length);
  const slashIndex = withoutScheme.indexOf('/');

  const host = slashIndex >= 0 ? withoutScheme.slice(0, slashIndex) : withoutScheme;
  const rest = slashIndex >= 0 ? withoutScheme.slice(slashIndex) : '';

  const queryIndex = rest.indexOf('?');
  const path = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
  const queryString = queryIndex >= 0 ? rest.slice(queryIndex + 1) : '';

  const params: Record<string, string> = {};
  if (queryString) {
    for (const pair of queryString.split('&')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex >= 0) {
        params[decodeURIComponent(pair.slice(0, eqIndex))] = decodeURIComponent(
          pair.slice(eqIndex + 1),
        );
      }
    }
  }

  return { host, path, params };
}

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private readonly router = inject(Router);

  handleDeepLink(uri: string): boolean {
    const parsed = tryParseHellotalkUri(uri);
    if (!parsed) return false;

    switch (parsed.host) {
      case 'profile': {
        const id = parsed.path.replace(/^\//, '');
        if (!id) return false;
        void this.router.navigate(['/profile', id]);
        return true;
      }
      default:
        return false;
    }
  }
}