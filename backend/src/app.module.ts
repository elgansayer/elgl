import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SharedLoggerModule } from './common/logger/logger.module';
import { RetryModule } from './common/retry/retry.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LocationModule } from './location/location.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { ProfileVisitsModule } from './profile-visits/profile-visits.module';
import { ChatModule } from './chat/chat.module';
import { LearnerKnowledgeModule } from './learner-knowledge/learner-knowledge.module';
import { NlpModule } from './nlp/nlp.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { DecksModule } from './decks/decks.module';
import { MomentsModule } from './moments/moments.module';
import { AudioRoomsModule } from './audio-rooms/audio-rooms.module';
import { MonetisationModule } from './monetisation/monetisation.module';
import { EconomyModule } from './economy/economy.module';
import { EscrowModule } from './escrow/escrow.module';
import { SafetyModule } from './safety/safety.module';
import { HobbyTagsModule } from './hobby-tags/hobby-tags.module';
import { InterestsModule } from './interests/interests.module';
import { FavouritesModule } from './favourites/favourites.module';
import { VideoCallsModule } from './video-calls/video-calls.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { StreakModule } from './streak/streak.module';
import { BlocksModule } from './blocks/blocks.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CallsModule } from './calls/calls.module';
import { QuizModule } from './quiz/quiz.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AdminModule } from './admin/admin.module';
import { HelpModule } from './help/help.module';
import { ProficiencyModule } from './proficiency/proficiency.module';
import { VersionModule } from './version/version.module';
import { GroupsModule } from './groups/groups.module';
import { CommunitiesModule } from './communities/communities.module';
import { ShoppingModule } from './shopping/shopping.module';
import { StudyStreakModule } from './study-streak/study-streak.module';
import { HostDashboardModule } from './host-dashboard/host-dashboard.module';
import { PrivacyModule } from './privacy/privacy.module';
import { LegalModule } from './legal/legal.module';
import { AiConversationModule } from './ai-conversation/ai-conversation.module';
import { CorrectorScoreModule } from './corrector-score/corrector-score.module';
import { AchievementsModule } from './achievements/achievements.module';
import { CulturalModule } from './cultural/cultural.module';
import { DailyTipModule } from './daily-tip/daily-tip.module';
import { LanguageChallengesModule } from './language-challenges/language-challenges.module';
import { PronunciationModule } from './pronunciation/pronunciation.module';
import { MilestonesModule } from './milestones/milestones.module';
import { StudyBuddiesModule } from './study-buddies/study-buddies.module';
import { AudioIntroModule } from './audio-intro/audio-intro.module';
import { StatsModule } from './stats/stats.module';
import { EventsModule } from './events/events.module';
import { LessonsModule } from './lessons/lessons.module';
import { LinkPreviewModule } from './link-preview/link-preview.module';
import { ResourceLibraryModule } from './resource-library/resource-library.module';
import { WordOfTheDayModule } from './word-of-the-day/word-of-the-day.module';
import { SpamDetectionModule } from './spam-detection/spam-detection.module';
import { UserStatisticsModule } from './user-statistics/user-statistics.module';
import { LanguageIslandsModule } from './language-islands/language-islands.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';
import { EmailModule } from './email/email.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { LinkedAccountsModule } from './linked-accounts/linked-accounts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnkiiIntegrationService } from './ankii-integration/ankii-integration.service';
import { AssessmentsModule } from './assessments/assessments.module';
import { MetricsModule } from './metrics/metrics.module';
import { ReadingEngineModule } from './reading-engine/reading-engine.module';
import { CloudflareModule } from './cloudflare/cloudflare.module';
import { LivekitModule } from './livekit/livekit.module';
import { MockScenariosModule } from './mock/mock-scenarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    SharedLoggerModule,
    RetryModule,
    LivekitModule,
    SupabaseModule,
    LocationModule,
    AuthModule,
    UsersModule,
    MediaModule,
    DiscoveryModule,
    ProfileVisitsModule,
    ChatModule,
    NlpModule,
    FlashcardsModule,
    DecksModule,
    MomentsModule,
    AudioRoomsModule,
    MonetisationModule,
    EconomyModule,
    EscrowModule,
    SafetyModule,
    HobbyTagsModule,
    InterestsModule,
    FavouritesModule,
    VideoCallsModule,
    LeaderboardModule,
    StreakModule,
    BlocksModule,
    NotificationsModule,
    CallsModule,
    QuizModule,
    RecommendationsModule,
    AdminModule,
    HelpModule,
    ProficiencyModule,
    VersionModule,
    StudyStreakModule,
    HostDashboardModule,
    PrivacyModule,
    LegalModule,
    AiConversationModule,
    AchievementsModule,
    CulturalModule,
    DailyTipModule,
    CorrectorScoreModule,
    LanguageChallengesModule,
    PronunciationModule,
    GroupsModule,
    CommunitiesModule,
    ShoppingModule,
    MilestonesModule,
    StudyBuddiesModule,
    AudioIntroModule,
    StatsModule,
    EventsModule,
    LessonsModule,
    LinkPreviewModule,
    ResourceLibraryModule,
    NotificationPreferencesModule,
    ModerationModule,
    WordOfTheDayModule,
    SpamDetectionModule,
    UserStatisticsModule,
    LanguageIslandsModule,
    EmailModule,
    PasswordResetModule,
    LinkedAccountsModule,
    AssessmentsModule,
    AnalyticsModule,
    MetricsModule,
    ReadingEngineModule,
    CloudflareModule,
    LearnerKnowledgeModule,
    MockScenariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,

      useClass: ThrottlerGuard,
    },
    AnkiiIntegrationService,
  ],
})
export class AppModule {}
