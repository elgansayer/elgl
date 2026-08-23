import { Test, TestingModule } from '@nestjs/testing';
import { DisappearingMessagesCleanupService } from './disappearing-messages-cleanup.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DisappearingMessagesCleanupService', () => {
  let service: DisappearingMessagesCleanupService;
  const rpc = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DisappearingMessagesCleanupService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ rpc }) },
        },
      ],
    }).compile();

    service = moduleRef.get(DisappearingMessagesCleanupService);
  });

  it('purges a bounded batch through the service-role RPC', async () => {
    rpc.mockResolvedValue({ data: 23, error: null });

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('purge_expired_chat_messages', {
      p_limit: 500,
    });
  });

  it('accepts an empty cleanup batch', async () => {
    rpc.mockResolvedValue({ data: 0, error: null });

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();
  });

  it('contains provider failures so the scheduler can retry next minute', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failed' },
    });

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();
  });
});
