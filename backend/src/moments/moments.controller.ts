import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from '../users/users.service';
import { CreateCommentDto, CreateMomentDto } from './dto/moment.dto';
import { MomentComment, MomentRecord } from './interfaces/moment.interface';
import { MomentsService } from './moments.service';

@Controller('moments')
@UseGuards(SupabaseAuthGuard)
export class MomentsController {
  constructor(
    private readonly momentsService: MomentsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async createMoment(
    @CurrentUser() user: User | null,
    @Body() dto: CreateMomentDto,
  ): Promise<MomentRecord | null> {
    if (!user) return null;
    return await this.momentsService.createMoment(user.id, dto);
  }

  @Get('feed')
  async getFeed(
    @CurrentUser() user: User | null,
    @Query('filter') filter?: 'All' | 'Classmates' | 'Following',
    @Query('lang') lang?: string,
  ): Promise<MomentRecord[]> {
    if (!user) return [];
    const activeFilter = filter ?? 'All';
    return await this.momentsService.getFeed(user.id, activeFilter, lang);
  }

  @Post(':id/like')
  async likeMoment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<{ likes_count: number; is_liked: boolean } | null> {
    if (!user) return null;
    return await this.momentsService.likeMoment(user.id, id);
  }

  @Post(':id/comments')
  async addComment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<MomentComment | null> {
    if (!user) return null;
    return await this.momentsService.addComment(user.id, id, dto);
  }

  @Get(':id/comments')
  async getComments(@Param('id') id: string): Promise<MomentComment[]> {
    return await this.momentsService.getComments(id);
  }

  @Patch(':id/pin')
  async pinMoment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<MomentRecord | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.momentsService.pinMoment(
      user.id,
      profile?.is_vip ?? false,
      id,
    );
  }
}
