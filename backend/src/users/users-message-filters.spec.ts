import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

function createService(from: ReturnType<typeof vi.fn>): UsersService {
  return new UsersService(
    { getClient: () => ({ from }) } as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('UsersService message filters', () => {
  it('fails closed when persisted filters cannot be loaded', async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error('offline') }),
    };
    const service = createService(vi.fn().mockReturnValue(read));

    await expect(service.getMessageFilters('user-1')).rejects.toThrow(
      'Failed to load message filters',
    );
  });

  it('merges partial updates and normalises list values', async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          message_filters: {
            enabled: true,
            same_native_language: true,
            allowed_native_languages: ['ja'],
          },
        },
        error: null,
      }),
    };
    const write = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const from = vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(write);
    const service = createService(from);

    await service.setMessageFilters('user-1', {
      allowed_genders: [' Female ', 'OTHER'],
    });

    expect(write.update).toHaveBeenCalledWith({
      message_filters: {
        enabled: true,
        same_native_language: true,
        allowed_native_languages: ['ja'],
        allowed_genders: ['female', 'other'],
      },
    });
  });

  it('rejects an inverted age range before reading or writing', async () => {
    const from = vi.fn();
    const service = createService(from);

    await expect(
      service.setMessageFilters('user-1', { age_min: 50, age_max: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(from).not.toHaveBeenCalled();
  });
});
