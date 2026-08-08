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
        { provide: EventsService, useValue: eventsServiceSpy },
        { provide: TranslatePipe, useValue: translateStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateEventModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an empty form', () => {
    expect(component.eventForm.value).toEqual({
      title: '',
      date_time: '',
      platform_location: '',
      description: '',
    });
  });

  it('should render the modal dialog', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
  });

  it('should not call createEvent when form is invalid', () => {
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
      platform_location: 'Zoom',
      description: 'Some description',
    });

    await component.onSubmit();

    expect(eventsServiceSpy.createEvent).toHaveBeenCalledWith({
      title: 'Test Event',
      date_time: '2026-08-01T10:00',
      location: 'Zoom',
      description: 'Some description',
    });
    expect(createdSpy).toHaveBeenCalledTimes(1);
    expect(createdSpy).toHaveBeenCalledWith(mockEvent);
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it('should not emit anything when creation fails', async () => {
    const createdSpy = vi.fn();
    const dismissSpy = vi.fn();
    component.created.subscribe(createdSpy);
    component.dismiss.subscribe(dismissSpy);

    eventsServiceSpy.createEvent.mockReturnValue(
      throwError(() => new Error('creation failed')),
    );

    component.eventForm.setValue({
      title: 'Fail Event',
      date_time: '2026-08-02T11:00',
      platform_location: 'Zoom',
      description: 'Will fail',
    });

    await component.onSubmit();

    expect(createdSpy).not.toHaveBeenCalled();
    expect(dismissSpy).not.toHaveBeenCalled();
  });
});
