import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CentrifugoModule } from '../centrifugo/centrifugo.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [SupabaseModule, CentrifugoModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
