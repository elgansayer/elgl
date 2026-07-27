import { Component, Input } from '@angular/core';

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
          {{ title }}
        </h2>
        <p class="text-slate-300 text-sm mb-6">
          {{ message }}
        </p>
        <a
          [href]="storeUrl"
          target="_blank"
          class="inline-flex items-center justify-center px-6 py-3
                 font-bold text-white bg-purple-600 rounded-full
                 hover:bg-purple-500 transition-colors"
          rel="noopener"
        >
          Update Now
        </a>
      </div>
    </div>
  `
})
export class ForcedUpdateModalComponent {
  @Input() title = 'Update Required';
  @Input() message =
    'A new version of the app is available. Please update to continue.';
  @Input() storeUrl = 'https://yourapp.com/update';
}
