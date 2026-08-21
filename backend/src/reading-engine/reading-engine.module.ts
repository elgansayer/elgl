import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { ReadingEngineController } from './reading-engine.controller';
import { ReadingEngineService } from './reading-engine.service';
import { ReadingEngineCacheService } from './reading-engine-cache.service';
import { ReadingEngineCrashReportService } from './reading-engine-crash-report.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ReadingEngineController],
  providers: [
    ReadingEngineService,
    ReadingEngineCacheService,
    ReadingEngineCrashReportService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (supabaseService: SupabaseService) =>
        supabaseService.getRedisClient(),
      inject: [SupabaseService],
    },
  ],
  exports: [
    ReadingEngineService,
    ReadingEngineCacheService,
    ReadingEngineCrashReportService,
  ],
})
export class ReadingEngineModule {}
