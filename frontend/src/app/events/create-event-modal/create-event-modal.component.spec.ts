import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
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
    date_time: '2026-08-01T10:00:00Z',
    location: 'Zoom',
    description: 'Some description',
    host_id: 'user-1',
    is_cancelled: false,
    created_at: '2026-08-01T09:00:00Z',
    updated_at: '2026-08-01T09:00:00Z',
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
  });

  it('should not call createEvent when form is invalid (missing title)', () => {
    component.eventForm.patchValue({ title: '', date_time: '' });
    component.onSubmit();
    expect(eventsServiceSpy.createEvent).not.toHaveBeenCalled();
  });

  it('should emit created and dismiss on successful submit', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);

    eventsServiceSpy.createEvent.mockReturnValue(of(mockEvent));

    component.eventForm.setValue({
      title: 'Test Event',
      date_time: '2026-08-01T10:00',
      language_pair: 'en-es',
      category: 'audio_room',
      location: 'Zoom',
      max_participants: 10,
      description: 'Some description',
    });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledWith({
      title: 'Test Event',
      date_time: '2026-08-01T10:00',
      language_pair: 'en-es',
      category: 'audio_room',
      location: 'Zoom',
      max_participants: 10,
      description: 'Some description',
    });
    expect(createdSpy).toHaveBeenCalledTimes(1);
    expect(createdSpy).toHaveBeenCalledWith(mockEvent);
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it('should send undefined for empty optional fields', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);

    eventsServiceSpy.createEvent.mockReturnValue(of(mockEvent));

    component.eventForm.setValue({
      title: 'Test Event',
      date_time: '2026-08-01T10:00',
      language_pair: '',
      category: 'audio_room',
      location: '',
      max_participants: null,
      description: '',
    });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledWith({
      title: 'Test Event',
      date_time: '2026-08-01T10:00',
      language_pair: undefined,
      category: 'audio_room',
      location: undefined,
      max_participants: undefined,
      description: undefined,
    });
  });

  it('should not emit anything when creation fails', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error');
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);

    eventsServiceSpy.createEvent.mockReturnValue(
      throwError(() => new Error('creation failed')),
    );

    component.eventForm.setValue({
      title: 'Fail Event',
      date_time: '2026-08-02T11:00',
      language_pair: 'en-fr',
      category: 'learning_seminar',
      location: 'Zoom',
      max_participants: 5,
      description: 'Will fail',
    });

    await component.onSubmit();

    expect(consoleSpy).toHaveBeenCalled();
    expect(createdSpy).not.toHaveBeenCalled();
    expect(dismissSpy).not.toHaveBeenCalled();
  });
});
