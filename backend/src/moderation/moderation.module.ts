import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { SafetyModule } from '../safety/safety.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [AdminModule, SafetyModule],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
