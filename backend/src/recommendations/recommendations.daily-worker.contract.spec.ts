import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('daily recommendation worker contract', () => {
  const source = readFileSync(
    join(__dirname, 'recommendations.service.ts'),
    'utf8',
  );

  it('runs the real recommendation job every day at midnight', () => {
    expect(source).toContain('@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)');
    expect(source).toContain('async calculateDailyRecommendations(): Promise<void>');
  });

  it('bounds the user scan and recommendation fan-out', () => {
    expect(source).toContain('const CRON_USERS_LIMIT = 5000;');
    expect(source).toContain('.limit(CRON_USERS_LIMIT)');
    expect(source).toContain('const DAILY_LIMIT = 10;');
    expect(source).toContain('.limit(DAILY_LIMIT)');
  });

  it('caches per-user recommendation sets in Redis for one day', () => {
    expect(source).toContain('const DAILY_REDIS_TTL = 86400;');
    expect(source).toContain('`recommendations:daily:${entry.userId}`');
    expect(source).toContain("'EX',\n                DAILY_REDIS_TTL");
  });

  it('keeps the worker recommendation-specific instead of audio-room control logic', () => {
    expect(source).toContain(".from('users')");
    expect(source).toContain(".overlaps('native_languages', [targetCode])");
    expect(source).toContain(".overlaps('target_languages', [nativeCode])");
    expect(source).not.toContain('inviteCoHost');
    expect(source).not.toContain('removeCoHost');
  });

  it('avoids caching the learner in their own recommendation list', () => {
    expect(source).toContain('const matchIndex = matchIndices.get(entry.userId);');
    expect(source).toContain('const strToRemove = jsonParts[matchIndex];');
  });
});
