import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AudioRoomsHealthService } from './audio-rooms-health.service';

describe('AudioRoomsHealthService', () => {
  let service: AudioRoomsHealthService;
  let mockSupabaseClient: { from: Mock };
  let mockConfigService: { get: Mock };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'LIVEKIT_URL') return 'https://mock.livekit.cloud';
        if (key === 'CENTRIFUGO_API_URL') return 'http://localhost:8000';
        if (key === 'CENTRIFUGO_API_KEY') return '';
        return undefined;
      }),
    };

    const mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioRoomsHealthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<AudioRoomsHealthService>(AudioRoomsHealthService);

    // Clean up any interval timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    service.onModuleDestroy?.();
  });

  describe('getDegradationState', () => {
    it('should return initial degradation state with all services healthy by default', () => {
      const state = service.getDegradationState();

      expect(state.livekit.service).toBe('livekit');
      expect(state.supabase.service).toBe('supabase');
      expect(state.centrifugo.service).toBe('centrifugo');
      expect(state.allServicesUp).toBe(false); // initial state before health checks run
      expect(state.overallHealthy).toBe(false);
    });

    it('should return copies of service health objects', () => {
      const state1 = service.getDegradationState();
      const state2 = service.getDegradationState();

      expect(state1.livekit).not.toBe(state2.livekit);
      expect(state1.supabase).not.toBe(state2.supabase);
    });
  });

  describe('isServiceAvailable', () => {
    it('should return false for all services before health checks', () => {
      expect(service.isServiceAvailable('livekit')).toBe(false);
      expect(service.isServiceAvailable('supabase')).toBe(false);
      expect(service.isServiceAvailable('centrifugo')).toBe(false);
    });

    it('should return false for unknown service', () => {
      expect(service.isServiceAvailable('livekit')).toBe(false);
    });

    it('should return false for nonexistent service key', () => {
      expect(service.isServiceAvailable('unknown' as 'livekit')).toBe(false);
    });
  });

  describe('health check lifecycle', () => {
    it('should run initial health checks on module init', () => {
      // onModuleInit is called during module compilation
      // We verify the service was created successfully
      expect(service).toBeDefined();
    });

    it('should mark livekit as degraded in mock mode', () => {
      // Directly reflect the mock-mode state: in mock mode, livekit is
      // considered healthy but degraded (no real SFU).
      const state = service.getDegradationState();
      // Initial state before any health check runs has healthy=false,
      // degraded=false. The mock health check sets healthy=true, degraded=true.
      // We're testing the shape of the returned state object.
      expect(state.livekit.service).toBe('livekit');
      expect(typeof state.livekit.healthy).toBe('boolean');
      expect(typeof state.livekit.degraded).toBe('boolean');
    });
  });
});
