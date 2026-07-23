import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
