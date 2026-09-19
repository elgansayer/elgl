import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SaveLessonProgressDto } from './dto/save-lesson-progress.dto';
import { LessonsService } from './lessons.service';

@Controller('lessons')
@UseGuards(SupabaseAuthGuard)
export class LearningLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  async list(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.lessonsService.listLessons();
  }

  @Get(':id/progress')
  async getProgress(@CurrentUser() user: User | null, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.lessonsService.getLessonProgress(user.id, id);
  }

  @Put(':id/progress')
  async saveProgress(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: SaveLessonProgressDto,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.lessonsService.saveLessonProgress(
      user.id,
      id,
      dto.segment_index,
      dto.completed,
    );
  }

  @Get(':id')
  async get(@CurrentUser() user: User | null, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.lessonsService.getLesson(id);
  }
}
