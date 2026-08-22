import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
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

    await expect(
      controller.findOne({ id: 'user-1' } as User),
    ).resolves.toEqual(dailyWord);
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
});
