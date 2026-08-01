import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';

describe('EventsService', () => {
  let service: EventsService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let audioRoomsService: jest.Mocked<AudioRoomsService>;

  beforeEach(async () => {
    supabaseService = {
      getClient: jest.fn(),
    } as unknown as jest.Mocked<SupabaseService>;

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

  // Additional tests for other methods can be added here
});
