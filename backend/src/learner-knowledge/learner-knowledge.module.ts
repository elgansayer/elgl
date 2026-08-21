import { Module } from '@nestjs/common';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { HobbyTagsModule } from '../hobby-tags/hobby-tags.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { LessonsModule } from '../lessons/lessons.module';
import { MomentsModule } from '../moments/moments.module';
import { UsersModule } from '../users/users.module';
import { StudyStreakModule } from '../study-streak/study-streak.module';

@Module({
  imports: [
    FlashcardsModule,
    HobbyTagsModule,
    AssessmentsModule,
    LessonsModule,
    MomentsModule,
    UsersModule,
    StudyStreakModule,
  ],
  providers: [LearnerKnowledgeService],
  exports: [LearnerKnowledgeService],
})
export class LearnerKnowledgeModule {}
