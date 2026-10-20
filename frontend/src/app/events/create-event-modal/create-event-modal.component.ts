import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-create-event-modal',
  imports: [
    HlmNativeSelect,
    HlmTextarea,
    HlmInput,
    HlmButton,
    ReactiveFormsModule,
    TranslatePipe,
    ...HlmDialogImports,
  ],
  template: `
    <hlm-dialog [state]="dialogState" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-md rounded-2xl border border-surface-100 bg-surface-200 p-6 shadow-xl"
        aria-labelledby="create-event-title"
      >
        <h2 id="create-event-title" class="mb-4 text-start text-lg font-semibold">
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
              required
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
              required
              class="w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
              [placeholder]="'events.descriptionPlaceholder' | t"
            ></textarea>
          </div>

          @if (submitError()) {
            <p role="alert" class="mb-3 text-sm text-danger">
              {{ 'common.error' | t }}
            </p>
          }

          <!-- Action buttons -->
          <div class="flex justify-end gap-3">
            <button
              hlmBtn
              type="button"
              [disabled]="isSubmitting()"
              (click)="dismiss.emit()"
              class="rounded-lg bg-surface-400 text-text-primary px-4 py-2 text-sm"
            >
              {{ 'events.cancel' | t }}
            </button>
            <button
              hlmBtn
              type="submit"
              [disabled]="eventForm.invalid || isSubmitting()"
              [attr.aria-busy]="isSubmitting() ? 'true' : null"
              class="rounded-lg bg-accent text-on-fill px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {{ 'events.create' | t }}
            </button>
          </div>
        </form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class CreateEventModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);

  readonly eventForm = this.fb.group({
    title: ['', [Validators.required, Validators.pattern(/\S/)]],
    date_time: ['', Validators.required],
    language_pair: [''],
    category: ['audio_room', Validators.required],
    location: ['', [Validators.required, Validators.pattern(/\S/)]],
    max_participants: [null as number | null],
    description: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  readonly dialogState: HlmDialogState = 'open';
  readonly isSubmitting = signal(false);
  readonly submitError = signal(false);

  /** Emitted when the event is successfully created on the backend. */
  readonly created = output<Event>();

  /** Emitted when the user cancels the modal. */
  readonly dismiss = output<void>();

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && !this.isSubmitting()) {
      this.dismiss.emit();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.eventForm.invalid || this.isSubmitting()) {
      this.eventForm.markAllAsTouched();
      return;
    }

    const raw = this.eventForm.value;
    const title = raw.title?.trim();
    const location = raw.location?.trim();
    const description = raw.description?.trim();

    if (!title || !location || !description) {
      this.eventForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(false);

    try {
      const createdEvent = await firstValueFrom(
        this.eventsService.createEvent({
          title,
          date_time: raw.date_time!,
          language_pair: raw.language_pair || undefined,
          category: raw.category!,
          location,
          max_participants: raw.max_participants ?? undefined,
          description,
        }),
      );
      this.created.emit(createdEvent);
      this.dismiss.emit();
    } catch {
      this.submitError.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
