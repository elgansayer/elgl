import type { Mock, Mocked } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';

describe('EventsService', () => {
  let service: EventsService;
  let supabaseService: { getClient: Mock };
  let notificationsService: Mocked<NotificationsService>;
  let audioRoomsService: Mocked<AudioRoomsService>;

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn(),
    };

    notificationsService = {
      sendPushNotification: vi.fn(),
    } as unknown as Mocked<NotificationsService>;

    audioRoomsService = {
      createRoom: vi.fn(),
    } as unknown as Mocked<AudioRoomsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AudioRoomsService, useValue: audioRoomsService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('event reminders', () => {
    const reminderService = () =>
      service as unknown as { checkReminders(): Promise<void> };

    function createReminderClient(claims: unknown[], rpcError: unknown = null) {
      const finalizeEq = vi.fn().mockResolvedValue({ error: null });
      const finalizeIn = vi.fn().mockReturnValue({ eq: finalizeEq });
      const update = vi.fn().mockReturnValue({ in: finalizeIn });
      const from = vi.fn().mockReturnValue({ update });
      const rpc = vi.fn().mockResolvedValue({ data: claims, error: rpcError });
      return { rpc, from, update, finalizeIn, finalizeEq };
    }

    it('atomically claims and sends a due reminder with an event deep link', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-23T10:00:00.000Z'));
      const client = createReminderClient([
        {
          reminder_id: 'reminder-1',
          event_id: 'event-1',
          user_id: 'user-1',
          event_title: '  Spanish   Learning Event  ',
          event_date_time: '2026-08-23T10:15:00.000Z',
          attempt_count: 1,
        },
      ]);
      supabaseService.getClient.mockReturnValue(client);
      notificationsService.sendPushNotification.mockResolvedValue(undefined);

      await reminderService().checkReminders();

      expect(client.rpc).toHaveBeenCalledWith('claim_due_event_reminders', {
        p_now: '2026-08-23T10:00:00.000Z',
        p_limit: 200,
        p_lease_seconds: 120,
      });
      expect(notificationsService.sendPushNotification).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'event_reminder',
          title: 'Event Reminder: Spanish Learning Event',
          body: 'Your event "Spanish Learning Event" starts in 15 minutes.',
          category: 'groups',
          data: {
            eventId: 'event-1',
            route: '/events/event-1',
            startsAt: '2026-08-23T10:15:00.000Z',
          },
        }),
      );
      expect(client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          claimed_at: null,
          next_attempt_at: null,
        }),
      );
      expect(client.finalizeIn).toHaveBeenCalledWith('id', ['reminder-1']);
    });

    it('releases failed dispatches for a bounded retry instead of marking them sent', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-23T10:00:00.000Z'));
      const client = createReminderClient([
        {
          reminder_id: 'reminder-2',
          event_id: 'event-2',
          user_id: 'user-2',
          event_title: 'Conversation Club',
          event_date_time: '2026-08-23T10:08:00.000Z',
          attempt_count: 2,
        },
      ]);
      supabaseService.getClient.mockReturnValue(client);
      notificationsService.sendPushNotification.mockRejectedValueOnce(
        new Error('provider unavailable'),
      );

      await reminderService().checkReminders();

      expect(client.update).toHaveBeenCalledTimes(1);
      expect(client.update).toHaveBeenCalledWith({
        claimed_at: null,
        next_attempt_at: '2026-08-23T10:01:00.000Z',
        updated_at: '2026-08-23T10:00:00.000Z',
      });
      expect(client.finalizeIn).toHaveBeenCalledWith('id', ['reminder-2']);
    });

    it('ignores malformed claim rows rather than sending untrusted reminder data', async () => {
      const client = createReminderClient([
        {
          reminder_id: 'reminder-bad',
          event_id: 'event-bad',
          user_id: 'user-bad',
          event_title: 'Bad event',
          event_date_time: 'not-a-date',
          attempt_count: 1,
        },
      ]);
      supabaseService.getClient.mockReturnValue(client);

      await reminderService().checkReminders();

      expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
      expect(client.update).not.toHaveBeenCalled();
    });

    it('fails the scheduler tick closed when the claim RPC is unavailable', async () => {
      const client = createReminderClient([], { message: 'database unavailable' });
      supabaseService.getClient.mockReturnValue(client);

      await expect(reminderService().checkReminders()).resolves.toBeUndefined();
      expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
      expect(client.from).not.toHaveBeenCalled();
    });

    it('bounds and sanitizes long event titles before they reach push payloads', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-23T10:00:00.000Z'));
      const client = createReminderClient([
        {
          reminder_id: 'reminder-3',
          event_id: 'event-3',
          user_id: 'user-3',
          event_title: `   ${'a'.repeat(100)}   `,
          event_date_time: '2026-08-23T10:05:00.000Z',
          attempt_count: 1,
        },
      ]);
      supabaseService.getClient.mockReturnValue(client);
      notificationsService.sendPushNotification.mockResolvedValue(undefined);

      await reminderService().checkReminders();

      expect(notificationsService.sendPushNotification).toHaveBeenCalledWith(
        'user-3',
        expect.objectContaining({
          title: `Event Reminder: ${'a'.repeat(80)}`,
          body: `Your event "${'a'.repeat(80)}" starts in 5 minutes.`,
        }),
      );
    });
  });

  describe('createEvent', () => {
    it('should create an event successfully', async () => {
      const mockEvent = {
        title: 'Test Event',
        description: 'Test Description',
        date_time: new Date().toISOString(),
      };
      const mockUserId = 'user123';
      const mockResponse = { id: 'event123', ...mockEvent };

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockResponse }),
            }),
          }),
        }),
      });

      const result = await service.createEvent(mockUserId, mockEvent);
      expect(result).toEqual(mockResponse);
      expect(supabaseService.getClient).toHaveBeenCalled();
    });
  });

  describe('listEvents', () => {
    it('should list events successfully', async () => {
      const mockEvents = [
        { id: 'event1', title: 'Event 1' },
        { id: 'event2', title: 'Event 2' },
      ];

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: mockEvents }),
              }),
            }),
          }),
        }),
      });

      const result = await service.listEvents('user123', {
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(
        mockEvents.map((ev) => ({
          ...ev,
          host_name: null,
          host_avatar_url: null,
        })),
      );
      expect(supabaseService.getClient).toHaveBeenCalled();
    });
  });

  describe('createRsvp', () => {
    it('should create an RSVP successfully', async () => {
      const mockRsvp = {
        event_id: 'event1',
        user_id: 'user123',
        status: 'attending',
      };

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRsvp }),
            }),
          }),
        }),
      });

      const result = await service.createRsvp('user123', 'event1', 'attending');
      expect(result).toEqual(mockRsvp);
    });
  });

  describe('removeRsvp', () => {
    it('should remove an RSVP successfully', async () => {
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      });

      const result = await service.removeRsvp('user123', 'event1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getUserRsvp', () => {
    it('should return RSVP if found', async () => {
      const mockRsvp = {
        event_id: 'event1',
        user_id: 'user123',
        status: 'attending',
      };

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockRsvp }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getUserRsvp('user123', 'event1');
      expect(result).toEqual(mockRsvp);
    });

    it('should return null if no RSVP found', async () => {
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getUserRsvp('user123', 'event1');
      expect(result).toBeNull();
    });
  });

  describe('getEvent', () => {
    it('should return event with attendees and interested counts', async () => {
      const mockEvent = {
        id: 'event1',
        title: 'Test Event',
        host_id: 'host123',
        host: { display_name: 'Host Name', avatar_url: 'https://avatar.url' },
      };

      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'events') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockEvent, error: null }),
                }),
              }),
            };
          }
          if (table === 'event_rsvps') {
            let callCount = 0;
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                      return Promise.resolve({ count: 5 });
                    }
                    return Promise.resolve({ count: 3 });
                  }),
                }),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient);

      const result = await service.getEvent('event1');
      expect(result).toHaveProperty('id', 'event1');
      expect(result).toHaveProperty('host_name');
      expect(result).toHaveProperty('attendees_count');
      expect(result).toHaveProperty('interested_count');
    });
  });

  describe('getCategories', () => {
    it('should return the four event categories', () => {
      const categories = service.getCategories();
      expect(categories).toContain('audio_room');
      expect(categories).toContain('learning_seminar');
      expect(categories).toContain('in_person_meetup');
      expect(categories).toContain('cultural_exchange');
    });
  });
});
