import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { ProfileVisitsModule } from './profile-visits/profile-visits.module';
import { ChatModule } from './chat/chat.module';
import { NlpModule } from './nlp/nlp.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { MomentsModule } from './moments/moments.module';
import { AudioRoomsModule } from './audio-rooms/audio-rooms.module';
import { MonetisationModule } from './monetisation/monetisation.module';
import { EconomyModule } from './economy/economy.module';
import { SafetyModule } from './safety/safety.module';
import { HobbyTagsModule } from './hobby-tags/hobby-tags.module';
import { InterestsModule } from './interests/interests.module';
import { FavouritesModule } from './favourites/favourites.module';
import { VideoCallsModule } from './video-calls/video-calls.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { StreakModule } from './streak/streak.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CallsModule } from './calls/calls.module';
import { QuizModule } from './quiz/quiz.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AdminModule } from './admin/admin.module';
import { HelpModule } from './help/help.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { ProficiencyModule } from './proficiency/proficiency.module';
import { VersionModule } from './version/version.module';
import { GroupsModule } from './groups/groups.module';
import { ShoppingModule } from './shopping/shopping.module';
import { StudyStreakModule } from './study-streak/study-streak.module';
import { HostDashboardModule } from './host-dashboard/host-dashboard.module';
import { PrivacyModule } from './privacy/privacy.module';
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
import { ScheduledDeletionModule } from './scheduled-deletion/scheduled-deletion.module';
import { EventsModule } from './events/events.module';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
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
    SupabaseModule,
    AuthModule,
    UsersModule,
    MediaModule,
    DiscoveryModule,
    ProfileVisitsModule,
    ChatModule,
    NlpModule,
    FlashcardsModule,
    MomentsModule,
    AudioRoomsModule,
    MonetisationModule,
    EconomyModule,
    SafetyModule,
    HobbyTagsModule,
    InterestsModule,
    FavouritesModule,
    VideoCallsModule,
    LeaderboardModule,
    StreakModule,
    NotificationsModule,
    CallsModule,
    QuizModule,
    RecommendationsModule,
    AdminModule,
    HelpModule,
    PasswordResetModule,
    ProficiencyModule,
    VersionModule,
    StudyStreakModule,
    HostDashboardModule,
    PrivacyModule,
    AiConversationModule,
    AchievementsModule,
    CulturalModule,
    DailyTipModule,
    CorrectorScoreModule,
    LanguageChallengesModule,
    PronunciationModule,
    GroupsModule,
    ShoppingModule,
    MilestonesModule,
    StudyBuddiesModule,
    AudioIntroModule,
    StatsModule,
    ScheduledDeletionModule,
    EventsModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,

      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
