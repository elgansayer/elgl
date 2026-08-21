import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { CallsService } from './calls.service';

describe('CallsService', () => {
  let service: CallsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CallsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              const map: Record<string, string> = {
                LIVEKIT_URL: 'http://localhost:7880',
                LIVEKIT_API_KEY: 'devkey',
                LIVEKIT_SECRET: 'secret',
              };
              return map[key];
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: vi.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(CallsService);
  });

  it('should throw BadRequestException when participant_limit is less than 2', async () => {
    await expect(
      service.createGroupCall('caller', ['A', 'B'], 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when participant count exceeds the limit', async () => {
    await expect(
      service.createGroupCall('caller', ['A', 'B'], 2),
    ).rejects.toThrow(BadRequestException);
  });

  describe('call waiting and switching', () => {
    function ensureActive(userId: string, roomName: string): void {
      const active = (service as any).activeCalls as Map<
        string,
        Map<
          string,
          {
            roomName: string;
            isHeld: boolean;
            e2eeKey: string | null;
            participantLimit: number | null;
            isGroup: boolean;
          }
        >
      >;
      if (!active.has(userId)) {
        active.set(userId, new Map());
      }
      const userCalls = active.get(userId)!;
      userCalls.set(roomName, {
        roomName,
        isHeld: false,
        e2eeKey: null,
        participantLimit: null,
        isGroup: false,
      });
    }

    function ensureWaiting(userId: string, roomName: string): void {
      const waiting = (service as any).waitingCalls as Map<
        string,
        Array<{
          roomName: string;
          calleeToken: string;
          e2eeKey: string;
          isVideo: boolean;
        }>
      >;
      if (!waiting.has(userId)) {
        waiting.set(userId, []);
      }
      waiting.get(userId)!.push({
        roomName,
        calleeToken: 'callee-token',
        e2eeKey: 'e2ee-key',
        isVideo: true,
      });
    }

    it('should hold the current call and activate the waiting call when switching', () => {
      ensureActive('user-a', 'call-current');
      ensureWaiting('user-a', 'call-waiting');

      const result = service.switchCall(
        'user-a',
        'call-current',
        'call-waiting',
      );

      expect(result.success).toBe(true);
      expect(result.room_name).toBe('call-waiting');
      expect(result.held_call_room_name).toBe('call-current');

      const active = (service as any).activeCalls.get('user-a');
      expect(active.get('call-current').isHeld).toBe(true);
      expect(active.has('call-waiting')).toBe(true);
      expect(active.get('call-waiting').isHeld).toBe(false);
    });

    it('should throw BadRequestException when switching to the same room', () => {
      ensureActive('user-a', 'call-current');
      ensureWaiting('user-a', 'call-current');

      expect(() =>
        service.switchCall('user-a', 'call-current', 'call-current'),
      ).toThrow(BadRequestException);
    });

    it('should put current calls on hold when accepting a waiting call', () => {
      ensureActive('user-b', 'call-ongoing');
      ensureWaiting('user-b', 'call-incoming');

      service.acceptWaitingCall('user-b', 'call-incoming');

      const active = (service as any).activeCalls.get('user-b');
      expect(active.get('call-ongoing').isHeld).toBe(true);
      expect(active.get('call-incoming')).toBeDefined();
      expect(active.get('call-incoming').isHeld).toBe(false);
    });

    it('should clear waiting queue after accepting the last waiting call', () => {
      ensureWaiting('user-c', 'call-incoming');
      service.acceptWaitingCall('user-c', 'call-incoming');

      const waiting = (service as any).waitingCalls as Map<string, unknown>;
      expect(waiting.has('user-c')).toBe(false);
    });
  });
});
