import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'provision')
          .default('development'),
        SUPABASE_URL: Joi.string().uri().required(),
        SUPABASE_ANON_KEY: Joi.string().required(),
        SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        CENTRIFUGO_URL: Joi.string().uri().required(),
        CENTRIFUGO_API_KEY: Joi.string().required(),
        CENTRIFUGO_SECRET: Joi.string().required(),
        LIVEKIT_URL: Joi.string().required(),
        LIVEKIT_API_KEY: Joi.string().required(),
        LIVEKIT_SECRET: Joi.string().required(),
        CLOUDFLARE_R2_ENDPOINT: Joi.string().uri().required(),
        CLOUDFLARE_R2_ACCESS_KEY_ID: Joi.string().required(),
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: Joi.string().required(),
        CLOUDFLARE_R2_BUCKET: Joi.string().required(),
        CLOUDFLARE_R2_PUBLIC_DOMAIN: Joi.string().uri().required(),
        DEEPL_API_KEY: Joi.string().required(),
        AZURE_TRANSLATOR_KEY: Joi.string().required(),
        AZURE_TRANSLATOR_REGION: Joi.string().default('global'),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        APPLE_BUNDLE_ID: Joi.string().default('com.hellotalk.app'),
        APPLE_SHARED_SECRET: Joi.string().required(),
        APPLE_ROOT_CA_CERT_1: Joi.string().required(),
        APPLE_ROOT_CA_CERT_2: Joi.string().optional().allow(''),
        APPLE_VERIFICATION_URL: Joi.string()
          .uri()
          .default('https://sandbox.itunes.apple.com/verifyReceipt'),
      }),
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
