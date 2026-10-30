import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CronExpression } from '@nestjs/schedule';
import { DiscoveryService } from '../discovery/discovery.service';
import { RecommendationsService } from './recommendations.service';

const CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

function cronOptionsOf(
  target: object,
  method: string,
): { cronTime?: string; name?: string } | undefined {
  const handler: unknown = Reflect.get(target, method);
  return typeof handler === 'function'
    ? (Reflect.getMetadata(CRON_OPTIONS, handler) as
        { cronTime?: string; name?: string } | undefined)
    : undefined;
}

describe('daily recommendation worker contract', () => {
  it('runs the real recommendation job every day at midnight', () => {
    expect(
      cronOptionsOf(
        RecommendationsService.prototype,
        'calculateDailyRecommendations',
      ),
    ).toEqual(
      expect.objectContaining({
        cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
        name: 'daily-partner-recommendations',
      }),
    );
  });

  it('is the only scheduled daily partner recommendation job', () => {
    // A second midnight job used to write an unread `daily_recommendations:*`
    // cache and repeat the work; discovery now only schedules its weekly job.
    const discoverySchedules = Object.getOwnPropertyNames(
      DiscoveryService.prototype,
    )
      .map((method) => cronOptionsOf(DiscoveryService.prototype, method))
      .filter((options) => options !== undefined)
      .map((options) => options.cronTime);

    expect(
      Object.getOwnPropertyNames(DiscoveryService.prototype),
    ).not.toContain('calculateDailyRecommendations');
    expect(discoverySchedules).toEqual(['0 0 * * 0']);
  });

  it('keeps the worker recommendation-specific instead of audio-room control logic', () => {
    const source = readFileSync(
      join(__dirname, 'recommendations.service.ts'),
      'utf8',
    );

    expect(source).not.toContain('inviteCoHost');
    expect(source).not.toContain('removeCoHost');
  });
});
