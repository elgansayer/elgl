import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-document-viewer',
  imports: [CommonModule, AppCardComponent],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8">
      <div class="max-w-4xl mx-auto">
        <app-card padding="lg" variant="elevated" class="bg-slate-800">
          <h1 class="text-3xl font-bold mb-6 text-white">{{ title() }}</h1>
          <div class="prose prose-invert max-w-none">
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
