import { Module } from '@nestjs/common';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { LearnerKnowledgeController } from './learner-knowledge.controller';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { HobbyTagsModule } from '../hobby-tags/hobby-tags.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { LessonsModule } from '../lessons/lessons.module';
import { MomentsModule } from '../moments/moments.module';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    FlashcardsModule,
    HobbyTagsModule,
    AssessmentsModule,
    LessonsModule,
    MomentsModule,
    AuthModule,
    SupabaseModule
  ],
  controllers: [LearnerKnowledgeController],
  providers: [LearnerKnowledgeService],
  exports: [LearnerKnowledgeService],
})
export class LearnerKnowledgeModule {}
