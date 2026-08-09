import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location, DOCUMENT } from '@angular/common';

const DEEPLINK_SCHEME = 'hellotalk';

interface ParsedDeepLink {
  readonly host: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
}

interface DeepLinkEvent extends Event {
  readonly detail?: { url: string };
}

interface CapacitorApp {
  getLaunchUrl?: () => Promise<{ url: string }>;
}

interface CapacitorGlobal {
  App?: CapacitorApp;
}

function isCustomEventWithUrl(event: Event): event is DeepLinkEvent {
  const detail = (event as DeepLinkEvent).detail;
  return typeof detail === 'object' && detail !== null && typeof detail.url === 'string';
}

function getGlobalCapacitor(): CapacitorGlobal | undefined {
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    const capacitor = (window as unknown as Record<string, unknown>)['Capacitor'];
    if (typeof capacitor === 'object' && capacitor !== null) {
      return capacitor as CapacitorGlobal;
    }
  }
  return undefined;
}

function getGlobalIntentUri(): string | undefined {
  if (typeof window !== 'undefined' && 'IntentURI' in window) {
    const val = (window as unknown as Record<string, unknown>)['IntentURI'];
    if (typeof val === 'string') {
      return val;
    }
  }
  return undefined;
}

function tryParseHellotalkUri(uri: string): ParsedDeepLink | null {
  if (!uri.startsWith(`${DEEPLINK_SCHEME}://`)) return null;

  const withoutScheme = uri.slice(`${DEEPLINK_SCHEME}://`.length);
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
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private listenerAdded = false;

  /**
   * Register a listener for runtime deep link events.
   * Handles links arriving while the app is already running
   * (e.g., from Capacitor/Cordova appUrlOpen or deepLink events).
   */
  registerRuntimeListener(): void {
    if (this.listenerAdded || typeof window === 'undefined') {
      return;
    }
    this.listenerAdded = true;

    // Capacitor/Cordova bridge events
    window.addEventListener('appUrlOpen', (event: Event) => {
      if (isCustomEventWithUrl(event)) {
        this.handleDeepLink(event.detail!.url);
      }
    });

    document.addEventListener('deepLink', (event: Event) => {
      if (isCustomEventWithUrl(event)) {
        this.handleDeepLink(event.detail!.url);
      }
    });

    // Capacitor launch URL
    const capacitor = getGlobalCapacitor();
    if (capacitor?.App?.getLaunchUrl) {
      void capacitor.App.getLaunchUrl().then((result: { url: string }) => {
        if (result?.url) {
          this.handleDeepLink(result.url);
        }
      });
    }
  }

  /**
   * Process the initial deep link that launched the app.
   * Called on bootstrap in main.ts.
   */
  processInitialDeepLink(): void {
    if (typeof window === 'undefined' || typeof this.document === 'undefined') {
      return;
    }

    const href = window.location.href;
    if (href.startsWith(`${DEEPLINK_SCHEME}://`)) {
      const parsed = tryParseHellotalkUri(href);
      if (parsed) {
        const internalPath = this.toInternalPath(parsed);
        if (internalPath) {
          this.location.replaceState(internalPath);
          void this.router.navigateByUrl(internalPath, { replaceUrl: true });
        }
      }
    }

    // Android WebView intent-based launch
    const intentUri = getGlobalIntentUri();
    if (intentUri?.startsWith(`${DEEPLINK_SCHEME}://`)) {
      const parsed = tryParseHellotalkUri(intentUri);
      if (parsed) {
        const internalPath = this.toInternalPath(parsed);
        if (internalPath) {
          void this.router.navigateByUrl(internalPath, { replaceUrl: true });
        }
      }
    }
  }

  /**
   * Parse a hellotalk:// URI and navigate to the corresponding internal route.
   * Returns true if the deep link was handled, false otherwise.
   */
  handleDeepLink(uri: string): boolean {
    const parsed = tryParseHellotalkUri(uri);
    if (!parsed) return false;

    const internalPath = this.toInternalPath(parsed);
    if (!internalPath) return false;

    void this.router.navigateByUrl(internalPath);
    return true;
  }

  /**
   * Convert a parsed deep link to an internal Angular route path.
   * Returns null if the host is not a recognised route.
   */
  toInternalPath(parsed: ParsedDeepLink): string | null {
    const id = parsed.path.replace(/^\/|\/$/g, '');
    const query = new URLSearchParams(parsed.params).toString();
    const querySuffix = query ? `?${query}` : '';

    switch (parsed.host) {
      case 'profile':
        if (!id) return null;
        return `/profile/${id}${querySuffix}`;
      case 'chat':
        if (!id) return null;
        return `/chat/${id}${querySuffix}`;
      case 'moments':
        return `/moments${querySuffix}`;
      case 'discovery':
        return `/discovery${querySuffix}`;
      case 'settings':
        return `/settings${querySuffix}`;
      case 'groups':
        return id ? `/groups/${id}${querySuffix}` : `/groups${querySuffix}`;
      case 'events':
        return id ? `/events/${id}${querySuffix}` : `/events${querySuffix}`;
      case 'audio-rooms':
        return id ? `/audio-rooms/${id}${querySuffix}` : `/audio-rooms${querySuffix}`;
      case 'vip':
        return `/vip${querySuffix}`;
      case 'milestones':
        return `/milestones${querySuffix}`;
      case 'study-buddy':
        return `/study-buddy${querySuffix}`;
      case 'lessons':
        return `/lessons${querySuffix}`;
      case 'vocabulary':
        return `/vocabulary${querySuffix}`;
      case 'leaderboard':
        return `/leaderboard${querySuffix}`;
      case 'favourites':
        return `/favourites${querySuffix}`;
      case 'help':
        return `/help${querySuffix}`;
      case 'home':
        return `/home${querySuffix}`;
      default:
        return null;
    }
  }
}