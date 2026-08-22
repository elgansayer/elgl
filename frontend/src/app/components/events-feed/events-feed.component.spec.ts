import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsFeedComponent } from './events-feed.component';
import { Event, EventsService } from '../../services/events.service';

function event(id: string, overrides: Partial<Event> = {}): Event {
  return {
    id,
    title: `Event ${id}`,
    date_time: '2026-08-20T12:00:00.000Z',
    host_id: 'host-1',
    is_cancelled: false,
    created_at: '2026-08-19T12:00:00.000Z',
    updated_at: '2026-08-19T12:00:00.000Z',
    ...overrides,
  };
}

describe('EventsFeedComponent', () => {
  let fixture: ComponentFixture<EventsFeedComponent>;
  let component: EventsFeedComponent;
  let listEvents: ReturnType<typeof vi.fn>;
  let getCategories: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    listEvents = vi.fn().mockReturnValue(of([]));
    getCategories = vi
      .fn()
      .mockReturnValue(of(['audio_room', 'learning_seminar', 'in_person_meetup', 'cultural_exchange']));

    await TestBed.configureTestingModule({
      imports: [EventsFeedComponent],
      providers: [{ provide: EventsService, useValue: { listEvents, getCategories } }],
    }).compileComponents();

    fixture = TestBed.createComponent(EventsFeedComponent);
    component = fixture.componentInstance;
  });

  it('loads the first upcoming page and backend category catalogue', async () => {
    fixture.detectChanges();
    await settle();

    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(listEvents).toHaveBeenCalledWith({
      status: 'upcoming',
      language_pair: undefined,
      category: undefined,
      page: 1,
      limit: 20,
    });
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-select')).toHaveLength(2);
  });

  it('does not reload when the already-selected status is chosen again', async () => {
    fixture.detectChanges();
    await settle();

    component.onStatusChange('upcoming');
    await settle();

    expect(listEvents).toHaveBeenCalledTimes(1);
  });

  it('resets to page one when status, language, or category filters change', async () => {
    fixture.detectChanges();
    await settle();

    component.onStatusChange('past');
    await settle();
    component.onLanguageChange('en-ja');
    await settle();
    component.onCategoryChange('audio_room');
    await settle();

    expect(listEvents).toHaveBeenNthCalledWith(2, {
      status: 'past',
      language_pair: undefined,
      category: undefined,
      page: 1,
      limit: 20,
    });
    expect(listEvents).toHaveBeenNthCalledWith(3, {
      status: 'past',
      language_pair: 'en-ja',
      category: undefined,
      page: 1,
      limit: 20,
    });
    expect(listEvents).toHaveBeenNthCalledWith(4, {
      status: 'past',
      language_pair: 'en-ja',
      category: 'audio_room',
      page: 1,
      limit: 20,
    });
  });

  it('rejects category values that were not returned by the backend catalogue', async () => {
    fixture.detectChanges();
    await settle();

    component.onCategoryChange('not-a-category');
    await settle();

    expect(component.category()).toBeUndefined();
    expect(listEvents).toHaveBeenCalledTimes(1);
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

  it('does not surface cancelled events in the upcoming discovery list', async () => {
    listEvents.mockReturnValueOnce(
      of([event('visible'), event('cancelled', { is_cancelled: true })]),
    );

    fixture.detectChanges();
    await settle();

    expect(component.visibleEvents().map((item) => item.id)).toEqual(['visible']);
    expect(fixture.nativeElement.textContent).toContain('Event visible');
    expect(fixture.nativeElement.textContent).not.toContain('Event cancelled');
  });

  it('renders each visible event as a navigable detail link', async () => {
    listEvents.mockReturnValueOnce(of([event('event-123')]));

    fixture.detectChanges();
    await settle();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((link) => link.getAttribute('href') === '/events/event-123')).toBe(true);
  });

  it('retries the same next page after a load-more failure instead of skipping it', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => event(`page-1-${index}`));
    listEvents
      .mockReset()
      .mockReturnValueOnce(of(firstPage))
      .mockReturnValueOnce(throwError(() => new Error('temporary failure')))
      .mockReturnValueOnce(of([event('page-2')]));

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
      category: undefined,
      page: 2,
      limit: 20,
    });
    expect(listEvents).toHaveBeenNthCalledWith(3, {
      status: 'upcoming',
      language_pair: undefined,
      category: undefined,
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
      category: undefined,
      page: 1,
      limit: 20,
    });
    expect(component.error()).toBe(false);
    expect(component.events().map((item) => item.id)).toEqual(['recovered']);
  });
});
