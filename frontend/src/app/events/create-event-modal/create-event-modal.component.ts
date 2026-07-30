import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

/**
 * Values emitted when the user confirms creation (kept for reference).
 */
export interface AppEventParams {
  title: string;
  date_time: string;
  location?: string;
  description?: string;
}

@Component({
  selector: 'app-create-event-modal',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        class="max-w-md w-full rounded-2xl bg-surface-dark p-6 shadow-xl"
      >
        <h2 class="mb-4 text-start text-lg font-semibold">
          {{ 'events.createEvent' | t }}
        </h2>

        <form [formGroup]="eventForm" (ngSubmit)="onSubmit()">
          <!-- What (Title) -->
          <div class="mb-3">
            <label class="mb-1 block text-sm">
              {{ 'events.title' | t }}
            </label>
            <input
              formControlName="title"
              type="text"
              required
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              [placeholder]="'events.titlePlaceholder' | t"
            />
          </div>

          <!-- When (Date & Time) -->
          <div class="mb-3">
            <label class="mb-1 block text-sm">
              {{ 'events.dateTime' | t }}
            </label>
            <input
              formControlName="date_time"
              type="datetime-local"
              required
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          <!-- Where (Platform / Location) -->
          <div class="mb-3">
            <label class="mb-1 block text-sm">
              {{ 'events.where' | t }}
            </label>
            <p class="text-xs text-gray-500 ms-1">
              {{ 'events.whereHint' | t }}
            </p>
            <input
              formControlName="platform_location"
              type="text"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              [placeholder]="'events.wherePlaceholder' | t"
            />
          </div>

          <!-- Description -->
          <div class="mb-3">
            <label class="mb-1 block text-sm">
              {{ 'events.description' | t }}
            </label>
            <textarea
              formControlName="description"
              rows="3"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              [placeholder]="'events.descriptionPlaceholder' | t"
            ></textarea>
          </div>

          <!-- Action buttons -->
          <div class="flex justify-end gap-3">
            <button
              type="button"
              (click)="cancel.emit()"
              class="rounded-lg bg-gray-700 px-4 py-2 text-sm"
            >
              {{ 'events.cancel' | t }}
            </button>
            <button
              type="submit"
              [disabled]="eventForm.invalid"
              class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {{ 'events.create' | t }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CreateEventModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);

  readonly eventForm = this.fb.group({
    title: ['', Validators.required],
    date_time: ['', Validators.required],
    platform_location: [''],
    description: [''],
  });

  /** Emitted when the event is successfully created on the backend. */
  readonly created = output<Event>();

  /** Emitted when the user cancels the modal. */
  readonly cancel = output<void>();

  async onSubmit(): Promise<void> {
    if (this.eventForm.invalid) {
      return;
    }
    const raw = this.eventForm.value;
    const payload = {
      title: raw.title!,
      date_time: raw.date_time!,
      location: raw.platform_location ?? undefined,
      description: raw.description ?? undefined,
    };
    try {
      const createdEvent = await firstValueFrom(
        this.eventsService.createEvent(payload as any),
      );
      this.created.emit(createdEvent);
      this.cancel.emit();
    } catch (err) {
      console.error('Failed to create event', err);
    }
  }
}
