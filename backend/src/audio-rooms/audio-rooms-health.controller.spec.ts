import { AudioRoomsHealthController } from './audio-rooms-health.controller';
import {
  AudioRoomsHealthService,
  DegradationState,
} from './audio-rooms-health.service';

describe('AudioRoomsHealthController', () => {
  const state = {
    overall: 'healthy',
    livekit: 'healthy',
    supabase: 'healthy',
    centrifugo: 'healthy',
  } as unknown as DegradationState;
  const service = {
    getDegradationState: vi.fn().mockResolvedValue(state),
  };
  const controller = new AudioRoomsHealthController(
    service as unknown as AudioRoomsHealthService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes infrastructure health without a session on purpose', async () => {
    await expect(controller.getHealth()).resolves.toEqual(state);
    expect(service.getDegradationState).toHaveBeenCalledTimes(1);
  });
});
