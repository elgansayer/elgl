import { Module } from '@nestjs/common';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { HobbyTagsModule } from '../hobby-tags/hobby-tags.module';
import { LessonsModule } from '../lessons/lessons.module';
import { MomentsModule } from '../moments/moments.module';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    FlashcardsModule,
    HobbyTagsModule,
    LessonsModule,
    MomentsModule,
    UsersModule,
    SupabaseModule,
  ],
  providers: [LearnerKnowledgeService],
  exports: [LearnerKnowledgeService],
})
export class LearnerKnowledgeModule {}
