import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { XpModule } from '../xp/xp.module';
import { QuestsModule } from '../quests/quests.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { MomentsController } from './moments.controller';
import { MomentsRankingService } from './moments-ranking.service';
import { MomentsService } from './moments.service';
import { TimelineWorker } from './timeline.worker';

@Module({
  imports: [
    UsersModule,
    SafetyModule,
    XpModule,
    QuestsModule,
    CloudflareR2Module,
  ],
  controllers: [MomentsController],
  providers: [MomentsService, MomentsRankingService, TimelineWorker],
  exports: [MomentsService, MomentsRankingService, TimelineWorker],
})
export class MomentsModule {}
