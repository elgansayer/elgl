import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';

@Module({
  imports: [UsersModule, ChatModule, HttpModule],
  controllers: [EconomyController],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
