import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import { LessonsService } from './lessons.service';

@Controller('lessons')
@UseGuards(SupabaseAuthGuard)
export class LearnerLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  async list(@Req() req: any, @Query() query: ListLessonsQueryDto) {
    return this.lessonsService.listLearnerLessons(req.user.id, query.language);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.lessonsService.getLearnerLesson(req.user.id, id);
  }

  @Put(':id/progress')
  async updateProgress(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLessonProgressDto,
  ) {
    return this.lessonsService.updateLearnerProgress(req.user.id, id, dto);
  }
}
