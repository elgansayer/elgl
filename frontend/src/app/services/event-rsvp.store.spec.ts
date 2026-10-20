import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventRsvpStore } from './event-rsvp.store';
import { EventRsvp, EventRsvpSummary, EventsService } from './events.service';

describe('EventRsvpStore', () => {
  let store: EventRsvpStore;
  let getRsvpSummaries: ReturnType<typeof vi.fn>;
  let rsvp: ReturnType<typeof vi.fn>;
  let removeRsvp: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    getRsvpSummaries = vi.fn().mockReturnValue(of([]));
    rsvp = vi.fn().mockReturnValue(
      of({ event_id: 'event-1', user_id: 'user-1', status: 'attending' } satisfies EventRsvp),
    );
    removeRsvp = vi.fn().mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        EventRsvpStore,
        {
          provide: EventsService,
          useValue: { getRsvpSummaries, rsvp, removeRsvp },
        },
      ],
    });

    store = TestBed.inject(EventRsvpStore);
  });

  it('batches same-turn summary loads and exposes only aggregate state', async () => {
    const summaries: EventRsvpSummary[] = [
      {
        event_id: 'event-1',
        attending_count: 4,
        interested_count: 2,
        viewer_status: 'interested',
      },
      {
        event_id: 'event-2',
        attending_count: 1,
        interested_count: 0,
        viewer_status: null,
      },
    ];
    getRsvpSummaries.mockReturnValueOnce(of(summaries));

    store.ensureLoaded('event-1');
    store.ensureLoaded('event-2');
    await settle();

    expect(getRsvpSummaries).toHaveBeenCalledTimes(1);
    expect(getRsvpSummaries).toHaveBeenCalledWith(['event-1', 'event-2']);
    expect(store.state('event-1')).toMatchObject({
      status: 'interested',
      attendingCount: 4,
      interestedCount: 2,
      loaded: true,
      loading: false,
    });
  });

  it('optimistically switches status, blocks duplicate clicks, then reconciles canonical counts', async () => {
    getRsvpSummaries
      .mockReturnValueOnce(
        of([
          {
            event_id: 'event-1',
            attending_count: 3,
            interested_count: 5,
            viewer_status: 'interested',
          } satisfies EventRsvpSummary,
        ]),
      )
      .mockReturnValueOnce(
        of([
          {
            event_id: 'event-1',
            attending_count: 4,
            interested_count: 4,
            viewer_status: 'attending',
          } satisfies EventRsvpSummary,
        ]),
      );
    store.ensureLoaded('event-1');
    await settle();

    const response = new Subject<EventRsvp>();
    rsvp.mockReturnValueOnce(response.asObservable());
    const firstMutation = store.setStatus('event-1', 'attending');
    void store.setStatus('event-1', 'attending');

    expect(store.state('event-1')).toMatchObject({
      status: 'attending',
      attendingCount: 4,
      interestedCount: 4,
      pending: true,
    });
    expect(rsvp).toHaveBeenCalledTimes(1);

    response.next({ event_id: 'event-1', user_id: 'user-1', status: 'attending' });
    response.complete();
    await firstMutation;

    expect(store.state('event-1')).toMatchObject({
      status: 'attending',
      attendingCount: 4,
      interestedCount: 4,
      pending: false,
      error: null,
    });
  });

  it('rolls back a full-event rejection and exposes a non-sensitive full state', async () => {
    getRsvpSummaries.mockReturnValueOnce(
      of([
        {
          event_id: 'event-1',
          attending_count: 10,
          interested_count: 2,
          viewer_status: 'interested',
        } satisfies EventRsvpSummary,
      ]),
    );
    store.ensureLoaded('event-1');
    await settle();

    rsvp.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            statusText: 'Conflict',
          }),
      ),
    );

    await store.setStatus('event-1', 'attending');

    expect(store.state('event-1')).toMatchObject({
      status: 'interested',
      attendingCount: 10,
      interestedCount: 2,
      pending: false,
      error: 'full',
    });
  });

  it('optimistically clears an RSVP and reconciles after the delete commits', async () => {
    getRsvpSummaries
      .mockReturnValueOnce(
        of([
          {
            event_id: 'event-1',
            attending_count: 2,
            interested_count: 0,
            viewer_status: 'attending',
          } satisfies EventRsvpSummary,
        ]),
      )
      .mockReturnValueOnce(
        of([
          {
            event_id: 'event-1',
            attending_count: 1,
            interested_count: 0,
            viewer_status: null,
          } satisfies EventRsvpSummary,
        ]),
      );
    store.ensureLoaded('event-1');
    await settle();

    await store.clear('event-1');

    expect(removeRsvp).toHaveBeenCalledWith('event-1');
    expect(store.state('event-1')).toMatchObject({
      status: null,
      attendingCount: 1,
      interestedCount: 0,
      pending: false,
    });
  });

  it('keeps RSVP controls retryable when summary loading fails', async () => {
    getRsvpSummaries.mockReturnValueOnce(throwError(() => new Error('offline')));

    store.ensureLoaded('event-1');
    await settle();

    expect(store.state('event-1')).toMatchObject({
      loaded: false,
      loading: false,
      error: 'unavailable',
    });

    getRsvpSummaries.mockReturnValueOnce(of([]));
    store.ensureLoaded('event-1');
    await settle();

    expect(getRsvpSummaries).toHaveBeenCalledTimes(2);
    expect(store.state('event-1')).toMatchObject({ loaded: true, error: null });
  });
});
