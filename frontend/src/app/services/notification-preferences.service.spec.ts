import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import {
  NotificationPreferences,
  NotificationPreferencesService,
} from './notification-preferences.service';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let http: HttpTestingController;

  const channel = {
    push: true,
    email: false,
    in_app: true,
    badges: true,
  };
  const preferences: NotificationPreferences = {
    userId: 'user-1',
    new_message: channel,
    call_invite: channel,
    moment_like: channel,
    moment_comment: channel,
    correction: channel,
    gift: channel,
    profile_view: { ...channel, push: false },
    study_reminder: { ...channel, email: true },
    friend_request: channel,
    audio_room_invite: channel,
    new_follower: channel,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    quiet_hours_timezone: 'Europe/London',
    do_not_disturb: false,
    updatedAt: '2026-11-14T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationPreferencesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the rich preference contract', async () => {
    const promise = service.getPreferences();
    const request = http.expectOne(
      `${environment.apiUrl}/notification-preferences`,
    );
    expect(request.request.method).toBe('GET');
    request.flush(preferences);

    await expect(promise).resolves.toEqual(preferences);
  });

  it('returns the server document from a PUT rather than an envelope', async () => {
    const promise = service.updatePreferences({
      moment_like: { push: false },
    });
    const request = http.expectOne(
      `${environment.apiUrl}/notification-preferences`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ moment_like: { push: false } });
    request.flush({ ...preferences, moment_like: { ...channel, push: false } });

    await expect(promise).resolves.toMatchObject({
      userId: 'user-1',
      moment_like: { push: false },
    });
  });

  it('toggles one channel while preserving the sibling channels', async () => {
    const promise = service.toggleCategoryChannel(
      'moment_like',
      'email',
      true,
      preferences,
    );
    const request = http.expectOne(
      `${environment.apiUrl}/notification-preferences`,
    );
    expect(request.request.body).toEqual({
      moment_like: { push: true, email: true, in_app: true, badges: true },
    });
    request.flush(preferences);

    await expect(promise).resolves.toEqual(preferences);
  });

  it('sends quiet-hour values with the DND toggle', async () => {
    const promise = service.toggleDoNotDisturb(true, '21:30', '');
    const request = http.expectOne(
      `${environment.apiUrl}/notification-preferences`,
    );
    expect(request.request.body).toEqual({
      do_not_disturb: true,
      quiet_hours_start: '21:30',
      quiet_hours_end: null,
    });
    request.flush(preferences);

    await expect(promise).resolves.toEqual(preferences);
  });

  it('resets through the dedicated reset action', async () => {
    const promise = service.resetToDefaults();
    const request = http.expectOne(
      `${environment.apiUrl}/notification-preferences/reset`,
    );
    expect(request.request.method).toBe('POST');
    request.flush(preferences);

    await expect(promise).resolves.toEqual(preferences);
  });

  it('never calls the removed legacy or users preference contracts', async () => {
    service.getPreferences().catch(() => undefined);
    http
      .expectOne(`${environment.apiUrl}/notification-preferences`)
      .flush(preferences);

    http.expectNone('/api/notifications/preferences');
    http.expectNone('/api/users/me/notification-preferences');
  });
});
