import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { XpModule } from '../xp/xp.module';
import { QuestsModule } from '../quests/quests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';
import { TimelineWorker } from './timeline.worker';
import { R2Service } from '../cloudflare-r2/r2.service';

@Module({
  imports: [UsersModule, SafetyModule, XpModule, QuestsModule, forwardRef(() => NotificationsModule)],
  controllers: [MomentsController],
  providers: [MomentsService, TimelineWorker, R2Service],
  exports: [MomentsService, TimelineWorker],
})
export class MomentsModule {}
