import { UnauthorizedException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { WordOfTheDayController } from './word-of-the-day.controller';
import type { WordOfTheDayService } from './word-of-the-day.service';

describe('WordOfTheDayController', () => {
  const dailyWord = {
    word: '学ぶ',
    translation: 'to learn',
    language: 'Japanese',
    languageCode: 'ja',
    example: '毎日、新しいことを学びます。',
    date: '2026-08-22',
  };

  it('returns the signed-in learner daily word', async () => {
    const service = {
      getTodayWordForUser: vi.fn().mockResolvedValue(dailyWord),
    } as unknown as WordOfTheDayService;
    const controller = new WordOfTheDayController(service);

    await expect(controller.findOne({ id: 'user-1' } as User)).resolves.toEqual(
      dailyWord,
    );
    expect(service.getTodayWordForUser).toHaveBeenCalledWith('user-1');
  });

  it('fails closed when the auth guard provides no user', async () => {
    const service = {
      getTodayWordForUser: vi.fn(),
    } as unknown as WordOfTheDayService;
    const controller = new WordOfTheDayController(service);

    await expect(controller.findOne(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.getTodayWordForUser).not.toHaveBeenCalled();
  });

  it('requires the Supabase authentication guard', () => {
    const guards: unknown[] = Reflect.getMetadata(
      GUARDS_METADATA,
      WordOfTheDayController,
    );

    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('prevents browser and CDN storage of learner-specific words', () => {
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      WordOfTheDayController.prototype.findOne,
    ) as Array<{ directive: Record<string, string> }>;
    const cacheControl = interceptors.find(
      (interceptor) => interceptor instanceof CacheControlInterceptor,
    );

    expect(cacheControl?.directive).toEqual(CACHE_NO_STORE);
  });
});
