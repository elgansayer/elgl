import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { LessonsService } from '../../services/lessons.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { lessonSections } from './lesson-content';
import type { LessonProgress } from './lessons.model';

@Component({
  selector: 'app-lesson-detail',
  imports: [RouterLink, HlmButton, TranslatePipe],
  template: `
    <main class="ps-4 pe-4 py-6" aria-labelledby="lesson-heading">
      <a
        class="inline-flex min-h-11 items-center rounded-lg px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        routerLink="/lessons"
      >
        {{ 'common.back' | t }}
      </a>

      @if (lessonResource.isLoading()) {
        <p class="mt-4 text-on-surface-secondary" aria-live="polite">
          {{ 'common.loading' | t }}
        </p>
      } @else if (lessonResource.error()) {
        <div class="mt-4" role="alert" [attr.data-auth-required]="isUnauthorized()">
          <p class="text-on-surface-secondary">{{ 'common.error' | t }}</p>
          <button
            hlmBtn
            class="mt-3 min-h-11 rounded-lg bg-surface-elevated px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            (click)="lessonResource.reload()"
          >
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (lessonResource.value(); as lesson) {
        <article class="mt-4">
          @if (lesson.cover_image_url) {
            <img
              class="mb-4 max-h-72 w-full rounded-xl object-cover"
              [src]="lesson.cover_image_url"
              [alt]="lesson.title"
            />
          }

          <header>
            <div class="flex flex-wrap items-center gap-2 text-xs text-on-surface-secondary">
              <span>{{ lesson.language_code }}</span>
              @if (lesson.difficulty_level !== null && lesson.difficulty_level !== undefined) {
                <span>{{ lesson.difficulty_level }}</span>
              }
              @if (progress()?.completed) {
                <span class="text-success">{{ 'lessons.completed' | t }}</span>
              }
            </div>
            <h1 id="lesson-heading" class="mt-2 text-2xl font-bold">{{ lesson.title }}</h1>
            @if (lesson.description) {
              <p class="mt-2 text-on-surface-secondary">{{ lesson.description }}</p>
            }
          </header>

          @if (lesson.audio_url) {
            <audio class="mt-4 w-full" controls [src]="lesson.audio_url"></audio>
          }

          <div class="mt-5" aria-live="polite">
            <div
              class="h-2 overflow-hidden rounded-full bg-surface"
              role="progressbar"
              [attr.aria-valuenow]="progress()?.progress_percent ?? 0"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full bg-accent"
                [style.width.%]="progress()?.progress_percent ?? 0"
              ></div>
            </div>
            <span class="mt-1 block text-xs text-on-surface-secondary">
              {{ progress()?.progress_percent ?? 0 }}%
            </span>
          </div>

          @if (sections().length > 0) {
            @if (sections()[activeIndex()]; as section) {
              <section class="mt-6 rounded-xl bg-surface-elevated ps-4 pe-4 py-5" tabindex="-1">
                @if (section.title) {
                  <h2 class="text-lg font-semibold">{{ section.title }}</h2>
                }
                <p class="mt-3 whitespace-pre-line leading-7">{{ section.body }}</p>
              </section>
            }

            <nav class="mt-5 flex items-center justify-between gap-3">
              <button
                hlmBtn
                class="min-h-11 rounded-lg bg-surface-elevated px-4 py-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                [disabled]="activeIndex() === 0 || isSaving()"
                (click)="previous()"
              >
                {{ 'common.back' | t }}
              </button>

              @if (activeIndex() < sections().length - 1) {
                <button
                  hlmBtn
                  class="min-h-11 rounded-lg bg-accent px-4 py-2 text-accent-content disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  type="button"
                  [disabled]="isSaving()"
                  (click)="next()"
                >
                  {{ 'common.next' | t }}
                </button>
              } @else {
                <button
                  hlmBtn
                  class="min-h-11 rounded-lg bg-accent px-4 py-2 text-accent-content disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  type="button"
                  [disabled]="isSaving() || progress()?.completed"
                  (click)="complete()"
                >
                  {{ 'lessons.completed' | t }}
                </button>
              }
            </nav>

            @if (saveError()) {
              <p class="mt-3 text-on-surface-secondary" role="alert">
                {{ 'common.error' | t }}
              </p>
            }
          } @else {
            <p class="mt-6 text-on-surface-secondary">{{ 'lessons.none' | t }}</p>
          }
        </article>
      }
    </main>
  `,
})
export class LessonDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly lessonsService = inject(LessonsService);
  private readonly lessonId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly lessonResource = resource({
    loader: () => this.lessonsService.getLesson(this.lessonId),
  });
  readonly sections = computed(() =>
    lessonSections(this.lessonResource.value()?.content_json),
  );
  readonly progress = signal<LessonProgress | null>(null);
  readonly activeIndex = signal(0);
  readonly isSaving = signal(false);
  readonly saveError = signal(false);
  private readonly hydratedLessonId = signal<string | null>(null);

  readonly isUnauthorized = computed(() => {
    const error = this.lessonResource.error();
    return error instanceof HttpErrorResponse && error.status === 401;
  });

  constructor() {
    effect(() => {
      const lesson = this.lessonResource.value();
      if (!lesson || this.hydratedLessonId() === lesson.id) return;

      this.progress.set(lesson.progress);
      const maximumIndex = Math.max(0, this.sections().length - 1);
      this.activeIndex.set(Math.min(lesson.progress.last_position, maximumIndex));
      this.hydratedLessonId.set(lesson.id);
    });
  }

  previous(): void {
    this.activeIndex.update((index) => Math.max(0, index - 1));
  }

  async next(): Promise<void> {
    const nextIndex = Math.min(
      this.sections().length - 1,
      this.activeIndex() + 1,
    );
    if (nextIndex < 0 || nextIndex === this.activeIndex()) return;

    this.activeIndex.set(nextIndex);
    const denominator = Math.max(1, this.sections().length);
    const progressPercent = Math.min(
      99,
      Math.round((nextIndex / denominator) * 100),
    );
    await this.persistProgress(progressPercent, nextIndex, false);
  }

  async complete(): Promise<void> {
    await this.persistProgress(100, this.activeIndex(), true);
  }

  private async persistProgress(
    progressPercent: number,
    lastPosition: number,
    completed: boolean,
  ): Promise<void> {
    this.isSaving.set(true);
    this.saveError.set(false);
    try {
      const updated = await this.lessonsService.updateProgress(this.lessonId, {
        progressPercent,
        lastPosition,
        completed,
      });
      this.progress.set(updated);
    } catch {
      this.saveError.set(true);
    } finally {
      this.isSaving.set(false);
    }
  }
}
