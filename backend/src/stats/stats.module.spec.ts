import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AchievementsService } from '../achievements/achievements.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PerformanceReportService } from './performance-report.service';
import { StatsController } from './stats.controller';
import { StatsModule } from './stats.module';
import { StatsService } from './stats.service';

describe('StatsModule', () => {
  it('wires the dashboard and the performance report to their dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), StatsModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({ getClient: () => ({ from: vi.fn() }) })
      .compile();

    expect(moduleRef.get(StatsController)).toBeInstanceOf(StatsController);
    expect(moduleRef.get(StatsService)).toBeInstanceOf(StatsService);
    expect(moduleRef.get(PerformanceReportService)).toBeInstanceOf(
      PerformanceReportService,
    );
    expect(
      moduleRef.get(AchievementsService, { strict: false }),
    ).toBeInstanceOf(AchievementsService);
  });
});
