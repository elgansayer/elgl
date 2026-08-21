import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-document-viewer',
  imports: [CommonModule, AppCardComponent],
  template: `
    <div
      class="min-h-screen bg-surface-50 px-4 py-4 text-text-secondary sm:px-6 sm:py-6 lg:px-8 lg:py-8"
    >
      <div class="mx-auto w-full max-w-4xl">
        <app-card
          padding="none"
          variant="elevated"
          customClass="p-4 sm:p-6 lg:p-8"
        >
          <h1 class="mb-6 text-2xl font-bold text-text-primary sm:text-3xl">{{ title() }}</h1>
          <div class="max-w-none text-text-secondary">
            <ng-content></ng-content>
          </div>
        </app-card>
      </div>
    </div>
  `,
})
export class DocumentViewerComponent {
  readonly title = input.required<string>();
}
