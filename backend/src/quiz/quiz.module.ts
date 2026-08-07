import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { AssessmentsModule } from '../assessments/assessments.module';

@Module({
  imports: [AssessmentsModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
