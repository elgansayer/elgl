import { Component, Input, OnInit, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { EventRsvpState, EventRsvpStore } from '../../services/event-rsvp.store';
import { EventRsvpStatus } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-event-rsvp-controls',
  imports: [HlmButton, TranslatePipe],
  template: `
    @let rsvp = rsvpStore.state(eventId);
    <div
      class="mt-3 flex flex-col items-start gap-2"
      [attr.aria-busy]="rsvp.loading || rsvp.pending ? 'true' : null"
    >
      @if (rsvp.loading) {
        <p role="status" class="text-sm text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (!rsvp.loaded) {
        <div role="alert" class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-danger">{{ 'common.error_generic' | t }}</span>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else {
        <div class="flex max-w-full flex-wrap gap-2">
          <button
            hlmBtn
            type="button"
            size="touch"
            [variant]="rsvp.status === 'attending' ? 'default' : 'secondary'"
            [attr.aria-pressed]="rsvp.status === 'attending'"
            [disabled]="!mutable || rsvp.pending || (isFull(rsvp) && rsvp.status !== 'attending')"
            (click)="setStatus('attending')"
          >
            {{ 'events.calendar.attending' | t }} · {{ rsvp.attendingCount }}
          </button>
          <button
            hlmBtn
            type="button"
            size="touch"
            [variant]="rsvp.status === 'interested' ? 'default' : 'secondary'"
            [attr.aria-pressed]="rsvp.status === 'interested'"
            [disabled]="!mutable || rsvp.pending"
            (click)="setStatus('interested')"
          >
            {{ 'events.calendar.interested' | t }} · {{ rsvp.interestedCount }}
          </button>
          @if (rsvp.status !== null) {
            <button
              hlmBtn
              type="button"
              variant="ghost"
              size="touch"
              [disabled]="!mutable || rsvp.pending"
              (click)="clear()"
            >
              {{ 'common.cancel' | t }}
            </button>
          }
        </div>

        @if (isFull(rsvp) && rsvp.status !== 'attending') {
          <p role="status" class="text-sm text-text-secondary">
            {{ 'events.maxParticipants' | t }}: {{ maxParticipants }}
          </p>
        }
        @if (rsvp.error === 'unavailable' || (rsvp.error === 'full' && !maxParticipants)) {
          <p role="alert" class="text-sm text-danger">{{ 'common.error_generic' | t }}</p>
        } @else if (rsvp.error === 'full') {
          <p role="alert" class="text-sm text-danger">
            {{ 'events.maxParticipants' | t }}: {{ maxParticipants }}
          </p>
        }
      }
    </div>
  `,
})
export class EventRsvpControlsComponent implements OnInit {
  readonly rsvpStore = inject(EventRsvpStore);

  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) eventTitle!: string;
  @Input() maxParticipants?: number;
  @Input() mutable = true;

  ngOnInit(): void {
    this.rsvpStore.ensureLoaded(this.eventId);
  }

  isFull(state: EventRsvpState): boolean {
    return (
      this.maxParticipants !== undefined &&
      this.maxParticipants > 0 &&
      state.attendingCount >= this.maxParticipants
    );
  }

  setStatus(status: EventRsvpStatus): void {
    if (!this.mutable) return;
    void this.rsvpStore.setStatus(this.eventId, status);
  }

  clear(): void {
    if (!this.mutable) return;
    void this.rsvpStore.clear(this.eventId);
  }

  retry(): void {
    this.rsvpStore.ensureLoaded(this.eventId);
  }
}
