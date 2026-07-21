import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { AudioRoomsController } from './audio-rooms.controller';
import { AudioRoomsService } from './audio-rooms.service';

@Module({
  imports: [UsersModule, ChatModule],
  controllers: [AudioRoomsController],
  providers: [AudioRoomsService],
  exports: [AudioRoomsService],
})
export class AudioRoomsModule {}
