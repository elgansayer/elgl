import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsFeedComponent } from './events-feed.component';
import { Event, EventsService } from '../../services/events.service';

function event(id: string): Event {
  return {
    id,
    title: `Event ${id}`,
    date_time: '2026-08-20T12:00:00.000Z',
    host_id: 'host-1',
    is_cancelled: false,
    created_at: '2026-08-19T12:00:00.000Z',
    updated_at: '2026-08-19T12:00:00.000Z',
  };
}

describe('EventsFeedComponent', () => {
  let fixture: ComponentFixture<EventsFeedComponent>;
  let component: EventsFeedComponent;
  let listEvents: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    listEvents = vi.fn().mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [EventsFeedComponent],
      providers: [{ provide: EventsService, useValue: { listEvents } }],
    }).compileComponents();

    fixture = TestBed.createComponent(EventsFeedComponent);
    component = fixture.componentInstance;
  });

  it('loads the first upcoming page and exposes Spartan radio-group selection semantics', async () => {
    fixture.detectChanges();
    await settle();

    expect(listEvents).toHaveBeenCalledWith({
      status: 'upcoming',
      language_pair: undefined,
      page: 1,
      limit: 20,
    });
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('hlm-radio')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('app-select')).not.toBeNull();
  });

  it('opens the create modal and refreshes the first page after creation', async () => {
    fixture.detectChanges();
    await settle();

    component.openCreateModal();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-create-event-modal')).not.toBeNull();

    component.onEventCreated();
    await settle();

    expect(component.isCreateModalOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-create-event-modal')).toBeNull();
    expect(listEvents).toHaveBeenCalledTimes(2);
    expect(listEvents).toHaveBeenLastCalledWith({
      status: 'upcoming',
      language_pair: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('does not reload when the already-selected status is chosen again', async () => {
    fixture.detectChanges();
    await settle();

    component.onStatusChange('upcoming');
    await settle();

    expect(listEvents).toHaveBeenCalledTimes(1);
  });

  it('resets to page one when the status or language filter changes', async () => {
    fixture.detectChanges();
    await settle();

    component.onStatusChange('past');
    await settle();
    component.onLanguageChange('en-ja');
    await settle();

    expect(listEvents).toHaveBeenNthCalledWith(2, {
      status: 'past',
      language_pair: undefined,
      page: 1,
      limit: 20,
    });
    expect(listEvents).toHaveBeenNthCalledWith(3, {
      status: 'past',
      language_pair: 'en-ja',
      page: 1,
      limit: 20,
    });
  });

  it('ignores stale responses after a newer filter request wins', async () => {
    const initialRequest = new Subject<Event[]>();
    const pastRequest = new Subject<Event[]>();
    listEvents
      .mockReset()
      .mockReturnValueOnce(initialRequest.asObservable())
      .mockReturnValueOnce(pastRequest.asObservable());

    fixture.detectChanges();
    component.onStatusChange('past');

    pastRequest.next([event('past')]);
    pastRequest.complete();
    await settle();

    initialRequest.next([event('stale-upcoming')]);
    initialRequest.complete();
    await settle();

    expect(component.events().map((item) => item.id)).toEqual(['past']);
    expect(component.status()).toBe('past');
  });

  it('retries the same next page after a load-more failure instead of skipping it', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => event(`page-1-${index}`));
    listEvents
      .mockReset()
      .mockReturnValueOnce(of(firstPage))
      .mockReturnValueOnce(throwError(() => new Error('temporary failure')))
      .mockReturnValueOnce(of([event('page-2')])) ;

    fixture.detectChanges();
    await settle();

    component.loadMore();
    await settle();
    expect(component.error()).toBe(true);

    component.loadMore();
    await settle();

    expect(listEvents).toHaveBeenNthCalledWith(2, {
      status: 'upcoming',
      language_pair: undefined,
      page: 2,
      limit: 20,
    });
    expect(listEvents).toHaveBeenNthCalledWith(3, {
      status: 'upcoming',
      language_pair: undefined,
      page: 2,
      limit: 20,
    });
    expect(component.events()).toHaveLength(21);
    expect(component.events().at(-1)?.id).toBe('page-2');
  });

  it('shows an accessible failure state and retries the failed first page', async () => {
    listEvents.mockReset().mockReturnValueOnce(throwError(() => new Error('offline')));

    fixture.detectChanges();
    await settle();

    expect(component.error()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    listEvents.mockReturnValueOnce(of([event('recovered')]));
    component.retry();
    await settle();

    expect(listEvents).toHaveBeenLastCalledWith({
      status: 'upcoming',
      language_pair: undefined,
      page: 1,
      limit: 20,
    });
    expect(component.error()).toBe(false);
    expect(component.events().map((item) => item.id)).toEqual(['recovered']);
  });
});
