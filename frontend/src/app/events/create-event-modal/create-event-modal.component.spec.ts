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
    date_time: '2026-09-01T10:00:00Z',
    location: 'Zoom',
    description: 'Some description',
    host_id: 'user-1',
    is_cancelled: false,
    created_at: '2026-08-26T15:00:00Z',
    updated_at: '2026-08-26T15:00:00Z',
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
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateEventModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start with default form values', () => {
    expect(component.eventForm.value).toEqual({
      title: '',
      date_time: '',
      language_pair: '',
      category: 'audio_room',
      location: '',
      max_participants: null,
      description: '',
    });
    expect(component.eventForm.invalid).toBe(true);
  });

  it('requires title, date and time, location, and description', () => {
    component.eventForm.patchValue({
      title: 'Conversation meetup',
      date_time: '2026-09-01T10:00',
      location: 'Zoom',
      description: 'Practice together',
    });

    expect(component.eventForm.valid).toBe(true);

    for (const field of ['title', 'location', 'description'] as const) {
      component.eventForm.controls[field].setValue('   ');
      expect(component.eventForm.controls[field].invalid).toBe(true);
      component.eventForm.controls[field].setValue(
        field === 'title' ? 'Conversation meetup' : field === 'location' ? 'Zoom' : 'Practice together',
      );
    }

    component.eventForm.controls.date_time.setValue('');
    expect(component.eventForm.invalid).toBe(true);
  });

  it('should not call createEvent when required fields are missing', async () => {
    component.eventForm.patchValue({
      title: 'Test Event',
      date_time: '2026-09-01T10:00',
      location: '',
      description: '',
    });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).not.toHaveBeenCalled();
  });

  it('should emit created and dismiss with trimmed required fields on successful submit', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);

    eventsServiceSpy.createEvent.mockReturnValue(of(mockEvent));

    component.eventForm.setValue({
      title: '  Test Event  ',
      date_time: '2026-09-01T10:00',
      language_pair: 'en-es',
      category: 'audio_room',
      location: '  Zoom  ',
      max_participants: 10,
      description: '  Some description  ',
    });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledWith({
      title: 'Test Event',
      date_time: '2026-09-01T10:00',
      language_pair: 'en-es',
      category: 'audio_room',
      location: 'Zoom',
      max_participants: 10,
      description: 'Some description',
    });
    expect(createdSpy).toHaveBeenCalledTimes(1);
    expect(createdSpy).toHaveBeenCalledWith(mockEvent);
    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(component.isSubmitting()).toBe(false);
  });

  it('should keep only language pair and max participants optional', async () => {
    eventsServiceSpy.createEvent.mockReturnValue(of(mockEvent));

    component.eventForm.setValue({
      title: 'Test Event',
      date_time: '2026-09-01T10:00',
      language_pair: '',
      category: 'in_person_meetup',
      location: 'Community Centre',
      max_participants: null,
      description: 'Weekly conversation practice',
    });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledWith({
      title: 'Test Event',
      date_time: '2026-09-01T10:00',
      language_pair: undefined,
      category: 'in_person_meetup',
      location: 'Community Centre',
      max_participants: undefined,
      description: 'Weekly conversation practice',
    });
  });

  it('should suppress duplicate submissions while creation is pending', async () => {
    const request = new Subject<Event>();
    eventsServiceSpy.createEvent.mockReturnValue(request);
    component.eventForm.setValue({
      title: 'Test Event',
      date_time: '2026-09-01T10:00',
      language_pair: '',
      category: 'audio_room',
      location: 'Zoom',
      max_participants: null,
      description: 'Some description',
    });

    const firstSubmission = component.onSubmit();
    const secondSubmission = component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledTimes(1);
    expect(component.isSubmitting()).toBe(true);

    request.next(mockEvent);
    request.complete();
    await Promise.all([firstSubmission, secondSubmission]);

    expect(component.isSubmitting()).toBe(false);
  });

  it('should expose a retryable error and keep the modal open when creation fails', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);

    eventsServiceSpy.createEvent.mockReturnValue(throwError(() => new Error('creation failed')));

    component.eventForm.setValue({
      title: 'Fail Event',
      date_time: '2026-09-02T11:00',
      language_pair: 'en-fr',
      category: 'learning_seminar',
      location: 'Zoom',
      max_participants: 5,
      description: 'Will fail',
    });

    await component.onSubmit();

    expect(component.submitError()).toBe(true);
    expect(component.isSubmitting()).toBe(false);
    expect(createdSpy).not.toHaveBeenCalled();
    expect(dismissSpy).not.toHaveBeenCalled();
  });
});
