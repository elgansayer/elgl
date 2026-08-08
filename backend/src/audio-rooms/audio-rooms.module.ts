import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { NlpModule } from '../nlp/nlp.module';
import { AudioRoomsController } from './audio-rooms.controller';
import { AudioRoomsHealthController } from './audio-rooms-health.controller';
import { AudioRoomsService } from './audio-rooms.service';
import { AudioRoomsHealthService } from './audio-rooms-health.service';
import { TranscriptEgressService } from './transcript-egress.service';
import { R2Service } from '../cloudflare-r2/r2.service';

@Module({
  imports: [UsersModule, ChatModule, NlpModule],
  controllers: [AudioRoomsController, AudioRoomsHealthController],
  providers: [
    AudioRoomsService,
    AudioRoomsHealthService,
    TranscriptEgressService,
    R2Service,
    // LiveKit RoomServiceClient is configured to manage audio room lifecycle.
    {
      provide: 'LIVEKIT_ROOM_SERVICE_CLIENT',
      useFactory: (configService: ConfigService) => {
        const livekitUrl =
          configService.get<string>('LIVEKIT_URL') ||
          'https://mock.livekit.cloud';
        const apiKey = configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
        const secretKey =
          configService.get<string>('LIVEKIT_SECRET') ||
          'secretkey012345678901234567890123456789';
        return new RoomServiceClient(livekitUrl, apiKey, secretKey);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AudioRoomsService, AudioRoomsHealthService, TranscriptEgressService],
})
export class AudioRoomsModule {}
