import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { LegalSection } from '../../services/legal.service';

const ISO_CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

@Component({
  selector: 'app-legal-document-viewer',
  imports: [],
  host: {
    class: 'block min-h-screen bg-surface-500 text-text-secondary',
  },
  template: `
    <main class="mx-auto max-w-3xl px-4 py-8" aria-labelledby="legal-document-title">
      <header class="mb-8">
        <h1 id="legal-document-title" class="text-3xl font-extrabold text-text-primary">
          {{ title() }}
        </h1>
        <p class="mt-3 text-sm text-text-secondary">
          Last updated:
          @if (dateTimeValue()) {
            <time [attr.datetime]="dateTimeValue()">{{ formattedDate() }}</time>
          } @else {
            <span>{{ formattedDate() }}</span>
          }
        </p>
      </header>

      @if (sections().length > 0) {
        <nav
          class="mb-8 rounded-2xl border border-surface-200 bg-surface-100 p-5"
          aria-label="Document sections"
        >
          <p class="text-sm font-bold text-text-primary">On this page</p>
          <ol class="mt-3 space-y-2">
            @for (section of sections(); track section.id) {
              <li>
                <a
                  class="inline-flex min-h-11 items-center text-sm text-text-primary underline decoration-current underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  [attr.href]="'#' + section.id"
                >
                  {{ section.heading }}
                </a>
              </li>
            }
          </ol>
        </nav>

        <div class="space-y-8">
          @for (section of sections(); track section.id) {
            <section
              class="scroll-mt-6 rounded-2xl border border-surface-200 bg-surface-100 p-5"
              [attr.id]="section.id"
              [attr.aria-labelledby]="section.id + '-heading'"
            >
              <h2
                class="mb-3 text-lg font-bold text-text-primary"
                [attr.id]="section.id + '-heading'"
              >
                {{ section.heading }}
              </h2>
              <p class="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {{ section.content }}
              </p>
            </section>
          }
        </div>
      } @else {
        <p
          class="rounded-2xl border border-surface-200 bg-surface-100 p-5 text-sm text-text-secondary"
          role="status"
          data-testid="legal-empty"
        >
          This document is currently unavailable.
        </p>
      }
    </main>
  `,
})
export class LegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<LegalSection[]>();

  private readonly datePipe = new DatePipe('en-GB');
  private readonly parsedDate = computed(() => this.parseDate(this.lastUpdated()));

  readonly dateTimeValue = computed(() => {
    const value = this.lastUpdated();
    if (typeof value === 'string' && ISO_CALENDAR_DATE_PATTERN.test(value)) {
      return value;
    }

    const date = this.parsedDate();
    return date ? date.toISOString().slice(0, 10) : null;
  });

  readonly formattedDate = computed(() => {
    const date = this.parsedDate();
    if (!date) {
      return String(this.lastUpdated());
    }

    return this.datePipe.transform(date, 'longDate') ?? String(this.lastUpdated());
  });

  private parseDate(value: Date | string): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const match = ISO_CALENDAR_DATE_PATTERN.exec(value);
    if (!match) {
      return null;
    }

    const [, yearText, monthText, dayText] = match;
    if (!yearText || !monthText || !dayText) {
      return null;
    }

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }
}
