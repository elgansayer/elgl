import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-create-event-modal',
  imports: [HlmNativeSelect, HlmTextarea, HlmInput, HlmButton, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="max-w-md w-full rounded-2xl bg-surface-200 p-6 shadow-xl">
        <h2 class="mb-4 text-start text-lg font-semibold">
          {{ 'events.createEvent' | t }}
        </h2>

        <form [formGroup]="eventForm" (ngSubmit)="onSubmit()">
          <!-- Title -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="titleInput">
              {{ 'events.title' | t }}
            </label>
            <input
              hlmInput
              id="titleInput"
              formControlName="title"
              type="text"
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              [placeholder]="'events.titlePlaceholder' | t"
            />
          </div>

          <!-- Date & Time -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="dateTimeInput">
              {{ 'events.dateTime' | t }}
            </label>
            <input
              hlmInput
              id="dateTimeInput"
              formControlName="date_time"
              type="datetime-local"
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
            />
          </div>

          <!-- Language Pair -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="langPairInput">
              {{ 'events.languagePair' | t }}
            </label>
            <hlm-native-select
              selectId="langPairInput"
              formControlName="language_pair"
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              selectClass="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
            >
              <option value="">
                {{ 'events.noLanguagePair' | t }}
              </option>
              <option value="en-es">English &harr; Spanish</option>
              <option value="en-ja">English &harr; Japanese</option>
              <option value="en-ko">English &harr; Korean</option>
              <option value="en-zh">English &harr; Chinese</option>
              <option value="en-fr">English &harr; French</option>
              <option value="en-de">English &harr; German</option>
              <option value="en-ar">English &harr; Arabic</option>
              <option value="en-pt">English &harr; Portuguese</option>
              <option value="en-ru">English &harr; Russian</option>
              <option value="en-it">English &harr; Italian</option>
            </hlm-native-select>
          </div>

          <!-- Category -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="categoryInput">
              {{ 'events.category' | t }}
            </label>
            <hlm-native-select
              selectId="categoryInput"
              formControlName="category"
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              selectClass="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
            >
              <option value="audio_room">
                {{ 'events.categoryAudioRoom' | t }}
              </option>
              <option value="learning_seminar">
                {{ 'events.categoryLearningSeminar' | t }}
              </option>
              <option value="in_person_meetup">
                {{ 'events.categoryInPersonMeetup' | t }}
              </option>
              <option value="cultural_exchange">
                {{ 'events.categoryCulturalExchange' | t }}
              </option>
            </hlm-native-select>
          </div>

          <!-- Location -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="locationInput">
              {{ 'events.where' | t }}
            </label>
            <input
              hlmInput
              id="locationInput"
              formControlName="location"
              type="text"
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              [placeholder]="'events.wherePlaceholder' | t"
            />
          </div>

          <!-- Max Participants -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="maxParticipantsInput">
              {{ 'events.maxParticipants' | t }}
            </label>
            <input
              hlmInput
              id="maxParticipantsInput"
              formControlName="max_participants"
              type="number"
              min="1"
              max="100"
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              [placeholder]="'events.maxParticipantsPlaceholder' | t"
            />
          </div>

          <!-- Description -->
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="descriptionInput">
              {{ 'events.description' | t }}
            </label>
            <textarea
              hlmTextarea
              id="descriptionInput"
              formControlName="description"
              rows="3"
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              [placeholder]="'events.descriptionPlaceholder' | t"
            ></textarea>
          </div>

          <!-- Action buttons -->
          <div class="flex justify-end gap-3">
            <button
              hlmBtn
              type="button"
              (click)="dismiss.emit()"
              class="rounded-lg bg-surface-400 text-text-primary px-4 py-2 text-sm"
            >
              {{ 'events.cancel' | t }}
            </button>
            <button
              hlmBtn
              type="submit"
              [disabled]="eventForm.invalid"
              class="rounded-lg bg-accent text-on-fill px-4 py-2 text-sm font-semibold disabled:opacity-50"
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
    language_pair: [''],
    category: ['audio_room'],
    location: [''],
    max_participants: [null as number | null],
    description: [''],
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
          language_pair: raw.language_pair || undefined,
          category: raw.category || undefined,
          location: raw.location || undefined,
          max_participants: raw.max_participants ?? undefined,
          description: raw.description || undefined,
        }),
      );
      this.created.emit(createdEvent);
      this.dismiss.emit();
    } catch (err) {
      console.error('Failed to create event', err);
    }
  }
}
