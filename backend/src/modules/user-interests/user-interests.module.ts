import { Module } from '@nestjs/common';
import { UserInterestsController } from './user-interests.controller';
import { UserInterestsService } from './user-interests.service';

@Module({
  controllers: [UserInterestsController],
  providers: [UserInterestsService],
  exports: [UserInterestsService],
})
export class UserInterestsModule {}
