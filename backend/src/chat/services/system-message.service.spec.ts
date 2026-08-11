import { Test, TestingModule } from '@nestjs/testing';
import { SystemMessageService } from './system-message.service';
import { CentrifugoService } from '../centrifugo.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('SystemMessageService', () => {
  let service: SystemMessageService;
  let centrifugoService: { publish: jest.Mock };
  let supabaseService: { getClient: jest.Mock };

  const mockSupabaseClient = () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    centrifugoService = { publish: jest.fn().mockResolvedValue(true) };
    supabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemMessageService,
        { provide: CentrifugoService, useValue: centrifugoService },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<SystemMessageService>(SystemMessageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishToRoom', () => {
    it('publishes a system chat message to the room channel', async () => {
      await service.publishToRoom('room-1', 'groupRenamed', {
        name: 'Language Buddies',
      });

      expect(centrifugoService.publish).toHaveBeenCalledTimes(1);
      const [channel, payload] = centrifugoService.publish.mock.calls[0] as [
        string,
        { message: Record<string, unknown> },
      ];

      expect(channel).toBe('chat:room-1');
      expect(payload.message).toMatchObject({
        room_id: 'room-1',
        sender_id: '',
        message_type: 'system',
        is_read: false,
        system_event: { type: 'groupRenamed', name: 'Language Buddies' },
      });
      expect(typeof payload.message.id).toBe('string');
      expect(payload.message.id).toMatch(/^sys_/);
      expect(typeof payload.message.created_at).toBe('string');
    });

    it('defaults params to an empty object when none are provided', async () => {
      await service.publishToRoom('room-2', 'memberRemoved');

      const [, payload] = centrifugoService.publish.mock.calls[0] as [
        string,
        { message: Record<string, unknown> },
      ];
      expect(payload.message.system_event).toEqual({ type: 'memberRemoved' });
    });

    it('generates unique message ids across successive calls', async () => {
      await service.publishToRoom('room-1', 'memberAdded', { count: 1 });
      await service.publishToRoom('room-1', 'memberAdded', { count: 1 });

      const firstId = (
        centrifugoService.publish.mock.calls[0][1] as {
          message: { id: string };
        }
      ).message.id;
      const secondId = (
        centrifugoService.publish.mock.calls[1][1] as {
          message: { id: string };
        }
      ).message.id;

      expect(firstId).not.toBe(secondId);
    });
  });

  describe('publishToAllUserRooms', () => {
    it('publishes system events to all rooms the user belongs to', async () => {
      const client = supabaseService.getClient();
      const selectChain = {
        eq: jest.fn().mockResolvedValue({
          data: [{ room_id: 'room-a' }, { room_id: 'room-b' }],
          error: null,
        }),
      };
      client.select.mockReturnValue(selectChain);

      await service.publishToAllUserRooms('user-1', 'profileUpdated');

      expect(centrifugoService.publish).toHaveBeenCalledTimes(2);
      const channels = centrifugoService.publish.mock.calls.map(
        (c: [string, unknown]) => c[0],
      );
      expect(channels).toContain('chat:room-a');
      expect(channels).toContain('chat:room-b');
    });

    it('handles empty room list gracefully', async () => {
      const client = supabaseService.getClient();
      const selectChain = {
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      client.select.mockReturnValue(selectChain);

      await service.publishToAllUserRooms('user-1', 'profileUpdated');
      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });
  });

  describe('publishToDirectRoom', () => {
    it('publishes a system event to the 1-on-1 room between two users', async () => {
      const client = supabaseService.getClient();

      // First call: get rooms for userA
      const selectChainA = {
        eq: jest.fn().mockResolvedValue({
          data: [{ room_id: 'dm-1' }, { room_id: 'group-1' }],
          error: null,
        }),
      };
      // Second call: get mutual rooms for userB
      const selectChainB = {
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ room_id: 'dm-1' }, { room_id: 'group-1' }],
          error: null,
        }),
      };
      // Third call: count members for candidate room (2 = 1-on-1)
      const selectChainCount = {
        eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
      };

      let callIndex = 0;
      client.select.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return selectChainA;
        if (callIndex === 2) return selectChainB;
        return selectChainCount;
      });

      await service.publishToDirectRoom('user-a', 'user-b', 'missedCall');

      expect(centrifugoService.publish).toHaveBeenCalledTimes(1);
      const [channel] = centrifugoService.publish.mock.calls[0] as [
        string,
        unknown,
      ];
      expect(channel).toBe('chat:dm-1');
    });

    it('skips publishing when no mutual room exists', async () => {
      const client = supabaseService.getClient();

      const selectChainA = {
        eq: jest.fn().mockResolvedValue({
          data: [{ room_id: 'dm-1' }],
          error: null,
        }),
      };
      const selectChainB = {
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callIndex = 0;
      client.select.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return selectChainA;
        return selectChainB;
      });

      await service.publishToDirectRoom('user-a', 'user-b', 'missedCall');
      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });
  });
});
