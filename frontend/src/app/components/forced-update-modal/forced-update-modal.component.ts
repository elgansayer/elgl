import { Component, input, OnInit, OnDestroy, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';

/**
 * A blocking modal overlay that prevents all interaction until the user
 * navigates to the app store for an update.
 *
 * The modal locks body scrolling (via `overflow: hidden`) and intercepts
 * all clicks, scroll, touch, and keyboard events. The Escape key is
 * explicitly suppressed so the user cannot dismiss the overlay.
 *
 * Place `<app-forced-update-modal .../>` at the top of your root component
 * template and bind with `@if (versionCheck.isDeprecated())`.
 */
@Component({
  selector: 'app-forced-update-modal',
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-[11000] flex items-center justify-center
             bg-black/70 backdrop-blur-sm"
      tabindex="0"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'forcedUpdateModal.title' | t"
      (touchmove)="blockEvent($event)"
      (wheel)="blockEvent($event)"
      (keydown)="blockEvent($event)"
    >
      <div
        class="bg-surface-200 p-8 rounded-3xl max-w-md mx-4
               shadow-2xl border border-surface-100 text-center space-y-5"
        tabindex="0"
        (click)="blockEvent($event)"
        (keydown)="blockEvent($event)"
      >
        <div class="text-5xl">&#x26A0;&#xFE0F;</div>
        <h2 class="text-2xl font-black text-text-primary">
          {{ 'forcedUpdateModal.title' | t }}
        </h2>
        <p class="text-sm text-text-secondary leading-relaxed">
          {{ 'forcedUpdateModal.message' | t }}
        </p>
        <a
          [href]="storeUrl()"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center justify-center px-6 py-3
                 font-bold text-white bg-primary rounded-full
                 hover:bg-primary-dark transition-colors shadow-lg"
        >
          {{ 'forcedUpdateModal.updateButton' | t }}
        </a>
      </div>
    </div>
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:scroll)': 'preventScroll($event)',
    '(window:touchmove)': 'preventScroll($event)',
    '(window:wheel)': 'preventScroll($event)',
    '(window:keydown)': 'onKeydown($event)',
  },
})
export class ForcedUpdateModalComponent implements OnInit, OnDestroy {
  /** URL to the app store listing */
  storeUrl = input('https://yourapp.com/update');

  private document = inject(DOCUMENT);

  ngOnInit(): void {
    this.document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = '';
  }

  /**
   * Prevent any background clicks from reaching elements behind the overlay.
   */
  onDocumentClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Lock scrolling while the modal is visible.
   */
  preventScroll(event: Event): void {
    event.preventDefault();
  }

  /**
   * Prevent events from bubbling up inside the modal wrapper.
   */
  blockEvent(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Intercept all keyboard events and block Escape to prevent dismissal.
   * Only allows Tab within the modal for accessibility.
   */
  onKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Escape' || keyboardEvent.key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
  }
}
