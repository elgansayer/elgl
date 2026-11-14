import { Global, Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { I18nService } from './i18n.service';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
