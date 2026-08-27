import { CommonModule } from '@angular/common';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HlmButton } from '@spartan-ng/helm/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LessonsService } from '../../services/lessons.service';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  lessonCefr,
  lessonContent,
  lessonDurationMinutes,
  normaliseLessonSegments,
  safeLessonMediaUrl,
  type Lesson,
} from './lessons.model';

@Component({
  selector: 'app-lessons',
  standalone: true,
  imports: [CommonModule, RouterLink, HlmButton, TranslatePipe],
  template: `
    <main class="min-h-screen bg-surface-300 px-4 py-6 text-primary sm:px-6 lg:px-8" aria-labelledby="lessons-title">
      <div class="mx-auto max-w-6xl">
        @if (selectedLessonId()) {
          <a
            class="mb-5 inline-flex min-h-11 items-center rounded-app px-3 text-sm font-semibold text-primary hover:bg-surface-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            routerLink="/lessons"
          >
            Back to lessons
          </a>

          @if (selectedLessonResource.isLoading()) {
            <p role="status" aria-live="polite">{{ 'common.loading' | t }}</p>
          } @else if (selectedLessonResource.error()) {
            <section class="rounded-card border-2 border-surface-100 bg-surface-200 p-4">
              <h1 id="lessons-title" class="text-xl font-bold">Lesson unavailable</h1>
              <p class="mt-2 text-secondary">{{ 'common.error_generic' | t }}</p>
              <button hlmBtn size="touch" type="button" class="mt-4" (click)="retrySelectedLesson()">
                Retry
              </button>
            </section>
          } @else if (selectedLesson(); as lesson) {
            <article aria-labelledby="lessons-title">
              <header class="mb-6">
                <p class="text-sm font-semibold text-secondary">
                  @if (lessonCefrLabel(lesson); as level) {
                    <span>{{ level }}</span>
                  }
                  @if (durationMinutes(lesson); as duration) {
                    <span class="ms-2">{{ duration }} min</span>
                  }
                </p>
                <h1 id="lessons-title" class="mt-1 break-words text-3xl font-bold">{{ lesson.title }}</h1>
                @if (lesson.description) {
                  <p class="mt-2 max-w-3xl break-words text-secondary">{{ lesson.description }}</p>
                }
              </header>

              <section class="overflow-hidden rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card">
                <div
                  class="mb-5 flex gap-1"
                  role="progressbar"
                  aria-label="Lesson progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="progressPercent()"
                  [attr.aria-valuetext]="progressLabel()"
                >
                  @for (segment of segments(); track $index) {
                    <span
                      class="h-2 min-w-0 flex-1 rounded-pill"
                      [class.bg-primary]="$index <= segmentIndex()"
                      [class.bg-surface-100]="$index > segmentIndex()"
                      aria-hidden="true"
                    ></span>
                  }
                </div>

                @if (currentSegment(); as segment) {
                  <section class="min-h-48" aria-live="polite">
                    @if (segment.title) {
                      <h2 class="break-words text-xl font-bold">{{ segment.title }}</h2>
                    }
                    <p class="mt-3 whitespace-pre-wrap break-words text-base leading-7">{{ segment.text }}</p>

                    @if (safeUrl(segment.stream_url); as streamUrl) {
                      <a
                        class="mt-4 inline-flex min-h-11 items-center rounded-app px-3 font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        [href]="streamUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open lesson stream
                      </a>
                    }
                  </section>
                } @else {
                  <p class="text-secondary">This lesson does not have readable content yet.</p>
                }

                @if (safeUrl(lesson.audio_url); as audioUrl) {
                  <audio class="mt-5 w-full" controls preload="none" [src]="audioUrl">
                    Your browser does not support lesson audio.
                  </audio>
                }

                @if (progressLoadFailed() || progressSaveError()) {
                  <p class="mt-4 text-sm text-danger" role="alert">
                    {{ 'common.error_generic' | t }}
                  </p>
                }

                <div
                  class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between"
                  [attr.aria-busy]="isSavingProgress()"
                >
                  <button
                    hlmBtn
                    size="touch"
                    variant="outline"
                    type="button"
                    [disabled]="segmentIndex() === 0 || segments().length === 0 || isSavingProgress()"
                    (click)="previousSegment()"
                  >
                    Previous
                  </button>
                  <button
                    hlmBtn
                    size="touch"
                    type="button"
                    [disabled]="segmentIndex() >= segments().length - 1 || segments().length === 0 || isSavingProgress()"
                    (click)="nextSegment()"
                  >
                    Next
                  </button>
                </div>
              </section>
            </article>
          }
        } @else {
          <header class="mb-8">
            <h1 id="lessons-title" class="text-3xl font-bold">Lessons</h1>
            <p class="mt-2 max-w-2xl text-secondary">Curated lessons for focused language practice.</p>
          </header>

          @if (lessonsResource.isLoading()) {
            <p role="status" aria-live="polite">{{ 'common.loading' | t }}</p>
          } @else if (lessonsResource.error()) {
            <section class="rounded-card border-2 border-surface-100 bg-surface-200 p-4">
              <h2 class="text-xl font-bold">Unable to load lessons</h2>
              <p class="mt-2 text-secondary">{{ 'common.error_generic' | t }}</p>
              <button hlmBtn size="touch" type="button" class="mt-4" (click)="retryLessons()">Retry</button>
            </section>
          } @else if (lessons().length === 0) {
            <section class="rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card">
              <h2 class="text-xl font-bold">No lessons available</h2>
              <p class="mt-2 text-secondary">New lessons will appear here when they are published.</p>
            </section>
          } @else {
            <section aria-labelledby="featured-lessons-title">
              <h2 id="featured-lessons-title" class="mb-4 text-xl font-bold">Featured</h2>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                @for (lesson of featuredLessons(); track lesson.id) {
                  <ng-container *ngTemplateOutlet="lessonCard; context: { $implicit: lesson }" />
                }
              </div>
            </section>

            @if (levelLessons().length > 0) {
              <section class="mt-10" aria-labelledby="level-lessons-title">
                <h2 id="level-lessons-title" class="mb-4 text-xl font-bold">For your level</h2>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  @for (lesson of levelLessons(); track lesson.id) {
                    <ng-container *ngTemplateOutlet="lessonCard; context: { $implicit: lesson }" />
                  }
                </div>
              </section>
            }
          }
        }
      </div>
    </main>

    <ng-template #lessonCard let-lesson>
      <a
        class="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        routerLink="/lessons"
        [queryParams]="{ lesson: lesson.id }"
        [attr.aria-label]="'Open lesson: ' + lesson.title"
      >
        <div class="h-full overflow-hidden rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card transition-shadow hover:shadow-lift">
          @if (safeUrl(lesson.cover_image_url); as coverUrl) {
            <img
              class="mb-4 aspect-video w-full rounded-app object-cover"
              [src]="coverUrl"
              [alt]="lesson.title"
              loading="lazy"
            />
          }
          <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-secondary">
            @if (lessonCefrLabel(lesson); as level) {
              <span class="rounded-pill bg-surface-100 px-2 py-1">{{ level }}</span>
            }
            @if (durationMinutes(lesson); as duration) {
              <span>{{ duration }} min</span>
            }
          </div>
          <h3 class="mt-3 break-words text-lg font-bold">{{ lesson.title }}</h3>
          @if (lesson.description) {
            <p class="mt-2 line-clamp-3 break-words text-sm text-secondary">{{ lesson.description }}</p>
          }
        </div>
      </a>
    </ng-template>
  `,
})
export class LessonsComponent {
  private readonly lessonsService = inject(LessonsService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly selectedLessonId = computed(() => this.queryParamMap().get('lesson'));
  readonly progressSaveError = signal(false);
  readonly isSavingProgress = signal(false);

  readonly lessonsResource = resource({
    loader: () => firstValueFrom(this.lessonsService.getLessons()),
  });

  readonly selectedLessonResource = resource({
    params: () => this.selectedLessonId() ?? undefined,
    loader: ({ params }) => firstValueFrom(this.lessonsService.getLesson(params)),
  });

  readonly selectedProgressResource = resource({
    params: () => this.selectedLessonId() ?? undefined,
    loader: ({ params }) => firstValueFrom(this.lessonsService.getLessonProgress(params)),
  });

  readonly lessons = computed(() => this.lessonsResource.value() ?? []);
  readonly selectedLesson = computed(() => this.selectedLessonResource.value() ?? null);
  readonly segments = computed(() => {
    const lesson = this.selectedLesson();
    return lesson ? normaliseLessonSegments(lesson) : [];
  });

  readonly segmentIndex = linkedSignal({
    source: () => ({
      lessonId: this.selectedLessonId(),
      segmentCount: this.segments().length,
      savedIndex: this.selectedProgressResource.value()?.segment_index,
    }),
    computation: ({ segmentCount, savedIndex }) => {
      if (segmentCount === 0 || typeof savedIndex !== 'number' || !Number.isInteger(savedIndex)) {
        return 0;
      }
      return Math.max(0, Math.min(savedIndex, segmentCount - 1));
    },
  });

  readonly singleSegmentCompletionResource = resource({
    params: () => {
      const lessonId = this.selectedLessonId();
      const progress = this.selectedProgressResource.value();
      return lessonId && this.segments().length === 1 && progress && !progress.completed
        ? lessonId
        : undefined;
    },
    loader: ({ params }) =>
      firstValueFrom(
        this.lessonsService.saveLessonProgress(params, {
          segment_index: 0,
          completed: true,
        }),
      ),
  });

  readonly currentSegment = computed(() => {
    const segments = this.segments();
    if (segments.length === 0) return null;
    return segments[Math.min(this.segmentIndex(), segments.length - 1)] ?? null;
  });
  readonly progressPercent = computed(() => {
    const count = this.segments().length;
    return count === 0 ? 0 : Math.round(((Math.min(this.segmentIndex(), count - 1) + 1) / count) * 100);
  });
  readonly progressLabel = computed(() => {
    const count = this.segments().length;
    if (count === 0) return 'No lesson segments';
    return `Segment ${Math.min(this.segmentIndex(), count - 1) + 1} of ${count}`;
  });
  readonly progressLoadFailed = computed(
    () => Boolean(this.selectedProgressResource.error()) || Boolean(this.singleSegmentCompletionResource.error()),
  );

  readonly featuredLessons = computed(() => {
    const lessons = this.lessons();
    const explicit = lessons.filter((lesson) => lessonContent(lesson).featured);
    return explicit.length > 0 ? explicit : lessons.slice(0, Math.min(3, lessons.length));
  });

  readonly levelLessons = computed(() => {
    const lessons = this.lessons();
    const featuredIds = new Set(this.featuredLessons().map((lesson) => lesson.id));
    const remaining = lessons.filter((lesson) => !featuredIds.has(lesson.id));
    const difficulty = this.currentDifficulty();
    if (difficulty === null) return remaining;
    const matched = remaining.filter((lesson) => lesson.difficulty_level === difficulty);
    return matched.length > 0 ? matched : remaining;
  });

  lessonCefrLabel(lesson: Lesson): string | null {
    return lessonCefr(lesson);
  }

  durationMinutes(lesson: Lesson): number | null {
    return lessonDurationMinutes(lesson);
  }

  safeUrl(value: string | null | undefined): string | null {
    return safeLessonMediaUrl(value);
  }

  previousSegment(): void {
    void this.persistSegment(Math.max(0, this.segmentIndex() - 1));
  }

  nextSegment(): void {
    void this.persistSegment(
      Math.min(Math.max(0, this.segments().length - 1), this.segmentIndex() + 1),
    );
  }

  retryLessons(): void {
    this.lessonsResource.reload();
  }

  retrySelectedLesson(): void {
    this.selectedLessonResource.reload();
    this.selectedProgressResource.reload();
  }

  private async persistSegment(nextIndex: number): Promise<void> {
    const lessonId = this.selectedLessonId();
    const segmentCount = this.segments().length;
    if (!lessonId || segmentCount === 0 || this.isSavingProgress()) return;

    const previousIndex = this.segmentIndex();
    const targetIndex = Math.max(0, Math.min(nextIndex, segmentCount - 1));
    this.segmentIndex.set(targetIndex);
    this.progressSaveError.set(false);
    this.isSavingProgress.set(true);

    try {
      await firstValueFrom(
        this.lessonsService.saveLessonProgress(lessonId, {
          segment_index: targetIndex,
          completed: targetIndex === segmentCount - 1,
        }),
      );
    } catch {
      this.segmentIndex.set(previousIndex);
      this.progressSaveError.set(true);
    } finally {
      this.isSavingProgress.set(false);
    }
  }

  private currentDifficulty(): number | null {
    const metadata = this.authService.currentUser()?.user_metadata;
    const raw = metadata?.['proficiency_level'] ?? metadata?.['proficiencyLevel'];
    if (typeof raw === 'number' && raw >= 1 && raw <= 6) return raw;
    if (typeof raw !== 'string') return null;
    const index = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(raw.toUpperCase());
    return index === -1 ? null : index + 1;
  }
}
