import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

interface BrowserViewTransition {
  readonly finished: Promise<void>;
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  readonly types?: unknown;
  skipTransition(): void;
}

interface ViewTransitionDocument {
  startViewTransition(
    updateCallback: () => void | Promise<void>,
  ): BrowserViewTransition;
}

export interface ViewTransitionRunOptions {
  /**
   * Skip visual snapshots for sensitive/private content or when motion would
   * not improve spatial continuity.
   */
  disabled?: boolean;
  /** Abort an older transition before starting this update. */
  replaceActive?: boolean;
}

/**
 * Progressive wrapper around the browser View Transition API.
 *
 * Correct navigation/state updates never depend on animation support. The
 * callback runs immediately on the server, in unsupported browsers, for
 * reduced-motion users and for explicitly disabled/private flows.
 */
@Injectable({ providedIn: 'root' })
export class ViewTransitionService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private activeTransition: BrowserViewTransition | null = null;

  isSupported(): boolean {
    return (
      isPlatformBrowser(this.platformId) &&
      typeof (this.document as Partial<ViewTransitionDocument>)
        .startViewTransition === 'function'
    );
  }

  prefersReducedMotion(): boolean {
    const view = this.document.defaultView;
    return (
      !view ||
      typeof view.matchMedia !== 'function' ||
      view.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  async run(
    update: () => void | Promise<void>,
    options: ViewTransitionRunOptions = {},
  ): Promise<void> {
    if (
      options.disabled === true ||
      !this.isSupported() ||
      this.prefersReducedMotion()
    ) {
      await update();
      return;
    }

    if (options.replaceActive !== false) {
      this.activeTransition?.skipTransition();
    }

    const transition = (
      this.document as ViewTransitionDocument
    ).startViewTransition(update);
    this.activeTransition = transition;

    try {
      await transition.updateCallbackDone;
      await transition.finished;
    } finally {
      if (this.activeTransition === transition) {
        this.activeTransition = null;
      }
    }
  }

  skipActive(): void {
    this.activeTransition?.skipTransition();
    this.activeTransition = null;
  }
}
