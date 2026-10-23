import { Component, input } from '@angular/core';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-document-viewer',
  imports: [AppCardComponent],
  template: `
    <article
      class="min-h-screen bg-surface-50 px-4 py-4 text-text-secondary sm:px-6 sm:py-6 lg:px-8 lg:py-8"
      [attr.aria-label]="title()"
    >
      <div class="mx-auto min-w-0 w-full max-w-4xl">
        <app-card
          padding="none"
          variant="elevated"
          customClass="min-w-0 p-4 sm:p-6 lg:p-8"
        >
          <h1
            class="mb-6 break-words text-2xl font-bold text-text-primary sm:text-3xl"
          >
            {{ title() }}
          </h1>
          <div
            class="min-w-0 max-w-none break-words text-text-secondary [overflow-wrap:anywhere]"
          >
            <ng-content></ng-content>
          </div>
        </app-card>
      </div>
    </article>
  `,
})
export class DocumentViewerComponent {
  readonly title = input.required<string>();
}
