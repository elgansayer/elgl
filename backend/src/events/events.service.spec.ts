import type { Mock, Mocked } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
    it('upserts the RSVP so status switches are atomic and idempotent', async () => {
      const mockRsvp = {
        event_id: 'event1',
        user_id: 'user123',
        status: 'attending',
      };
      const upsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockRsvp, error: null }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert }),
      });

      const result = await service.createRsvp('user123', 'event1', 'attending');

      expect(result).toEqual(mockRsvp);
      expect(upsert).toHaveBeenCalledWith(
        { event_id: 'event1', user_id: 'user123', status: 'attending' },
        { onConflict: 'event_id,user_id' },
      );
    });

    it('maps a capacity rejection to HTTP 409 without leaking database details', async () => {
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'event_full', code: 'P0001', details: 'private' },
              }),
            }),
          }),
        }),
      });

      await expect(service.createRsvp('user123', 'event1', 'attending')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it.each([
      ['event_cancelled', BadRequestException],
      ['event_started', BadRequestException],
      ['event_not_found', NotFoundException],
    ])('maps %s to a stable API error', async (message, expectedError) => {
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message, code: 'P0001' } }),
            }),
          }),
        }),
      });

      await expect(service.createRsvp('user123', 'event1', 'interested')).rejects.toBeInstanceOf(
        expectedError,
      );
    });

    it('fails closed with a generic server error for unexpected database failures', async () => {
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'sensitive database message', code: 'XX000' },
              }),
            }),
          }),
        }),
      });

      await expect(service.createRsvp('user123', 'event1', 'attending')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('getRsvpSummaries', () => {
    it('returns aggregate counts and the current viewer status without identities', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: [
          {
            event_id: 'event1',
            attending_count: '7',
            interested_count: 3,
            viewer_status: 'interested',
          },
          {
            event_id: 'event2',
            attending_count: 0,
            interested_count: 1,
            viewer_status: 'unexpected',
          },
        ],
        error: null,
      });
      supabaseService.getClient.mockReturnValue({ rpc });

      const result = await service.getRsvpSummaries('user123', ['event1', 'event2', 'event1']);

      expect(rpc).toHaveBeenCalledWith('get_event_rsvp_summaries', {
        p_user_id: 'user123',
        p_event_ids: ['event1', 'event2'],
      });
      expect(result).toEqual([
        {
          event_id: 'event1',
          attending_count: 7,
          interested_count: 3,
          viewer_status: 'interested',
        },
        {
          event_id: 'event2',
          attending_count: 0,
          interested_count: 1,
          viewer_status: null,
        },
      ]);
      expect(result[0]).not.toHaveProperty('user_id');
    });

    it('returns immediately for an empty event list', async () => {
      const rpc = vi.fn();
      supabaseService.getClient.mockReturnValue({ rpc });

      await expect(service.getRsvpSummaries('user123', [])).resolves.toEqual([]);
      expect(rpc).not.toHaveBeenCalled();
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
                  single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
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
                    if (callCount === 1) return Promise.resolve({ count: 5 });
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
