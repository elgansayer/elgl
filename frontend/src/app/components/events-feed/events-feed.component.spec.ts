import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EventsFeedComponent } from './events-feed.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('EventsFeedComponent', () => {
  let fixture: ComponentFixture<EventsFeedComponent>;
  let component: EventsFeedComponent;
  let httpTesting: HttpTestingController;

  const mockEvents = [
    {
      id: 'ev-1',
      title: 'Spanish Practice Night',
      description: 'Let us practice together',
      category: 'audio_room',
      date_time: '2026-08-15T19:00:00Z',
      location: 'Audio Room',
      host_id: 'host-1',
      host_name: 'Maria',
      host_avatar_url: null,
      language_pair: 'en-es',
      proficiency: 'Intermediate',
      is_cancelled: false,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
      attendees_count: 5,
      interested_count: 3,
    },
    {
      id: 'ev-2',
      title: 'Japanese Culture Exchange',
      category: 'cultural_exchange',
      date_time: '2026-08-20T15:00:00Z',
      host_id: 'host-2',
      host_name: 'Takeshi',
      host_avatar_url: 'https://example.com/avatar.jpg',
      language_pair: 'en-ja',
      is_cancelled: false,
      created_at: '2026-08-02T00:00:00Z',
      updated_at: '2026-08-02T00:00:00Z',
      attendees_count: 12,
      interested_count: 8,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsFeedComponent, MockTranslatePipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventsFeedComponent);
    component = fixture.componentInstance;
  });

  it('should create and load events from API', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) => r.url.includes('/events') && !r.url.includes('/rsvp'));
    req.flush(mockEvents);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeDefined();
    expect(component.events().length).toBe(2);
    expect(component.events()[0].title).toBe('Spanish Practice Night');
  });

  it('should show loading state initially', () => {
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);

    const req = httpTesting.expectOne((r) => r.url.includes('/events') && !r.url.includes('/rsvp'));
    req.flush([]);
    fixture.detectChanges();
    expect(component.isLoading()).toBe(false);
  });

  it('should show empty state when no events', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) => r.url.includes('/events') && !r.url.includes('/rsvp'));
    req.flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    const rendered = fixture.nativeElement.textContent;
    expect(rendered).toContain('events.empty_title');
  });

  it('should filter by status', async () => {
    fixture.detectChanges();
    let req = httpTesting.expectOne((r) => r.url.includes('/events'));
    req.flush(mockEvents);
    fixture.detectChanges();
    await fixture.whenStable();

    // Switch to past
    component.onStatusChange('past');
    req = httpTesting.expectOne((r) => r.url.includes('/events') && r.url.includes('status=past'));
    req.flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.status()).toBe('past');
    expect(component.events().length).toBe(0);
  });
});