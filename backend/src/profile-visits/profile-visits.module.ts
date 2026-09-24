import { Module } from '@nestjs/common';
import { ProfileVisitsController } from './profile-visits.controller';
import { ProfileVisitsService } from './profile-visits.service';

@Module({
  controllers: [ProfileVisitsController],
  providers: [ProfileVisitsService],
  exports: [ProfileVisitsService],
})
export class ProfileVisitsModule {}
