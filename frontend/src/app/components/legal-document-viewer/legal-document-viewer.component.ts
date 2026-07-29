import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LegalSection {
  id: string;
  heading: string;
  content: string;
}

@Component({
  selector: 'app-legal-document-viewer',
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
      <h1 class="text-3xl font-extrabold mb-6 text-slate-900 dark:text-white">
        {{ title() }}
      </h1>

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
        Last updated: {{ lastUpdated() | date: 'longDate' }}
      </div>
    </div>
  `,
})
export class LegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<LegalSection[]>();
}
