import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, MediaService],
  exports: [UsersService],
})
export class UsersModule {}
