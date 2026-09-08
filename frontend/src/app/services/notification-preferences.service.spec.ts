import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationPreferencesService } from './notification-preferences.service';

describe('NotificationPreferencesService legacy settings', () => {
  let service: NotificationPreferencesService;
  let http: HttpTestingController;

  const preferences = {
    userId: 'user-1',
    direct_messages: { push: true, badge: false },
    groups: { push: false, badge: true },
    likes: { push: true, badge: true },
    voice_rooms: { push: false, badge: false },
    do_not_disturb: false,
    updatedAt: '2026-08-27T07:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationPreferencesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('accepts a complete authenticated legacy preference response', async () => {
    const promise = service.getLegacyPreferences();
    const request = http.expectOne('/api/notifications/preferences');
    expect(request.request.method).toBe('GET');
    request.flush(preferences);

    await expect(promise).resolves.toEqual(preferences);
  });

  it('fails closed when a category response is malformed', async () => {
    const promise = service.getLegacyPreferences();
    const request = http.expectOne('/api/notifications/preferences');
    request.flush({
      ...preferences,
      groups: { push: 'yes', badge: true },
    });

    await expect(promise).rejects.toThrow('Invalid notification preferences response');
  });

  it('fails closed when an update does not confirm success', async () => {
    const promise = service.updateLegacyPreferences({
      likes: { push: false, badge: true },
    });
    const request = http.expectOne('/api/notifications/preferences');
    expect(request.request.method).toBe('PUT');
    request.flush({ success: false, preferences });

    await expect(promise).rejects.toThrow('Invalid notification preference update response');
  });

  it('returns only a validated server-confirmed update', async () => {
    const updated = {
      ...preferences,
      likes: { push: false, badge: true },
    };
    const promise = service.updateLegacyPreferences({
      likes: { push: false, badge: true },
    });
    const request = http.expectOne('/api/notifications/preferences');
    expect(request.request.body).toEqual({
      likes: { push: false, badge: true },
    });
    request.flush({ success: true, preferences: updated });

    await expect(promise).resolves.toEqual({ success: true, preferences: updated });
  });
});
