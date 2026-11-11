import { Module } from '@nestjs/common';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';
import { MetricsModule } from '../metrics/metrics.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ClassReplaysController } from './class-replays.controller';
import { ClassReplaysService } from './class-replays.service';

@Module({
  imports: [SupabaseModule, MetricsModule],
  controllers: [ClassReplaysController],
  providers: [ClassReplaysService, CloudflareStreamService],
  exports: [ClassReplaysService],
})
export class ClassReplaysModule {}
