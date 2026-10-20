import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationPreferences } from './interfaces/notification-preferences.interface';
import { NotificationPreferencesService } from './notification-preferences.service';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  const category = () => ({
    push: true,
    email: true,
    in_app: true,
    badges: true,
  });

  const preferences = (
    overrides: Partial<NotificationPreferences> = {},
  ): NotificationPreferences => ({
    userId: 'user-1',
    new_message: category(),
    call_invite: category(),
    moment_like: category(),
    moment_comment: category(),
    correction: category(),
    gift: category(),
    profile_view: category(),
    study_reminder: category(),
    friend_request: category(),
    audio_room_invite: category(),
    new_follower: category(),
    do_not_disturb: false,
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    const supabaseService = {
      getClient: vi.fn().mockReturnValue({}),
    } as unknown as SupabaseService;
    service = new NotificationPreferencesService(supabaseService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suppresses interruptive delivery immediately when manual DND is enabled', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(
      preferences({ do_not_disturb: true }),
    );

    await expect(
      service.shouldSendNotification('user-1', 'new_message', 'push'),
    ).resolves.toBe(false);
    await expect(
      service.shouldSendNotification('user-1', 'new_message', 'email'),
    ).resolves.toBe(false);
  });

  it('keeps the in-app inbox available during manual DND', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(
      preferences({ do_not_disturb: true }),
    );

    await expect(
      service.shouldSendNotification('user-1', 'new_message', 'in_app'),
    ).resolves.toBe(true);
  });

  it('evaluates scheduled quiet hours in the configured IANA timezone across DST', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(
      preferences({
        quiet_hours_start: '01:00',
        quiet_hours_end: '03:00',
        quiet_hours_timezone: 'Europe/London',
      }),
    );

    await expect(
      service.shouldSendNotification(
        'user-1',
        'new_message',
        'push',
        new Date('2026-03-29T01:30:00.000Z'),
      ),
    ).resolves.toBe(false);

    await expect(
      service.shouldSendNotification(
        'user-1',
        'new_message',
        'push',
        new Date('2026-10-25T01:30:00.000Z'),
      ),
    ).resolves.toBe(false);
  });

  it('handles overnight schedules with an inclusive start and exclusive end', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(
      preferences({
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        quiet_hours_timezone: 'UTC',
      }),
    );

    await expect(
      service.shouldSendNotification(
        'user-1',
        'new_message',
        'push',
        new Date('2026-01-01T22:00:00.000Z'),
      ),
    ).resolves.toBe(false);
    await expect(
      service.shouldSendNotification(
        'user-1',
        'new_message',
        'push',
        new Date('2026-01-02T06:59:00.000Z'),
      ),
    ).resolves.toBe(false);
    await expect(
      service.shouldSendNotification(
        'user-1',
        'new_message',
        'push',
        new Date('2026-01-02T07:00:00.000Z'),
      ),
    ).resolves.toBe(true);
  });

  it('falls back to UTC for a corrupt legacy timezone instead of failing delivery evaluation', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(
      preferences({
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        quiet_hours_timezone: 'not/a-timezone',
      }),
    );

    await expect(
      service.shouldSendNotification(
        'user-1',
        'new_message',
        'push',
        new Date('2026-01-01T23:00:00.000Z'),
      ),
    ).resolves.toBe(false);
  });

  it('rejects an unpaired quiet-hours update', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(preferences());

    await expect(
      service.updatePreferences('user-1', {
        quiet_hours_start: '22:00',
        quiet_hours_end: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects impossible 24-hour times even when the service is called directly', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(preferences());

    await expect(
      service.updatePreferences('user-1', {
        quiet_hours_start: '99:99',
        quiet_hours_end: '07:00',
        quiet_hours_timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an ambiguous all-day start-equals-end schedule', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(preferences());

    await expect(
      service.updatePreferences('user-1', {
        quiet_hours_start: '22:00',
        quiet_hours_end: '22:00',
        quiet_hours_timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid IANA timezone when a schedule is saved', async () => {
    vi.spyOn(service, 'getPreferences').mockResolvedValue(preferences());

    await expect(
      service.updatePreferences('user-1', {
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        quiet_hours_timezone: 'Mars/Olympus_Mons',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
