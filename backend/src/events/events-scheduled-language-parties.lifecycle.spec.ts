import { EventsService } from './events.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';

interface ScheduledWorker {
  checkReminders(): Promise<void>;
  checkStartEvents(): Promise<void>;
}

function makeService(): EventsService {
  return new EventsService(
    { getClient: vi.fn() } as unknown as SupabaseService,
    { sendPushNotification: vi.fn() } as unknown as NotificationsService,
    { createLanguageParty: vi.fn() } as unknown as AudioRoomsService,
  );
}

describe('EventsService scheduled Language Party lifecycle (#1514)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts immediately, polls every 10 seconds, and stops polling on destroy', () => {
    const service = makeService();
    const worker = service as unknown as ScheduledWorker;
    const reminderSpy = vi
      .spyOn(worker, 'checkReminders')
      .mockResolvedValue(undefined);
    const scheduledSpy = vi
      .spyOn(worker, 'checkStartEvents')
      .mockResolvedValue(undefined);

    service.onModuleInit();

    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    expect(reminderSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    expect(scheduledSpy).toHaveBeenCalledTimes(4);
    expect(reminderSpy).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    vi.advanceTimersByTime(30_000);

    expect(scheduledSpy).toHaveBeenCalledTimes(4);
    expect(reminderSpy).toHaveBeenCalledTimes(1);
  });
});
