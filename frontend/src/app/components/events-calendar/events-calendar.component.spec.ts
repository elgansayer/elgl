import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { EventsCalendarComponent } from './events-calendar.component';
import { EventsService } from '../../services/events.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({ standalone: true, name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    if (params?.['date']) {
      return `${key}: ${String(params['date'])}`;
    }
    return key;
  }
}

describe('EventsCalendarComponent', () => {
  let component: EventsCalendarComponent;
  let fixture: ComponentFixture<EventsCalendarComponent>;
  let mockEventsService: { getMyEvents: ReturnType<typeof vi.fn> };
  const mockI18n = {
    currentLang: vi.fn().mockReturnValue('en-GB'),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    mockEventsService = {
      getMyEvents: vi.fn().mockReturnValue(of([])),
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should request the authenticated upcoming-events collection', () => {
    expect(mockEventsService.getMyEvents).toHaveBeenCalledWith('upcoming');
  });

  it('should render month label', () => {
    const label = component.monthLabel();
    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
  });

  it('should generate correct number of calendar cells', () => {
    const days = component.days();
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(28);
  });

  it('should navigate between months', () => {
    const initialMonth = component.monthStart().getMonth();
    component.nextMonth();
    expect(component.monthStart().getMonth()).toBe((initialMonth + 1) % 12);
    component.previousMonth();
    expect(component.monthStart().getMonth()).toBe(initialMonth);
  });

  it('should select and deselect a date on click', () => {
    component.selectDate(15);
    expect(component.selectedDay()).toBe(15);
    component.selectDate(15);
    expect(component.selectedDay()).toBeNull();
  });

  it('should not select null day', () => {
    component.selectDate(null);
    expect(component.selectedDay()).toBeNull();
  });

  it('should return false for isToday with null day', () => {
    expect(component.isToday(null)).toBe(false);
  });

  it('should format event time', () => {
    const formatted = component.formatEventTime('2026-08-15T14:30:00Z');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('should format calendar dates with full localised context', () => {
    const formatted = component.formatCalendarDate(15);
    expect(formatted).toContain('15');
    expect(formatted).toContain(String(component.monthStart().getFullYear()));
  });

  it('should clear selected day when changing months', () => {
    component.selectDate(10);
    expect(component.selectedDay()).toBe(10);
    component.nextMonth();
    expect(component.selectedDay()).toBeNull();
    component.selectDate(20);
    component.previousMonth();
    expect(component.selectedDay()).toBeNull();
  });

  it('should provide localised day names', () => {
    const names = component.dayNames();
    expect(names).toHaveLength(7);
    for (const name of names) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('should distinguish a pending load from a genuinely empty calendar', async () => {
    mockEventsService.getMyEvents.mockReturnValue(NEVER);

    component.retryEvents();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'common.loading',
    );
    expect(fixture.nativeElement.querySelectorAll('button[aria-pressed]')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('should expose an unavailable state instead of presenting a failed load as empty', async () => {
    mockEventsService.getMyEvents.mockReturnValue(
      throwError(() => new Error('events provider unavailable')),
    );

    component.retryEvents();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert?.textContent).toContain('common.error_generic');
    expect(alert?.querySelector('button')?.textContent).toContain('common.retry');
    expect(fixture.nativeElement.querySelectorAll('button[aria-pressed]')).toHaveLength(0);
  });

  it('should retry a failed upcoming-events load and restore the calendar', async () => {
    mockEventsService.getMyEvents.mockReturnValue(
      throwError(() => new Error('events provider unavailable')),
    );
    component.retryEvents();
    await fixture.whenStable();
    fixture.detectChanges();

    const month = component.monthStart();
    const eventDate = new Date(month.getFullYear(), month.getMonth(), 15, 12, 0, 0);
    mockEventsService.getMyEvents.mockReturnValue(
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

    const retryButton = fixture.nativeElement.querySelector('[role="alert"] button') as
      | HTMLButtonElement
      | null;
    expect(retryButton).not.toBeNull();
    retryButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockEventsService.getMyEvents).toHaveBeenLastCalledWith('upcoming');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('button[aria-pressed]').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).toContain('Conversation practice');
  });

  it('should use native buttons for selectable dates without hand-rolled button semantics', () => {
    const dateButtons = fixture.nativeElement.querySelectorAll(
      'button[aria-pressed]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(dateButtons.length).toBeGreaterThanOrEqual(28);
    expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();

    for (const button of Array.from(dateButtons)) {
      expect(button.type).toBe('button');
      expect(button.hasAttribute('tabindex')).toBe(false);
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('should render empty calendar cells as non-interactive content', () => {
    const emptyCells = fixture.nativeElement.querySelectorAll(
      '.grid-cols-7 > div[aria-hidden="true"]',
    ) as NodeListOf<HTMLDivElement>;
    expect(emptyCells.length).toBeGreaterThan(0);
    for (const cell of Array.from(emptyCells)) {
      expect(cell.getAttribute('role')).toBeNull();
      expect(cell.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('should expose selected date state through aria-pressed', () => {
    const dateButtons = fixture.nativeElement.querySelectorAll(
      'button[aria-pressed]',
    ) as NodeListOf<HTMLButtonElement>;
    const day15 = Array.from(dateButtons).find((button) => button.textContent?.trim() === '15');

    expect(day15).toBeDefined();
    day15?.click();
    fixture.detectChanges();

    expect(component.selectedDay()).toBe(15);
    expect(day15?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should expose today independently from selected state', () => {
    const todayButton = fixture.nativeElement.querySelector(
      'button[aria-current="date"]',
    ) as HTMLButtonElement | null;
    expect(todayButton).not.toBeNull();
    expect(todayButton?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should keep month navigation on explicit Spartan buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const monthButtons = Array.from(buttons).slice(0, 2);
    expect(monthButtons).toHaveLength(2);
    for (const button of monthButtons) {
      expect(button.type).toBe('button');
      expect(button.getAttribute('data-slot')).toBe('button');
    }
  });
});
