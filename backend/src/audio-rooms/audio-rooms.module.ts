import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { NlpModule } from '../nlp/nlp.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';
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
  controllers: [AudioRoomsController, AudioRoomsPreviewController],
  providers: [
    AudioRoomsService,
    TranscriptEgressService,
    CloudflareStreamService,
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
  exports: [AudioRoomsService, TranscriptEgressService],
})
export class AudioRoomsModule {}
