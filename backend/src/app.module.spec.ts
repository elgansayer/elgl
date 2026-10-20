import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserStatisticsModule } from './user-statistics/user-statistics.module';
import { LinkPreviewModule } from './link-preview/link-preview.module';

type ProviderToken = unknown;

/** Every feature module that AppModule is expected to import. */
const EXPECTED_MODULE_NAMES = [
  'SupabaseModule',
  'AuthModule',
  'UsersModule',
  'MediaModule',
  'DiscoveryModule',
  'ProfileVisitsModule',
  'ChatModule',
  'NlpModule',
  'FlashcardsModule',
  'MomentsModule',
  'AudioRoomsModule',
  'MonetisationModule',
  'EconomyModule',
  'SafetyModule',
  'HobbyTagsModule',
  'InterestsModule',
  'FavouritesModule',
  'VideoCallsModule',
  'LeaderboardModule',
  'StreakModule',
  'NotificationsModule',
  'CallsModule',
  'QuizModule',
  'RecommendationsModule',
  'AdminModule',
  'HelpModule',
  'ProficiencyModule',
  'VersionModule',
  'StudyStreakModule',
  'HostDashboardModule',
  'PrivacyModule',
  'AiConversationModule',
  'AchievementsModule',
  'CulturalModule',
  'DailyTipModule',
  'CorrectorScoreModule',
  'LanguageChallengesModule',
  'PronunciationModule',
  'GroupsModule',
  'ShoppingModule',
  'MilestonesModule',
  'StudyBuddiesModule',
  'AudioIntroModule',
  'StatsModule',
  'EventsModule',
  'LessonsModule',
  'LinkPreviewModule',
  'ResourceLibraryModule',
  'NotificationPreferencesModule',
  'ModerationModule',
  'WordOfTheDayModule',
  'SpamDetectionModule',
  'UserStatisticsModule',
  'MetricsModule',
];

function findProvider(
  providers: unknown[],
  providerToken: ProviderToken,
): unknown {
  return providers.find((provider): boolean => {
    if (typeof provider === 'object' && provider !== null) {
      const partial = provider as { provide?: ProviderToken };
      return partial.provide === providerToken;
    }
    return false;
  });
}

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('should register the AppController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', AppModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(AppController);
  });

  it('should register AppService in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', AppModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(AppService);
  });

  it('should register the global APP_GUARD provider that uses ThrottlerGuard', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', AppModule) as unknown[]) ?? [];

    const guardProvider = findProvider(providersMetadata, APP_GUARD) as
      { provide: string; useClass: typeof ThrottlerGuard } | undefined;

    expect(guardProvider).toBeDefined();
    expect(guardProvider?.useClass).toBe(ThrottlerGuard);
  });

  it('should register UserStatisticsModule in its imports metadata', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', AppModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(UserStatisticsModule);
  });

  it('should register LinkPreviewModule in its imports metadata', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', AppModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(LinkPreviewModule);
  });

  it('should import all required feature modules', () => {
    const imports =
      (Reflect.getMetadata('imports', AppModule) as unknown[]) ?? [];

    const importedNames = imports.map((mod) => {
      const moduleConstructor = (mod as { name?: string })?.name;
      return moduleConstructor ?? '';
    });

    for (const name of EXPECTED_MODULE_NAMES) {
      expect(importedNames).toContain(name);
    }
  });

  it('should not contain duplicate feature module imports', () => {
    const imports =
      (Reflect.getMetadata('imports', AppModule) as unknown[]) ?? [];

    const featureModules = imports.filter(
      (mod): mod is new (...args: unknown[]) => unknown =>
        typeof mod === 'function',
    );
    const duplicateModules = featureModules.filter(
      (mod, index) => featureModules.indexOf(mod) !== index,
    );

    expect(duplicateModules).toHaveLength(0);
  });
});
