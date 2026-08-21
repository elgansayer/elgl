import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  EventsService,
  Event,
  EventVenueType,
} from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

const AUDIO_ROOM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const trimmedRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  return value ? null : { trimmedRequired: true };
};

const futureLocalDate: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;
  const timestamp = new Date(String(control.value)).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() ? null : { futureDate: true };
};

const venueLocationValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const venue = control.get('venue_type')?.value as EventVenueType | null;
  const location = String(control.get('location')?.value ?? '').trim();
  if (!venue || !location) return null;

  if (venue === 'audio_room') {
    return AUDIO_ROOM_ID_PATTERN.test(location) ? null : { venueLocation: true };
  }

  if (venue === 'zoom') {
    try {
      const url = new URL(location);
      return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname
        ? null
        : { venueLocation: true };
    } catch {
      return { venueLocation: true };
    }
  }

  return null;
};

@Component({
  selector: 'app-create-event-modal',
  imports: [
    HlmNativeSelect,
    HlmTextarea,
    HlmInput,
    HlmButton,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  template: `
    <div class="max-h-[80vh] overflow-y-auto pe-1">
      <h2 class="mb-1 text-start text-lg font-semibold">
        {{ 'events.createTitle' | t }}
      </h2>
      <p id="event-create-timezone" class="mb-4 text-sm text-text-secondary">
        <span class="sr-only">{{ 'events.datetime' | t }}:</span>
        {{ localTimezone }}
      </p>

      @if (submitError()) {
        <p role="alert" class="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ 'common.error_generic' | t }}
        </p>
      }

      <form [formGroup]="eventForm" (ngSubmit)="onSubmit()" novalidate>
        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="titleInput">
            {{ 'events.title' | t }}
          </label>
          <input
            hlmInput
            id="titleInput"
            formControlName="title"
            type="text"
            maxlength="120"
            autocomplete="off"
            class="min-h-11 w-full"
            [attr.aria-invalid]="showControlError('title') ? 'true' : null"
            [attr.aria-describedby]="showControlError('title') ? 'titleInputError' : null"
          />
          @if (showControlError('title')) {
            <p id="titleInputError" role="alert" class="mt-1 text-xs text-danger">
              {{ 'common.error_generic' | t }}
            </p>
          }
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="dateTimeInput">
            {{ 'events.datetime' | t }}
          </label>
          <input
            hlmInput
            id="dateTimeInput"
            formControlName="date_time"
            type="datetime-local"
            [min]="minimumDateTime"
            class="min-h-11 w-full"
            aria-describedby="event-create-timezone dateTimeInputError"
            [attr.aria-invalid]="showControlError('date_time') ? 'true' : null"
          />
          @if (showControlError('date_time')) {
            <p id="dateTimeInputError" role="alert" class="mt-1 text-xs text-danger">
              {{ 'common.error_generic' | t }}
            </p>
          }
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="venueTypeInput">
            {{ 'events.location' | t }}
          </label>
          <hlm-native-select
            selectId="venueTypeInput"
            formControlName="venue_type"
            class="w-full"
            selectClass="min-h-11 w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
          >
            <option value="audio_room">{{ 'events.locationAudio' | t }}</option>
            <option value="zoom">{{ 'events.locationZoom' | t }}</option>
            <option value="in_person">{{ 'events.locationInPerson' | t }}</option>
          </hlm-native-select>
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="locationInput">
            {{ locationLabelKey() | t }}
          </label>
          <input
            hlmInput
            id="locationInput"
            formControlName="location"
            [type]="eventForm.controls.venue_type.value === 'zoom' ? 'url' : 'text'"
            maxlength="500"
            autocomplete="off"
            class="min-h-11 w-full"
            [placeholder]="locationLabelKey() | t"
            [attr.aria-invalid]="showLocationError() ? 'true' : null"
            [attr.aria-describedby]="showLocationError() ? 'locationInputError' : null"
          />
          @if (showLocationError()) {
            <p id="locationInputError" role="alert" class="mt-1 text-xs text-danger">
              {{ 'common.error_generic' | t }}
            </p>
          }
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="langPairInput">
            {{ 'events.languagePair' | t }}
          </label>
          <hlm-native-select
            selectId="langPairInput"
            formControlName="language_pair"
            class="w-full"
            selectClass="min-h-11 w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
          >
            <option value="">{{ 'events.noLanguagePair' | t }}</option>
            <option value="en-es">English ↔ Spanish</option>
            <option value="en-ja">English ↔ Japanese</option>
            <option value="en-ko">English ↔ Korean</option>
            <option value="en-zh">English ↔ Chinese</option>
            <option value="en-fr">English ↔ French</option>
            <option value="en-de">English ↔ German</option>
            <option value="en-ar">English ↔ Arabic</option>
            <option value="en-pt">English ↔ Portuguese</option>
            <option value="en-ru">English ↔ Russian</option>
            <option value="en-it">English ↔ Italian</option>
          </hlm-native-select>
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="categoryInput">
            {{ 'events.category' | t }}
          </label>
          <hlm-native-select
            selectId="categoryInput"
            formControlName="category"
            class="w-full"
            selectClass="min-h-11 w-full rounded-lg border border-surface-100 bg-surface-300 px-3 py-2 text-sm"
          >
            <option value="audio_room">{{ 'events.categoryAudioRoom' | t }}</option>
            <option value="learning_seminar">{{ 'events.categoryLearningSeminar' | t }}</option>
            <option value="in_person_meetup">{{ 'events.categoryInPersonMeetup' | t }}</option>
            <option value="cultural_exchange">{{ 'events.categoryCulturalExchange' | t }}</option>
          </hlm-native-select>
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium" for="maxParticipantsInput">
            {{ 'events.maxParticipants' | t }}
          </label>
          <input
            hlmInput
            id="maxParticipantsInput"
            formControlName="max_participants"
            type="number"
            min="1"
            max="100"
            class="min-h-11 w-full"
            [placeholder]="'events.maxParticipantsPlaceholder' | t"
            [attr.aria-invalid]="showControlError('max_participants') ? 'true' : null"
          />
          @if (showControlError('max_participants')) {
            <p role="alert" class="mt-1 text-xs text-danger">
              {{ 'common.error_generic' | t }}
            </p>
          }
        </div>

        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium" for="descriptionInput">
            {{ 'events.description' | t }}
          </label>
          <textarea
            hlmTextarea
            id="descriptionInput"
            formControlName="description"
            rows="3"
            maxlength="2000"
            class="w-full"
            [attr.aria-invalid]="showControlError('description') ? 'true' : null"
            [attr.aria-describedby]="showControlError('description') ? 'descriptionInputError' : null"
          ></textarea>
          @if (showControlError('description')) {
            <p id="descriptionInputError" role="alert" class="mt-1 text-xs text-danger">
              {{ 'common.error_generic' | t }}
            </p>
          }
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="touch"
            [disabled]="isSubmitting()"
            (click)="cancel()"
          >
            {{ 'common.cancel' | t }}
          </button>
          <button
            hlmBtn
            type="submit"
            size="touch"
            [disabled]="isSubmitting()"
            [attr.aria-busy]="isSubmitting() ? 'true' : null"
          >
            @if (isSubmitting()) {
              {{ 'common.saving' | t }}
            } @else {
              {{ 'events.createTitle' | t }}
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CreateEventModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);

  readonly localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  readonly minimumDateTime = this.toLocalDateTime(new Date(Date.now() + 60_000));
  readonly isSubmitting = signal(false);
  readonly submitError = signal(false);
  readonly submitAttempted = signal(false);

  readonly eventForm = this.fb.group(
    {
      title: ['', [Validators.required, trimmedRequired, Validators.maxLength(120)]],
      date_time: ['', [Validators.required, futureLocalDate]],
      venue_type: ['audio_room' as EventVenueType, Validators.required],
      language_pair: [''],
      category: ['audio_room', Validators.required],
      location: ['', [Validators.required, trimmedRequired, Validators.maxLength(500)]],
      max_participants: [null as number | null, [Validators.min(1), Validators.max(100)]],
      description: [
        '',
        [Validators.required, trimmedRequired, Validators.maxLength(2000)],
      ],
    },
    { validators: venueLocationValidator },
  );

  readonly created = output<Event>();
  readonly dismiss = output<void>();

  showControlError(controlName: keyof typeof this.eventForm.controls): boolean {
    const control = this.eventForm.controls[controlName];
    return control.invalid && (control.touched || this.submitAttempted());
  }

  showLocationError(): boolean {
    const control = this.eventForm.controls.location;
    return (
      (control.invalid || this.eventForm.hasError('venueLocation')) &&
      (control.touched || this.submitAttempted())
    );
  }

  locationLabelKey(): string {
    switch (this.eventForm.controls.venue_type.value) {
      case 'zoom':
        return 'events.locationZoom';
      case 'in_person':
        return 'events.locationInPerson';
      default:
        return 'events.locationAudio';
    }
  }

  cancel(): void {
    if (this.isSubmitting()) return;
    this.resetForm();
    this.dismiss.emit();
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) return;

    this.submitAttempted.set(true);
    this.eventForm.markAllAsTouched();
    this.eventForm.updateValueAndValidity();
    if (this.eventForm.invalid) return;

    const raw = this.eventForm.getRawValue();
    const localDate = new Date(raw.date_time!);
    this.isSubmitting.set(true);
    this.submitError.set(false);

    try {
      const createdEvent = await firstValueFrom(
        this.eventsService.createEvent({
          title: raw.title!.trim(),
          date_time: localDate.toISOString(),
          venue_type: raw.venue_type!,
          timezone: this.localTimezone,
          language_pair: raw.language_pair?.trim() || undefined,
          category: raw.category || undefined,
          location: raw.location!.trim(),
          max_participants: raw.max_participants ?? undefined,
          description: raw.description!.trim(),
        }),
      );
      this.created.emit(createdEvent);
      this.resetForm();
      this.dismiss.emit();
    } catch {
      this.submitError.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private resetForm(): void {
    this.eventForm.reset({
      title: '',
      date_time: '',
      venue_type: 'audio_room',
      language_pair: '',
      category: 'audio_room',
      location: '',
      max_participants: null,
      description: '',
    });
    this.submitAttempted.set(false);
    this.submitError.set(false);
  }

  private toLocalDateTime(date: Date): string {
    const offsetMillis = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMillis).toISOString().slice(0, 16);
  }
}
