import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { LearningLessonsController } from './learning-lessons.controller';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [forwardRef(() => AdminModule)],
  controllers: [LessonsController, LearningLessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
