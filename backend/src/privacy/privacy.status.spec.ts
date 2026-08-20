import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { PrivacyService } from './privacy.service';

describe('PrivacyService privacy status', () => {
  const createSignedUrl = vi.fn();
  const userSingle = vi.fn();
  const archiveLimit = vi.fn();

  let service: PrivacyService;

  beforeEach(() => {
    vi.clearAllMocks();

    userSingle.mockResolvedValue({
      data: {
        is_deletion_pending: true,
        scheduled_for_deletion_at: '2026-09-19T12:00:00.000Z',
      },
      error: null,
    });
    archiveLimit.mockResolvedValue({
      data: [
        {
          requested_at: '2026-08-20T12:00:00.000Z',
          archive_url: 'user-1/archive_123.json',
        },
      ],
      error: null,
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example.test/signed-archive' },
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: userSingle }),
            }),
          };
        }

        if (table === 'archive_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ limit: archiveLimit }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn().mockReturnValue({ createSignedUrl }),
      },
    };

    service = new PrivacyService(
      { getClient: () => client } as unknown as SupabaseService,
      { get: vi.fn() } as unknown as ConfigService,
      {
        invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
      } as unknown as SafetyCacheInvalidationService,
    );
  });

  it('returns deletion state and a short-lived signed archive URL', async () => {
    const status = await service.getStatus('user-1');

    expect(status).toEqual({
      is_deletion_pending: true,
      scheduled_for_deletion_at: '2026-09-19T12:00:00.000Z',
      latest_archive: {
        requested_at: '2026-08-20T12:00:00.000Z',
        download_url: 'https://storage.example.test/signed-archive',
        expires_in_seconds: 900,
      },
    });
    expect(createSignedUrl).toHaveBeenCalledWith('user-1/archive_123.json', 900);
  });

  it('does not expose a durable URL if signing fails', async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'storage unavailable' },
    });

    const status = await service.getStatus('user-1');

    expect(status.latest_archive?.download_url).toBeNull();
    expect(status.latest_archive?.expires_in_seconds).toBeNull();
  });

  it('does not re-expose historical public archive URLs', async () => {
    archiveLimit.mockResolvedValue({
      data: [
        {
          requested_at: '2026-08-19T12:00:00.000Z',
          archive_url: 'https://storage.example.test/public/archive.json',
        },
      ],
      error: null,
    });

    const status = await service.getStatus('user-1');

    expect(status.latest_archive?.download_url).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('fails closed when the authenticated user status cannot be loaded', async () => {
    userSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(service.getStatus('user-1')).rejects.toThrow(BadRequestException);
  });
});
