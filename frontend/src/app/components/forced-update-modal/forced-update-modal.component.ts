import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

/**
 * A modal overlay that blocks all interaction until the user navigates
 * to the app store for an update.
 *
 * Place `<app-forced-update-modal .../>` at the top of your root component
 * template and bind `*ngIf="versionCheck.isDeprecated()"`.
 */
@Component({
  selector: 'app-forced-update-modal',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-[11000] flex items-center justify-center
             bg-black/50 backdrop-blur-sm"
    >
      <div
        class="bg-slate-800 p-8 rounded-2xl max-w-md mx-4
               shadow-xl shadow-black/40"
      >
        <h2 class="text-xl font-bold text-white mb-4">
          {{ 'forcedUpdateModal.title' | t }}
        </h2>
        <p class="text-slate-300 text-sm mb-6">
          {{ 'forcedUpdateModal.message' | t }}
        </p>
        <a
          [href]="storeUrl"
          target="_blank"
          class="inline-flex items-center justify-center px-6 py-3
                 font-bold text-white bg-purple-600 rounded-full
                 hover:bg-purple-500 transition-colors"
          rel="noopener"
        >
          {{ 'forcedUpdateModal.updateButton' | t }}
        </a>
      </div>
    </div>
  `
})
export class ForcedUpdateModalComponent {
  @Input() storeUrl = 'https://yourapp.com/update';
}
