import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LessonsService } from '../../services/lessons.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-lessons',
  imports: [RouterLink, TranslatePipe],
  template: `
    <main class="ps-4 pe-4 py-6" aria-labelledby="lessons-heading">
      <h1 id="lessons-heading" class="text-lg font-bold mb-4">
        {{ 'lessons.title' | t }}
      </h1>

      @if (lessonsResource.isLoading()) {
        <p class="text-on-surface-secondary" aria-live="polite">
          {{ 'common.loading' | t }}
        </p>
      } @else if (lessonsResource.error()) {
        <p class="text-on-surface-secondary" role="alert" [attr.data-auth-required]="isUnauthorized()">
          {{ 'common.error' | t }}
        </p>
      } @else {
        <div class="grid gap-3">
          @for (lesson of lessonsResource.value() ?? []; track lesson.id) {
            <a
              class="block ps-4 pe-4 py-4 rounded-lg bg-surface-elevated border-s-2 border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              [routerLink]="['/lessons', lesson.id]"
              [attr.aria-describedby]="'lesson-progress-' + lesson.id"
            >
              <div class="flex items-start gap-3">
                @if (lesson.cover_image_url) {
                  <img
                    class="size-16 rounded-lg object-cover"
                    [src]="lesson.cover_image_url"
                    [alt]="lesson.title"
                    loading="lazy"
                  />
                }
                <div class="min-w-0 flex-1">
                  <h2 class="font-medium">{{ lesson.title }}</h2>
                  @if (lesson.description) {
                    <p class="mt-1 text-sm text-on-surface-secondary">
                      {{ lesson.description }}
                    </p>
                  }
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-secondary">
                    <span>{{ lesson.language_code }}</span>
                    @if (lesson.difficulty_level !== null && lesson.difficulty_level !== undefined) {
                      <span>{{ lesson.difficulty_level }}</span>
                    }
                    @if (lesson.progress.completed) {
                      <span class="ms-auto text-success">{{ 'lessons.completed' | t }}</span>
                    }
                  </div>
                  <div
                    class="mt-3 h-2 overflow-hidden rounded-full bg-surface"
                    role="progressbar"
                    [attr.aria-valuenow]="lesson.progress.progress_percent"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div
                      class="h-full rounded-full bg-accent"
                      [style.width.%]="lesson.progress.progress_percent"
                    ></div>
                  </div>
                  <span
                    class="mt-1 block text-xs text-on-surface-secondary"
                    [id]="'lesson-progress-' + lesson.id"
                  >
                    {{ lesson.progress.progress_percent }}%
                  </span>
                </div>
              </div>
            </a>
          } @empty {
            <p class="text-on-surface-secondary">{{ 'lessons.none' | t }}</p>
          }
        </div>
      }
    </main>
  `,
})
export class LessonsComponent {
  private readonly lessonsService = inject(LessonsService);

  readonly lessonsResource = resource({
    loader: () => this.lessonsService.listLessons(),
  });

  readonly isUnauthorized = computed(() => {
    const error = this.lessonsResource.error();
    return error instanceof HttpErrorResponse && error.status === 401;
  });
}
