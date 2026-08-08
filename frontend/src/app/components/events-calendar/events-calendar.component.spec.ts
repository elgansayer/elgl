import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EventsCalendarComponent } from './events-calendar.component';
import { EventsService, type Event } from '../../services/events.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppCardComponent } from '../primitives/card/card.component';
import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({ standalone: true, name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    if (params) {
      return key.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? ''));
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

  const createEvent = (overrides: Partial<Event> = {}): Event => ({
    id: 'ev-1',
    title: 'Test Event',
    description: 'A test event',
    category: 'Audio Rooms',
    date_time: '2026-08-15T14:00:00Z',
    location: 'Audio Room',
    host_id: 'host-1',
    host_name: 'Test Host',
    host_avatar_url: null,
    language_pair: 'en-es',
    max_participants: 10,
    is_cancelled: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    participants_count: 5,
    ...overrides,
  });

  beforeEach(async () => {
    mockEventsService = {
      getMyEvents: vi.fn().mockReturnValue({
        toPromise: vi.fn(),
        subscribe: vi.fn(),
        pipe: vi.fn(),
        source: undefined,
        operator: undefined,
        lift: vi.fn(),
        forEach: vi.fn(),
      }),
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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
});