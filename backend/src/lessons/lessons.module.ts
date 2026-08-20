import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { LearnerLessonsController } from './learner-lessons.controller';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [forwardRef(() => AdminModule)],
  controllers: [LessonsController, LearnerLessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
