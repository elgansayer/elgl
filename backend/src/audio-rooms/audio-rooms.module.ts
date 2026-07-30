import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { AudioRoomsController } from './audio-rooms.controller';
import { AudioRoomsService } from './audio-rooms.service';
import { TranscriptEgressService } from './transcript-egress.service';

@Module({
  imports: [UsersModule, ChatModule],
  controllers: [AudioRoomsController],
  providers: [AudioRoomsService, TranscriptEgressService],
  exports: [AudioRoomsService, TranscriptEgressService],
})
export class AudioRoomsModule {}
