import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  // Supplies AdminGuard and AdminCapabilityGuard for the reviewer-only routes.
  imports: [AdminModule],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
