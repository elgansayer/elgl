import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-update-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4"
      (touchmove)="blockEvent($event)"
      (wheel)="blockEvent($event)"
    >
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-surface-100 text-center space-y-4 animate-fadeIn"
      >
        <div class="text-4xl">🔄</div>
        <h2 class="text-2xl font-black text-text-primary">
          {{ 'forcedUpdateModal.title' | t }}
        </h2>
        <p class="text-sm text-text-secondary">{{ message }}</p>
        <button
          (click)="handleUpdate()"
          class="w-full px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-lg shadow transition-all"
        >
          {{ 'forcedUpdateModal.updateButton' | t }}
        </button>
      </div>
    </div>
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:scroll)': 'preventScroll($event)',
    '(window:touchmove)': 'preventScroll($event)',
    '(window:wheel)': 'preventScroll($event)',
  },
})
export class UpdateModalComponent {
  @Input() message = 'A new version is available.';

  /**
   * Prevent any background clicks from reaching elements behind the overlay.
   */
  onDocumentClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Lock scrolling while the modal is visible.
   */
  preventScroll(event: Event) {
    event.preventDefault();
  }

  /**
   * Prevent events from bubbling up inside the modal wrapper.
   */
  blockEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Trigger a full page reload so the browser fetches the latest deployed version.
   */
  handleUpdate() {
    window.location.reload();
  }
}
