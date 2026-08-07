import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';

export interface LegalSection {
  id: string;
  heading: string;
  content: string;
}

@Component({
  selector: 'app-legal-document-viewer',
  imports: [DatePipe, TranslatePipe],
  template: `
    <div class="max-w-4xl mx-auto p-6 rounded-2xl shadow-sm surface">
      <h1 class="text-3xl font-extrabold mb-6 text-slate-900 dark:text-white">
        {{ title() }}
      </h1>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-12" role="status">
          <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="sr-only">Loading document...</span>
        </div>
      } @else if (error()) {
        <div class="py-12 text-center text-red-500" role="alert">
          <p class="text-lg font-semibold">{{ 'legal.load_error' | t }}</p>
        </div>
      } @else {
        <div class="prose dark:prose-invert max-w-none">
          @for (section of sections(); track section.id) {
            <section class="mb-8">
              <h2 class="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">
                {{ section.heading }}
              </h2>
              <div class="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {{ section.content }}
              </div>
            </section>
          }
        </div>

        <div class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
          {{ 'legal.last_updated' | t }}: {{ lastUpdated() | date: 'longDate' }}
        </div>
      }
    </div>
  `,
})
export class LegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<LegalSection[]>();
  readonly isLoading = input(false);
  readonly error = input<unknown>(null);
}
