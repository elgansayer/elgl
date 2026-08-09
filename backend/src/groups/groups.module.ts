import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ChatModule } from '../chat/chat.module';
import { InterestsModule } from '../interests/interests.module';
import { GroupsController } from './groups.controller';
import { CommunitiesController } from './communities.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [SupabaseModule, ChatModule, InterestsModule],
  controllers: [GroupsController, CommunitiesController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
