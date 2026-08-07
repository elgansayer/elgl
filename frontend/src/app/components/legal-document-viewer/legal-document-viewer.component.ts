import { Component, input, computed } from '@angular/core';
import { DatePipe } from '@angular/common';

export interface LegalSection {
  id: string;
  heading: string;
  content: string;
}

@Component({
  selector: 'app-legal-document-viewer',
  host: {
    class: 'block min-h-screen bg-[#121212] text-slate-200',
  },
  template: `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-extrabold mb-8 text-white">
        {{ title() }}
      </h1>

      <div class="space-y-8">
        @for (section of sections(); track section.id) {
          <section class="rounded-2xl bg-surface-100 border border-surface-200 p-5">
            <h2 class="text-lg font-bold mb-3 text-white">
              {{ section.heading }}
            </h2>
            <p class="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {{ section.content }}
            </p>
          </section>
        }
      </div>

      <footer class="mt-10 pt-6 border-t border-surface-200 text-sm text-text-secondary">
        Last updated: {{ formattedDate() }}
      </footer>
    </div>
  `,
})
export class LegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<LegalSection[]>();

  private readonly datePipe = new DatePipe('en-GB');

  readonly formattedDate = computed(() => {
    const value = this.lastUpdated();
    const date = value instanceof Date ? value : new Date(value);
    return this.datePipe.transform(date, 'longDate') ?? String(value);
  });
}
