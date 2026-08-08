import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';

describe('EventsService', () => {
  let service: EventsService;
  let supabaseService: { getClient: jest.Mock };
  let notificationsService: jest.Mocked<NotificationsService>;
  let audioRoomsService: jest.Mocked<AudioRoomsService>;

  beforeEach(async () => {
    supabaseService = {
      getClient: jest.fn(),
    };

    notificationsService = {
      sendPushNotification: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    audioRoomsService = {
      createRoom: jest.fn(),
    } as unknown as jest.Mocked<AudioRoomsService>;

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
    it('should create an event successfully', async () => {
      const mockEvent = {
        title: 'Test Event',
        description: 'Test Description',
        date_time: new Date().toISOString(),
      };
      const mockUserId = 'user123';
      const mockResponse = { id: 'event123', ...mockEvent };

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockResponse }),
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
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({ data: mockEvents }),
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
        from: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockRsvp }),
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
        from: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
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
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: mockRsvp }),
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
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null }),
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

      const createCountQuery = (result: { count: number }) => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: result.count }),
          }),
        }),
      });

      const mockClient = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'events') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest
                    .fn()
                    .mockResolvedValue({ data: mockEvent, error: null }),
                }),
              }),
            };
          }
          if (table === 'event_rsvps') {
            let callCount = 0;
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockImplementation(() => {
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
          return { select: jest.fn() };
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
