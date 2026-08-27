import { Module, Global } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CorrectorScoreService } from './corrector-score.service';
import { CorrectorScoreController } from './corrector-score.controller';

@Global()
@Module({
  imports: [SupabaseModule],
  controllers: [CorrectorScoreController],
  providers: [CorrectorScoreService],
  exports: [CorrectorScoreService],
})
export class CorrectorScoreModule {}
