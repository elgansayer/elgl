import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MutedWordsController } from './muted-words.controller';
import { MutedWordsService } from './muted-words.service';

describe('MutedWordsController', () => {
  it('scopes list, add and remove operations to the authenticated user', async () => {
    const service = {
      list: vi.fn().mockResolvedValue(['spoiler']),
      add: vi.fn().mockResolvedValue(['spoiler', 'politics']),
      remove: vi.fn().mockResolvedValue(['politics']),
    };
    const controller = new MutedWordsController(
      service as unknown as MutedWordsService,
    );
    const user = { id: 'user-1' } as never;

    await expect(controller.list(user)).resolves.toEqual({
      words: ['spoiler'],
    });
    await expect(
      controller.add(user, { word: 'politics' }),
    ).resolves.toEqual({
      words: ['spoiler', 'politics'],
    });
    await expect(
      controller.remove(user, { word: 'spoiler' }),
    ).resolves.toEqual({
      words: ['politics'],
    });

    expect(service.list).toHaveBeenCalledWith('user-1');
    expect(service.add).toHaveBeenCalledWith('user-1', 'politics');
    expect(service.remove).toHaveBeenCalledWith('user-1', 'spoiler');
  });

  it('fails closed if an authenticated user is unavailable', async () => {
    const controller = new MutedWordsController({} as MutedWordsService);

    await expect(controller.list(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
