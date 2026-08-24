import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { TranslatePipe } from '../../services/translate.pipe';

const DEFAULT_UPDATE_URL = 'https://github.com/elgansayer/elgl/releases/latest';

/**
 * A non-dismissible update gate shown when the installed app version is below
 * the operator-controlled minimum supported version.
 */
@Component({
  selector: 'app-forced-update-modal',
  imports: [TranslatePipe, FocusTrapDirective],
  template: `
    <div
      class="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      (click)="$event.stopPropagation()"
      (keydown.escape)="blockEscape($event)"
    >
      <div
        appFocusTrap
        [active]="true"
        class="bg-surface-200 p-8 rounded-3xl max-w-md mx-4 shadow-2xl border border-surface-100 text-center space-y-5"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="forced-update-title"
        aria-describedby="forced-update-message"
      >
        <div class="text-5xl" aria-hidden="true">&#x26A0;&#xFE0F;</div>
        <h2 id="forced-update-title" class="text-2xl font-black text-text-primary">
          {{ 'forcedUpdateModal.title' | t }}
        </h2>
        <p id="forced-update-message" class="text-sm text-text-secondary leading-relaxed">
          {{ 'forcedUpdateModal.message' | t }}
        </p>
        <a
          [href]="storeUrl()"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center justify-center px-6 py-3 font-bold text-white bg-primary rounded-full hover:bg-primary-dark transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-200"
        >
          {{ 'forcedUpdateModal.updateButton' | t }}
        </a>
      </div>
    </div>
  `,
  host: {
    '(document:keydown.escape)': 'blockEscape($event)',
  },
})
export class ForcedUpdateModalComponent implements OnInit, OnDestroy {
  /** Validated by VersionCheckService; the default remains a safe HTTPS destination. */
  readonly storeUrl = input(DEFAULT_UPDATE_URL);

  private readonly document = inject(DOCUMENT);
  private previousBodyOverflow = '';

  ngOnInit(): void {
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  /** Escape cannot dismiss a mandatory update gate. Other keys retain native accessibility behavior. */
  blockEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
