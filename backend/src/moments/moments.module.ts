import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { XpModule } from '../xp/xp.module';
import { QuestsModule } from '../quests/quests.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { HashtagTopicsController } from './hashtag-topics.controller';
import { HashtagTopicsService } from './hashtag-topics.service';
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
  controllers: [MomentsController, HashtagTopicsController],
  providers: [
    MomentsService,
    MomentsRankingService,
    HashtagTopicsService,
    TimelineWorker,
  ],
  exports: [
    MomentsService,
    MomentsRankingService,
    HashtagTopicsService,
    TimelineWorker,
  ],
})
export class MomentsModule {}
