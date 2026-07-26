import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
import { FavouritesModule } from './favourites/favourites.module';
import { VideoCallsModule } from './video-calls/video-calls.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { StreakModule } from './streak/streak.module';
import { StreakMiddleware } from './streak/streak.middleware';
import { NotificationsModule } from './notifications/notifications.module';
import { CallsModule } from './calls/calls.module';
import { StatsModule } from './stats/stats.module';
import { QuizModule } from './quiz/quiz.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
    ScheduleModule.forRoot(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
    FavouritesModule,
    VideoCallsModule,
    LeaderboardModule,
    StreakModule,
    NotificationsModule,
    CallsModule,
    StatsModule,
    QuizModule,
    RecommendationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StreakMiddleware).forRoutes('*');
  }
}
