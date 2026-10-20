import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDetailComponent } from './event-detail.component';
import { Event, EventsService } from '../../services/events.service';

const event: Event = {
  id: 'event-42',
  title: 'Japanese practice meetup',
  description: '<script>not markup</script> Plain event description',
  category: 'in_person_meetup',
  date_time: '2026-08-22T12:00:00.000Z',
  location: 'Lancaster',
  host_id: 'host-1',
  host_name: 'Aiko',
  max_participants: 20,
  attendees_count: 8,
  interested_count: 3,
  is_cancelled: false,
  created_at: '2026-08-20T12:00:00.000Z',
  updated_at: '2026-08-20T12:00:00.000Z',
};

describe('EventDetailComponent', () => {
  let fixture: ComponentFixture<EventDetailComponent>;
  let component: EventDetailComponent;
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
        { provide: EventsService, useValue: { getEvent } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ eventId: 'event-42' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventDetailComponent);
    component = fixture.componentInstance;
  });

  it('loads and renders the authoritative event detail', async () => {
    fixture.detectChanges();
    await settle();

    expect(getEvent).toHaveBeenCalledWith('event-42');
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Japanese practice meetup');
    expect(fixture.nativeElement.textContent).toContain('Lancaster');
    expect(fixture.nativeElement.textContent).toContain('8');
  });

  it('renders event description as text rather than trusted HTML', async () => {
    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<script>not markup</script>');
  });

  it('shows an accessible failure state and retries the same event', async () => {
    getEvent.mockReset().mockReturnValueOnce(throwError(() => new Error('offline')));

    fixture.detectChanges();
    await settle();

    expect(component.error()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    getEvent.mockReturnValueOnce(of(event));
    component.retry();
    await settle();

    expect(getEvent).toHaveBeenLastCalledWith('event-42');
    expect(component.error()).toBe(false);
    expect(component.event()?.id).toBe('event-42');
  });
});
