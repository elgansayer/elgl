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
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" [attr.aria-label]="'events.createTitle' | t">
      <div class="max-w-md w-full rounded-2xl bg-[#1e1e1e] p-6 shadow-xl border border-gray-700">
        <h2 class="mb-4 text-start text-lg font-semibold text-white">
          {{ 'events.createTitle' | t }}
        </h2>

        <form [formGroup]="eventForm" (ngSubmit)="onSubmit()">
          <!-- What (Title) -->
          <div class="mb-4">
            <label class="mb-1 block text-sm text-gray-300" for="titleInput">
              {{ 'events.titleWhat' | t }}
            </label>
            <input
              id="titleInput"
              formControlName="title"
              type="text"
              required
              class="w-full rounded-lg border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-gray-400"
              [placeholder]="'events.titlePlaceholder' | t"
            />
          </div>

          <!-- When (Date & Time) -->
          <div class="mb-4">
            <label class="mb-1 block text-sm text-gray-300" for="dateTimeInput">
              {{ 'events.dateTimeWhen' | t }}
            </label>
            <input
              id="dateTimeInput"
              formControlName="date_time"
              type="datetime-local"
              required
              class="w-full rounded-lg border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-sm text-white"
            />
          </div>

          <!-- Where (Platform / Location) -->
          <div class="mb-4">
            <label class="mb-1 block text-sm text-gray-300" for="locationSelect">
              {{ 'events.locationWhere' | t }}
            </label>
            <p class="text-xs text-gray-500 ms-1 mb-1">
              {{ 'events.whereHint' | t }}
            </p>
            <select
              id="locationSelect"
              formControlName="platform_location"
              required
              class="w-full rounded-lg border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-sm text-white"
            >
              <option value="" disabled selected>{{ 'events.locationSelect' | t }}</option>
              @for (opt of locationOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label | t }}</option>
              }
            </select>
          </div>

          <!-- Description -->
          <div class="mb-4">
            <label class="mb-1 block text-sm text-gray-300" for="descriptionInput">
              {{ 'events.description' | t }}
            </label>
            <textarea
              id="descriptionInput"
              formControlName="description"
              rows="3"
              required
              class="w-full rounded-lg border border-gray-600 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-gray-400"
              [placeholder]="'events.descriptionPlaceholder' | t"
            ></textarea>
          </div>

          <!-- Action buttons -->
          <div class="flex justify-end gap-3">
            <button
              type="button"
              (click)="dismiss.emit()"
              class="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
            >
              {{ 'common.cancel' | t }}
            </button>
            <button
              type="submit"
              [disabled]="eventForm.invalid"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {{ 'common.save' | t }}
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

  readonly locationOptions = [
    { value: 'audio_room', label: 'events.locationAudio' },
    { value: 'zoom', label: 'events.locationZoom' },
    { value: 'in_person', label: 'events.locationInPerson' },
  ];

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
    } catch (err) {
      console.error('Failed to create event', err);
    }
  }
}
