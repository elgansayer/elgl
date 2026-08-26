import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDetailComponent } from './event-detail.component';
import { EventsService, type Event } from '../../services/events.service';

const event: Event = {
  id: 'event-123',
  title: 'Japanese practice',
  description: '<script>alert(1)</script> Useful practice session',
  category: 'learning_seminar',
  date_time: '2026-08-25T18:00:00.000Z',
  location: 'Online',
  host_id: 'host-1',
  host_name: 'Host User',
  language_pair: 'en-ja',
  is_cancelled: false,
  created_at: '2026-08-20T12:00:00.000Z',
  updated_at: '2026-08-20T12:00:00.000Z',
  attendees_count: 8,
  interested_count: 3,
};

describe('EventDetailComponent', () => {
  let fixture: ComponentFixture<EventDetailComponent>;
  let getEvent: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    getEvent = vi.fn().mockReturnValue(of(event));
    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [
        provideRouter([]),
        { provide: EventsService, useValue: { getEvent } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (name: string) => (name === 'id' ? 'event-123' : null) } } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EventDetailComponent);
  });

  it('loads the route event and renders model output as text, not HTML', async () => {
    fixture.detectChanges();
    await settle();

    expect(getEvent).toHaveBeenCalledWith('event-123');
    expect(fixture.nativeElement.textContent).toContain('Japanese practice');
    expect(fixture.nativeElement.textContent).toContain('<script>alert(1)</script> Useful practice session');
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
  });

  it('links the event host to the existing profile route', async () => {
    fixture.detectChanges();
    await settle();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((link) => link.getAttribute('href') === '/profile/host-1')).toBe(true);
  });

  it('shows an accessible error and retries the same event', async () => {
    getEvent.mockReset().mockReturnValueOnce(throwError(() => new Error('network')));
    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    getEvent.mockReturnValueOnce(of(event));
    fixture.componentInstance.retry();
    await settle();

    expect(getEvent).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Japanese practice');
  });
});
