import { Pipe, type PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsCalendarComponent } from './events-calendar.component';
import { EventsService } from '../../services/events.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Pipe({ standalone: true, name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    if (params?.['date']) return `${key}: ${String(params['date'])}`;
    if (params?.['count'] !== undefined) return `${key}: ${String(params['count'])}`;
    return key;
  }
}

describe('EventsCalendarComponent', () => {
  let component: EventsCalendarComponent;
  let fixture: ComponentFixture<EventsCalendarComponent>;
  let mockEventsService: { getMyCalendarEvents: ReturnType<typeof vi.fn> };

  const mockI18n = {
    currentLang: vi.fn().mockReturnValue('en-GB'),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    mockEventsService = {
      getMyCalendarEvents: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [EventsCalendarComponent],
      providers: [
        provideRouter([]),
        { provide: EventsService, useValue: mockEventsService },
        { provide: I18nService, useValue: mockI18n },
      ],
    })
      .overrideComponent(EventsCalendarComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EventsCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads a bounded date range for the displayed month', () => {
    expect(mockEventsService.getMyCalendarEvents).toHaveBeenCalledTimes(1);
    const query = mockEventsService.getMyCalendarEvents.mock.calls[0][0] as {
      from_date: string;
      to_date: string;
      limit: number;
    };

    expect(query.limit).toBe(100);
    expect(Date.parse(query.from_date)).toBeLessThan(Date.parse(query.to_date));

    const month = component.monthStart();
    const from = new Date(query.from_date);
    const to = new Date(query.to_date);
    expect(from.getFullYear()).toBe(month.getFullYear());
    expect(from.getMonth()).toBe(month.getMonth());
    expect(to.getFullYear()).toBe(month.getFullYear());
    expect(to.getMonth()).toBe(month.getMonth());
  });

  it('requests a new date range when the user moves to the next month', async () => {
    const firstQuery = mockEventsService.getMyCalendarEvents.mock.calls[0][0] as {
      from_date: string;
    };

    component.nextMonth();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockEventsService.getMyCalendarEvents.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastQuery = mockEventsService.getMyCalendarEvents.mock.calls.at(-1)?.[0] as {
      from_date: string;
      limit: number;
    };
    expect(Date.parse(lastQuery.from_date)).toBeGreaterThan(Date.parse(firstQuery.from_date));
    expect(lastQuery.limit).toBe(100);
  });

  it('does not navigate before the current month in an upcoming-events calendar', () => {
    expect(component.monthOffset()).toBe(0);
    component.previousMonth();
    expect(component.monthOffset()).toBe(0);

    const previousButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(previousButton.disabled).toBe(true);
  });

  it('returns to the current month after moving forward', async () => {
    const initialMonth = component.monthStart().getMonth();
    component.nextMonth();
    expect(component.monthStart().getMonth()).toBe((initialMonth + 1) % 12);
    component.previousMonth();
    expect(component.monthStart().getMonth()).toBe(initialMonth);
  });

  it('clears the selected day when the displayed month changes', () => {
    component.selectDate(10);
    expect(component.selectedDay()).toBe(10);
    component.nextMonth();
    expect(component.selectedDay()).toBeNull();
  });

  it('selects and deselects a date while exposing persistent selection semantics', () => {
    component.selectDate(15);
    expect(component.selectedDay()).toBe(15);
    fixture.detectChanges();

    const selectedButton = Array.from(
      fixture.nativeElement.querySelectorAll('button[aria-pressed]') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim().startsWith('15'));
    expect(selectedButton?.getAttribute('aria-pressed')).toBe('true');

    component.selectDate(15);
    expect(component.selectedDay()).toBeNull();
  });

  it('renders a labelled calendar grid with native date buttons', () => {
    const grid = fixture.nativeElement.querySelector('[role="grid"]') as HTMLElement | null;
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('aria-label')).toBe(component.monthLabel());

    const dateButtons = fixture.nativeElement.querySelectorAll(
      'button[role="gridcell"][aria-pressed]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(dateButtons.length).toBeGreaterThanOrEqual(28);
    for (const button of Array.from(dateButtons)) {
      expect(button.type).toBe('button');
      expect(button.getAttribute('aria-label')).toContain('events.calendar.selectDate');
    }
  });

  it('marks today independently from the selected state', () => {
    const todayButton = fixture.nativeElement.querySelector(
      'button[aria-current="date"]',
    ) as HTMLButtonElement | null;
    expect(todayButton).not.toBeNull();
    expect(todayButton?.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps empty calendar cells non-interactive', () => {
    const emptyCells = fixture.nativeElement.querySelectorAll(
      '[role="grid"] > div[aria-hidden="true"]',
    ) as NodeListOf<HTMLDivElement>;
    expect(emptyCells.length).toBeGreaterThan(0);
    for (const cell of Array.from(emptyCells)) {
      expect(cell.getAttribute('role')).toBeNull();
      expect(cell.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('distinguishes a pending month load from an empty calendar', async () => {
    mockEventsService.getMyCalendarEvents.mockReturnValue(NEVER);
    component.retryEvents();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'common.loading',
    );
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="grid"]')).toBeNull();
  });

  it('shows a retryable unavailable state when month loading fails', async () => {
    mockEventsService.getMyCalendarEvents.mockReturnValue(
      throwError(() => new Error('private provider detail')),
    );

    component.retryEvents();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert?.textContent).toContain('common.error_generic');
    expect(alert?.textContent).not.toContain('private provider detail');
    expect(alert?.querySelector('button')?.textContent).toContain('common.retry');
  });

  it('retries the exact displayed month after an unavailable response', async () => {
    mockEventsService.getMyCalendarEvents.mockReturnValue(
      throwError(() => new Error('events provider unavailable')),
    );
    component.retryEvents();
    await fixture.whenStable();
    fixture.detectChanges();

    const range = component.monthRange();
    const eventDate = new Date(component.monthStart().getFullYear(), component.monthStart().getMonth(), 15, 12);
    mockEventsService.getMyCalendarEvents.mockReturnValue(
      of([
        {
          id: 'event-1',
          title: 'Conversation practice',
          date_time: eventDate.toISOString(),
          host_id: 'host-1',
          is_cancelled: false,
          created_at: eventDate.toISOString(),
          updated_at: eventDate.toISOString(),
        },
      ]),
    );

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockEventsService.getMyCalendarEvents).toHaveBeenLastCalledWith(range);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Conversation practice');
  });

  it('filters cancelled and malformed events defensively', async () => {
    const month = component.monthStart();
    const eventDate = new Date(month.getFullYear(), month.getMonth(), 16, 12);
    mockEventsService.getMyCalendarEvents.mockReturnValue(
      of([
        {
          id: 'cancelled',
          title: 'Cancelled event',
          date_time: eventDate.toISOString(),
          host_id: 'host-1',
          is_cancelled: true,
          created_at: eventDate.toISOString(),
          updated_at: eventDate.toISOString(),
        },
        {
          id: 'bad-date',
          title: 'Bad date',
          date_time: 'not-a-date',
          host_id: 'host-2',
          is_cancelled: false,
          created_at: eventDate.toISOString(),
          updated_at: eventDate.toISOString(),
        },
        {
          id: 'valid',
          title: 'Valid event',
          date_time: eventDate.toISOString(),
          host_id: 'host-3',
          is_cancelled: false,
          created_at: eventDate.toISOString(),
          updated_at: eventDate.toISOString(),
        },
      ]),
    );

    component.retryEvents();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.eventsByDate().get(16)?.map((event) => event.id)).toEqual(['valid']);
    expect(fixture.nativeElement.textContent).not.toContain('Cancelled event');
  });

  it('formats full local dates and event times using the active locale', () => {
    const formattedDate = component.formatCalendarDate(15);
    expect(formattedDate).toContain('15');
    expect(formattedDate).toContain(String(component.monthStart().getFullYear()));
    expect(component.formatEventTime('2026-08-15T14:30:00Z')).not.toBe('');
    expect(component.formatEventTime('not-a-date')).toBe('');
  });
});
