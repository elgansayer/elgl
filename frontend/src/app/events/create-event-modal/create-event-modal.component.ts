import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

export interface AppEventParams {
  title: string;
  date_time: string;
  location?: string;
  description?: string;
}

@Component({
  selector: 'app-create-event-modal',
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" [attr.aria-label]="'events.createEvent' | t">
      <div class="max-w-md w-full rounded-2xl bg-surface-500 p-6 shadow-lift">
        <h2 class="mb-4 text-start text-lg font-semibold text-white">
          {{ 'events.createEvent' | t }}
        </h2>

        <form [formGroup]="eventForm" (ngSubmit)="onSubmit()">
          <div class="mb-3">
            <label class="mb-1 block text-sm text-text-secondary" for="titleInput">
              {{ 'events.titleWhat' | t }}
            </label>
            <input
              id="titleInput"
              formControlName="title"
              type="text"
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-white placeholder:text-text-muted"
              [placeholder]="'events.titlePlaceholder' | t"
            />
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-sm text-text-secondary" for="dateTimeInput">
              {{ 'events.dateTimeWhen' | t }}
            </label>
            <input
              id="dateTimeInput"
              formControlName="date_time"
              type="datetime-local"
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-white"
            />
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-sm text-text-secondary" for="locationInput">
              {{ 'events.whereLabel' | t }}
            </label>
            <p class="mb-1 text-xs text-text-muted ms-1">
              {{ 'events.whereHint' | t }}
            </p>
            <input
              id="locationInput"
              formControlName="platform_location"
              type="text"
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-white placeholder:text-text-muted"
              [placeholder]="'events.wherePlaceholder' | t"
            />
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-sm text-text-secondary" for="descriptionInput">
              {{ 'events.descriptionLabel' | t }}
            </label>
            <textarea
              id="descriptionInput"
              formControlName="description"
              rows="3"
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-white placeholder:text-text-muted"
              [placeholder]="'events.descriptionPlaceholder' | t"
            ></textarea>
          </div>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              (click)="dismiss.emit()"
              class="rounded-lg bg-surface-200 px-4 py-2 text-sm text-text-secondary hover:text-white transition-colors"
            >
              {{ 'events.cancel' | t }}
            </button>
            <button
              type="submit"
              [disabled]="eventForm.invalid"
              class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-accent-600 transition-colors"
            >
              {{ 'events.create' | t }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class CreateEventModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);

  readonly eventForm = this.fb.group({
    title: ['', Validators.required],
    date_time: ['', Validators.required],
    platform_location: ['', Validators.required],
    description: ['', Validators.required],
  });

  /** Emitted when the event is successfully created on the backend. */
  readonly created = output<Event>();

  /** Emitted when the user cancels the modal. */
  readonly dismiss = output<void>();

  async onSubmit(): Promise<void> {
    if (this.eventForm.invalid) {
      return;
    }
    const raw = this.eventForm.value;
    try {
      const createdEvent = await firstValueFrom(
        this.eventsService.createEvent({
          title: raw.title!,
          date_time: raw.date_time!,
          location: raw.platform_location ?? undefined,
          description: raw.description ?? undefined,
        }),
      );
      this.created.emit(createdEvent);
      this.dismiss.emit();
    } catch (_err) {
      // Error is swallowed - the parent should show a toast/notification
    }
  }
}
