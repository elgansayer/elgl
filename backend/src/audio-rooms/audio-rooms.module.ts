import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RoomServiceClient } from 'livekit-server-sdk';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { NlpModule } from '../nlp/nlp.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';
import { AudioRoomArchivesController } from './audio-room-archives.controller';
import { AudioRoomArchivesService } from './audio-room-archives.service';
import { AudioRoomTranscriptAccessInterceptor } from './audio-room-transcript-access.interceptor';
import { AudioRoomsController } from './audio-rooms.controller';
import { AudioRoomsPreviewController } from './audio-rooms-preview.controller';
import { AudioRoomsService } from './audio-rooms.service';
import { TranscriptEgressService } from './transcript-egress.service';

@Module({
  imports: [
    UsersModule,
    ChatModule,
    NlpModule,
    CloudflareModule,
    CloudflareR2Module,
  ],
  controllers: [
    AudioRoomsController,
    AudioRoomsPreviewController,
    AudioRoomArchivesController,
  ],
  providers: [
    AudioRoomsService,
    AudioRoomArchivesService,
    TranscriptEgressService,
    CloudflareStreamService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AudioRoomTranscriptAccessInterceptor,
    },
    // LiveKit RoomServiceClient is configured to manage audio room lifecycle.
    {
      provide: 'LIVEKIT_ROOM_SERVICE_CLIENT',
      useFactory: (configService: ConfigService) => {
        const livekitUrl =
          configService.get<string>('LIVEKIT_URL') ||
          'https://mock.livekit.cloud';
        const apiKey = configService.get<string>('LIVEKIT_API_KEY');
        const secretKey = configService.get<string>('LIVEKIT_SECRET');

        if (!apiKey || !secretKey) {
          throw new Error(
            'LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured',
          );
        }

        return new RoomServiceClient(livekitUrl, apiKey, secretKey);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    AudioRoomsService,
    AudioRoomArchivesService,
    TranscriptEgressService,
  ],
})
export class AudioRoomsModule {}
