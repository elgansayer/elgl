import { Module } from '@nestjs/common';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { HobbyTagsModule } from '../hobby-tags/hobby-tags.module';
import { LessonsModule } from '../lessons/lessons.module';
import { MomentsModule } from '../moments/moments.module';

@Module({
  imports: [FlashcardsModule, HobbyTagsModule, LessonsModule, MomentsModule],
  providers: [LearnerKnowledgeService],
  exports: [LearnerKnowledgeService],
})
export class LearnerKnowledgeModule {}
