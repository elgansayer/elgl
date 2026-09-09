import { MODULE_METADATA } from '@nestjs/common/constants';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { QuestsModule } from '../quests/quests.module';
import { SafetyModule } from '../safety/safety.module';
import { UsersModule } from '../users/users.module';
import { XpModule } from '../xp/xp.module';
import { MomentsController } from './moments.controller';
import { MomentsModule } from './moments.module';
import { MomentsRankingService } from './moments-ranking.service';
import { MomentsService } from './moments.service';
import { TimelineWorker } from './timeline.worker';

describe('MomentsModule', () => {
  const metadata = <T>(key: string): T[] =>
    (Reflect.getMetadata(key, MomentsModule) as T[] | undefined) ?? [];

  it('registers the Moments controller', () => {
    expect(metadata(MODULE_METADATA.CONTROLLERS)).toEqual([MomentsController]);
  });

  it('registers the core Moments services and timeline worker', () => {
    expect(metadata(MODULE_METADATA.PROVIDERS)).toEqual(
      expect.arrayContaining([
        MomentsService,
        MomentsRankingService,
        TimelineWorker,
      ]),
    );
  });

  it('exports the services needed by other feature modules', () => {
    expect(metadata(MODULE_METADATA.EXPORTS)).toEqual(
      expect.arrayContaining([
        MomentsService,
        MomentsRankingService,
        TimelineWorker,
      ]),
    );
  });

  it('declares the user, safety, rewards, quests, and media dependencies', () => {
    expect(metadata(MODULE_METADATA.IMPORTS)).toEqual(
      expect.arrayContaining([
        UsersModule,
        SafetyModule,
        XpModule,
        QuestsModule,
        CloudflareR2Module,
      ]),
    );
  });
});
