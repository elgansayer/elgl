import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { EventRsvpState, EventRsvpStore } from '../../services/event-rsvp.store';
import { EventRsvpControlsComponent } from './event-rsvp-controls.component';

describe('EventRsvpControlsComponent', () => {
  let fixture: ComponentFixture<EventRsvpControlsComponent>;
  let state: EventRsvpState;
  let store: {
    state: ReturnType<typeof vi.fn>;
    ensureLoaded: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    state = {
      status: 'interested',
      attendingCount: 4,
      interestedCount: 2,
      loaded: true,
      loading: false,
      pending: false,
      error: null,
    };
    store = {
      state: vi.fn(() => state),
      ensureLoaded: vi.fn(),
      setStatus: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [EventRsvpControlsComponent],
      providers: [
        { provide: EventRsvpStore, useValue: store },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventRsvpControlsComponent);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentRef.setInput('eventTitle', 'Conversation Club');
    fixture.componentRef.setInput('maxParticipants', 5);
    fixture.detectChanges();
  });

  it('loads state and exposes mutually exclusive pressed semantics', () => {
    expect(store.ensureLoaded).toHaveBeenCalledWith('event-1');

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const attending = buttons.find((button) =>
      button.textContent?.includes('events.calendar.attending'),
    );
    const interested = buttons.find((button) =>
      button.textContent?.includes('events.calendar.interested'),
    );

    expect(attending?.getAttribute('aria-pressed')).toBe('false');
    expect(interested?.getAttribute('aria-pressed')).toBe('true');
  });

  it('blocks attending when capacity is full but still allows Interested', () => {
    state = { ...state, attendingCount: 5, status: 'interested' };
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const attending = buttons.find((button) =>
      button.textContent?.includes('events.calendar.attending'),
    );
    const interested = buttons.find((button) =>
      button.textContent?.includes('events.calendar.interested'),
    );

    expect(attending?.disabled).toBe(true);
    expect(interested?.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('events.maxParticipants');
  });

  it('prevents duplicate user input while a mutation is pending', () => {
    state = { ...state, pending: true };
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('delegates status changes and clear actions to the shared store', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const attending = buttons.find((button) =>
      button.textContent?.includes('events.calendar.attending'),
    );
    const cancel = buttons.find((button) => button.textContent?.includes('common.cancel'));

    attending?.click();
    cancel?.click();

    expect(store.setStatus).toHaveBeenCalledWith('event-1', 'attending');
    expect(store.clear).toHaveBeenCalledWith('event-1');
  });

  it('shows a retryable translated error when the summary cannot load', () => {
    state = {
      ...state,
      loaded: false,
      loading: false,
      error: 'unavailable',
    };
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => (button as HTMLButtonElement).textContent?.includes('common.retry')) as
      | HTMLButtonElement
      | undefined;
    retry?.click();

    expect(store.ensureLoaded).toHaveBeenCalledTimes(2);
  });
});
