import { Test, TestingModule } from '@nestjs/testing';
import { SystemMessageService } from './system-message.service';
import { CentrifugoService } from '../centrifugo.service';

describe('SystemMessageService', () => {
  let service: SystemMessageService;
  let centrifugoService: { publish: jest.Mock };

  beforeEach(async () => {
    centrifugoService = { publish: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemMessageService,
        { provide: CentrifugoService, useValue: centrifugoService },
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
});
