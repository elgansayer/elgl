import {
  Component,
  input,
  signal,
  computed,
  effect,
  afterNextRender,
  ElementRef,
  inject,
} from '@angular/core';
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
    <div class="flex flex-col lg:flex-row gap-0 min-h-screen" style="background: #121212;">
      <!-- Mobile TOC toggle -->
      <button
        class="lg:hidden fixed bottom-6 end-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300"
        style="background: #00e5ff; color: #121212;"
        [style.transform]="tocOpen() ? 'rotate(90deg)' : 'rotate(0deg)'"
        (click)="tocOpen.set(!tocOpen())"
        aria-label="Toggle table of contents"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- Mobile TOC overlay -->
      @if (tocOpen()) {
        <div
          class="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          (click)="tocOpen.set(false)"
        ></div>
      }

      <!-- Table of Contents Sidebar -->
      <aside
        class="fixed lg:sticky top-0 start-0 z-40 lg:z-auto w-72 h-full lg:h-screen overflow-y-auto shrink-0 transition-transform duration-300 border-e"
        style="background: #1a1a2e; border-color: #2a2a4a;"
        [class.translate-x-0]="tocOpen()"
        [class.-translate-x-full]="!tocOpen()"
        [class.lg:translate-x-0]="true"
      >
        <div class="p-6">
          <h2 class="text-lg font-bold mb-6" style="color: #e0e0e0;">
            {{ tocTitle() }}
          </h2>
          <nav>
            <ul class="space-y-1">
              @for (section of sections(); track section.id) {
                <li>
                  <a
                    [href]="'#' + section.id"
                    (click)="scrollToSection(section.id, $event)"
                    class="block py-2 px-3 rounded-lg text-sm transition-all duration-200 border border-transparent cursor-pointer"
                    [class.font-bold]="activeSectionId() === section.id"
                    [style.color]="activeSectionId() === section.id ? '#00e5ff' : '#b0b0c0'"
                    [style.background]="activeSectionId() === section.id ? 'rgba(0, 229, 255, 0.08)' : 'transparent'"
                    [style.borderColor]="activeSectionId() === section.id ? 'rgba(0, 229, 255, 0.25)' : 'transparent'"
                    [class.ps-6]="activeSectionId() !== section.id"
                  >
                    {{ section.heading }}
                  </a>
                </li>
              }
            </ul>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
        <div class="max-w-3xl mx-auto">
          <!-- Title -->
          <h1
            class="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight"
            style="color: #ffffff;"
          >
            {{ title() }}
          </h1>

          <!-- Last updated -->
          <p class="text-sm mb-8" style="color: #707088;">
            Last updated: {{ lastUpdated() | date: 'longDate' }}
          </p>

          <!-- Sections -->
          @for (section of sections(); track section.id) {
            <section
              [id]="section.id"
              [attr.data-section-id]="section.id"
              class="mb-10 rounded-2xl p-5 sm:p-6 transition-colors duration-200"
              style="background: #1a1a2e; border: 1px solid #2a2a4a;"
            >
              <button
                class="flex items-center justify-between w-full text-start cursor-pointer"
                (click)="toggleSection(section.id)"
                [attr.aria-expanded]="expandedSections().has(section.id)"
              >
                <h2
                  class="text-xl font-bold transition-colors"
                  style="color: #e0e0e0;"
                  [style.color]="expandedSections().has(section.id) ? '#00e5ff' : '#e0e0e0'"
                >
                  {{ section.heading }}
                </h2>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 shrink-0 transition-transform duration-300 ms-4"
                  [class.rotate-180]="!expandedSections().has(section.id)"
                  style="color: #707088;"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>

              @if (expandedSections().has(section.id)) {
                <div
                  class="mt-4 text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
                  style="color: #c0c0d0;"
                >
                  {{ section.content }}
                </div>
              }
            </section>
          }

          <!-- Footer date -->
          <div
            class="mt-10 pt-6 text-sm text-center"
            style="border-top: 1px solid #2a2a4a; color: #707088;"
          >
            Last updated: {{ lastUpdated() | date: 'longDate' }}
          </div>
        </div>
      </main>
    </div>
  `,
})
export class LegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<LegalSection[]>();

  readonly tocTitle = computed(() => this.title());

  readonly tocOpen = signal(false);
  readonly activeSectionId = signal<string>('');
  readonly expandedSections = signal<Set<string>>(new Set());

  private readonly el = inject(ElementRef);
  private observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const secs = this.sections();
      if (secs.length > 0 && this.expandedSections().size === 0) {
        this.expandedSections.set(new Set(secs.map((s) => s.id)));
      }
    });

    afterNextRender(() => {
      this.setupIntersectionObserver();
    });
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).dataset['sectionId'];
          if (id) {
            this.activeSectionId.set(id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    );

    this.sections().forEach((section) => {
      const el = this.el.nativeElement.querySelector(
        `[data-section-id="${section.id}"]`,
      );
      if (el) {
        this.observer!.observe(el);
      }
    });
  }

  scrollToSection(id: string, event: Event): void {
    event.preventDefault();
    this.tocOpen.set(false);

    const el = this.el.nativeElement.querySelector(
      `[data-section-id="${id}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleSection(id: string): void {
    this.expandedSections.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
