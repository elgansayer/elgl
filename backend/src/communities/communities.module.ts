import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { GroupsModule } from '../groups/groups.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

@Module({
  imports: [SupabaseModule, GroupsModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
})
export class CommunitiesModule {}
