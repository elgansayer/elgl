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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEvent', () => {
    it('should create an event successfully without persisting request-only venue metadata', async () => {
      const mockEvent = {
        title: 'Test Event',
        description: 'Test Description',
        category: 'learning_seminar',
        date_time: '2099-08-21T12:00:00.000Z',
        venue_type: 'zoom' as const,
        location: 'https://example.zoom.us/j/123',
        timezone: 'Europe/London',
        language_pair: 'en-ja',
        max_participants: 20,
      };
      const mockUserId = 'user123';
      const mockResponse = { id: 'event123', ...mockEvent };
      const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockResponse }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      });

      const result = await service.createEvent(mockUserId, mockEvent);
      expect(result).toEqual(mockResponse);
      expect(insert).toHaveBeenCalledWith({
        title: 'Test Event',
        description: 'Test Description',
        category: 'learning_seminar',
        date_time: '2099-08-21T12:00:00.000Z',
        location: 'https://example.zoom.us/j/123',
        language_pair: 'en-ja',
        max_participants: 20,
        host_id: mockUserId,
      });
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
      expect(result).toEqual(null);
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
