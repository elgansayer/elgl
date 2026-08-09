import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Controller('admin/lessons')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  async list() {
    return this.lessonsService.listLessons();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.lessonsService.getLesson(id);
  }

  @Post()
  async create(@Body() dto: CreateLessonDto) {
    return this.lessonsService.createLesson(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.lessonsService.updateLesson(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.lessonsService.deleteLesson(id);
  }
}
