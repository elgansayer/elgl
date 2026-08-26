import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CreateEventModalComponent } from './create-event-modal.component';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('CreateEventModalComponent', () => {
  let component: CreateEventModalComponent;
  let fixture: ComponentFixture<CreateEventModalComponent>;
  let eventsServiceSpy: { createEvent: ReturnType<typeof vi.fn> };

  const mockEvent: Event = {
    id: 'event-1',
    title: 'Test Event',
    date_time: '2099-08-01T10:00:00Z',
    location: 'https://example.zoom.us/j/123',
    description: 'Some description',
    host_id: 'user-1',
    is_cancelled: false,
    created_at: '2099-08-01T09:00:00Z',
    updated_at: '2099-08-01T09:00:00Z',
  };

  beforeEach(async () => {
    eventsServiceSpy = { createEvent: vi.fn() };

    const translateStub = {
      transform: (key: string) => key,
    };

    await TestBed.configureTestingModule({
      imports: [CreateEventModalComponent, ReactiveFormsModule],
      providers: [
        { provide: EventsService, useValue: eventsServiceSpy as unknown as EventsService },
        { provide: TranslatePipe, useValue: translateStub as unknown as TranslatePipe },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateEventModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setValidZoomForm(): void {
    component.eventForm.setValue({
      title: ' Test Event ',
      date_time: '2099-08-01T10:00',
      venue_type: 'zoom',
      language_pair: 'en-es',
      category: 'learning_seminar',
      location: ' https://example.zoom.us/j/123 ',
      max_participants: 10,
      description: ' Some description ',
    });
  }

  it('starts with a bounded Audio Room form', () => {
    expect(component.eventForm.value).toEqual({
      title: '',
      date_time: '',
      venue_type: 'audio_room',
      language_pair: '',
      category: 'audio_room',
      location: '',
      max_participants: null,
      description: '',
    });
  });

  it('does not submit a past date', async () => {
    setValidZoomForm();
    component.eventForm.patchValue({ date_time: '2020-01-01T10:00' });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).not.toHaveBeenCalled();
    expect(component.eventForm.controls.date_time.invalid).toBe(true);
  });

  it('does not submit an unsafe Zoom URL', async () => {
    setValidZoomForm();
    component.eventForm.patchValue({ location: 'javascript:alert(1)' });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).not.toHaveBeenCalled();
    expect(component.eventForm.hasError('venueLocation')).toBe(true);
  });

  it('requires a UUID-shaped Audio Room reference', async () => {
    setValidZoomForm();
    component.eventForm.patchValue({ venue_type: 'audio_room', location: 'room-name' });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).not.toHaveBeenCalled();
    expect(component.eventForm.hasError('venueLocation')).toBe(true);
  });

  it('submits a normalized UTC timestamp and timezone, then resets', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);
    eventsServiceSpy.createEvent.mockReturnValue(of(mockEvent));
    setValidZoomForm();

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledWith({
      title: 'Test Event',
      date_time: new Date('2099-08-01T10:00').toISOString(),
      venue_type: 'zoom',
      timezone: component.localTimezone,
      language_pair: 'en-es',
      category: 'learning_seminar',
      location: 'https://example.zoom.us/j/123',
      max_participants: 10,
      description: 'Some description',
    });
    expect(createdSpy).toHaveBeenCalledWith(mockEvent);
    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(component.eventForm.controls.title.value).toBe('');
  });

  it('prevents duplicate submissions while the first request is pending', async () => {
    const pending = new Subject<Event>();
    eventsServiceSpy.createEvent.mockReturnValue(pending);
    setValidZoomForm();

    const first = component.onSubmit();
    const duplicate = component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledTimes(1);
    expect(component.isSubmitting()).toBe(true);

    pending.next(mockEvent);
    pending.complete();
    await Promise.all([first, duplicate]);
  });

  it('preserves the draft and exposes retryable failure state', async () => {
    eventsServiceSpy.createEvent.mockReturnValue(
      throwError(() => new Error('creation failed')),
    );
    setValidZoomForm();

    await component.onSubmit();

    expect(component.submitError()).toBe(true);
    expect(component.eventForm.controls.title.value).toBe(' Test Event ');
    expect(component.eventForm.controls.location.value).toContain('zoom.us');
  });

  it('resets the draft when the user explicitly cancels', () => {
    const dismissSpy = vi.fn();
    component.dismiss.subscribe(dismissSpy);
    setValidZoomForm();

    component.cancel();

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(component.eventForm.controls.title.value).toBe('');
    expect(component.eventForm.controls.venue_type.value).toBe('audio_room');
  });
});
