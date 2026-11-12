import { getLoggerToken } from 'nestjs-pino';
import { SharedLoggerModule } from './logger.module';

describe('SharedLoggerModule', () => {
  it('exports contextual loggers required by guarded feature modules', () => {
    const exports = Reflect.getMetadata(
      'exports',
      SharedLoggerModule,
    ) as unknown[];

    expect(exports).toEqual(
      expect.arrayContaining([
        getLoggerToken('StudyBuddiesRateLimiterGuard'),
        getLoggerToken('VideoCallsRateLimiterGuard'),
      ]),
    );
  });

  it('exports the logger context injected by the grammar explanation provider boundary', () => {
    const exports = Reflect.getMetadata(
      'exports',
      SharedLoggerModule,
    ) as unknown[];

    expect(exports).toContain(getLoggerToken('GrammarExplanationService'));
  });
});
