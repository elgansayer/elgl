import { Module, Global } from '@nestjs/common';
import {
  getLoggerToken,
  LoggerModule as PinoLoggerModule,
  PinoLogger,
} from 'nestjs-pino';

const LOGGER_CONTEXTS = [
  'AdminService',
  'AudioRoomsController',
  'AppleNotificationController',
  'AppleNotificationService',
  'AnkiExportService',
  'AppleReceiptValidatorService',
  'CentrifugoService',
  'CallsController',
  'CloudflareCacheService',
  'CrashReportService',
  'DecksService',
  'DiscoveryCacheInvalidationService',
  'DiscoveryRateLimiterGuard',
  'DiscoveryRecommendationsService',
  'DiscoveryService',
  'EconomyExceptionFilter',
  'EconomyRateLimiterGuard',
  'EconomyService',
  'EscrowMetricsAggregator',
  'FlashcardsService',
  'GooglePlayNotificationController',
  'GooglePlayNotificationService',
  'ModerationService',
  'ModerationMetricsAggregator',
  'MonetisationService',
  'NlpRateLimiterGuard',
  'PronunciationService',
  'RecommendationsMetricsAggregator',
  'RecommendationsRateLimiterGuard',
  'RecommendationsService',
  'SrsMetricsAggregator',
  'SrsRateLimiterGuard',
  'StripeService',
  'StudyBuddiesRateLimiterGuard',
  'SuggestFlashcardsService',
  'TranscriptEgressService',
  'TranslationService',
  'TrustSafetyMetricsAggregator',
  'VideoCallsRateLimiterGuard',
  'VideoClassroomMetricsAggregator',
];

const CONTEXT_LOGGER_TOKENS = LOGGER_CONTEXTS.map((context) =>
  getLoggerToken(context),
);
const CONTEXT_LOGGER_PROVIDERS = LOGGER_CONTEXTS.map((context) => ({
  provide: getLoggerToken(context),
  useExisting: PinoLogger,
}));

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        formatters: {
          level(label: string): { level: string } {
            return { level: label.toUpperCase() };
          },
        },
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        serializers: {
          req(req: Record<string, unknown>) {
            return {
              method: req.method,
              url: req.url,
              query: req.query,
            };
          },
          res(res: Record<string, unknown>) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),
  ],
  providers: CONTEXT_LOGGER_PROVIDERS,
  exports: [PinoLoggerModule, ...CONTEXT_LOGGER_TOKENS],
})
export class SharedLoggerModule {}
