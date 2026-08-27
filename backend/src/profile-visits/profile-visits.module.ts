import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProfileVisitsController } from './profile-visits.controller';
import { ProfileVisitsService } from './profile-visits.service';

@Module({
  imports: [UsersModule],
  controllers: [ProfileVisitsController],
  providers: [ProfileVisitsService],
  exports: [ProfileVisitsService],
})
export class ProfileVisitsModule {}
