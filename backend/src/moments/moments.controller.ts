import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
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
import { CreateStoryDto } from './dto/create-story.dto';
import { EditTextDto } from './dto/edit-text.dto';
import { VoteCorrectionDto } from './dto/vote-correction.dto';
import { CreateLanguageQuestionDto } from './dto/create-language-question.dto';
import { AnswerLanguageQuestionDto } from './dto/answer-language-question.dto';
import { R2Service } from '../cloudflare-r2/r2.service';
import { MomentComment, MomentRecord } from './interfaces/moment.interface';
import { StoryResponse } from './interfaces/story.interface';
import { MomentLikesService } from './moment-likes.service';
import { MomentsService, MomentLikeUser } from './moments.service';

const MOMENT_FEED_FILTERS = [
  'All',
  'Classmates',
  'Following',
  'For You',
] as const;
type MomentFeedFilter = (typeof MOMENT_FEED_FILTERS)[number];

@Controller('moments')
@UseGuards(SupabaseAuthGuard)
export class MomentsController {
  constructor(
    private readonly momentsService: MomentsService,
    private readonly usersService: UsersService,
    private readonly r2Service: R2Service,
    private readonly momentLikesService: MomentLikesService,
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
    @Query('filter') filter?: string,
    @Query('lang') lang?: string,
  ): Promise<MomentRecord[]> {
    if (!user) return [];

    const activeFilter = this.parseFeedFilter(filter);
    const targetLanguage =
      activeFilter === 'Classmates'
        ? await this.resolveClassmatesLanguage(user.id, lang)
        : this.normaliseLanguage(lang);

    if (activeFilter === 'Classmates' && !targetLanguage) {
      return [];
    }

    const feed = await this.momentsService.getFeed(
      user.id,
      activeFilter,
      targetLanguage ?? undefined,
    );

    return feed.filter(
      (moment) =>
        !moment.id.startsWith('mock-moment-') &&
        (activeFilter !== 'Following' || moment.user_id !== user.id),
    );
  }

  private parseFeedFilter(filter?: string): MomentFeedFilter {
    if (!filter) return 'All';
    if (!MOMENT_FEED_FILTERS.includes(filter as MomentFeedFilter)) {
      throw new BadRequestException('Unsupported Moments feed filter');
    }
    return filter as MomentFeedFilter;
  }

  private normaliseLanguage(language?: string): string | null {
    const normalised = language?.trim().toLowerCase();
    return normalised || null;
  }

  private async resolveClassmatesLanguage(
    userId: string,
    requestedLanguage?: string,
  ): Promise<string | null> {
    const explicitLanguage = this.normaliseLanguage(requestedLanguage);
    if (explicitLanguage) return explicitLanguage;

    const profile = await this.usersService.getProfile(userId);
    return this.normaliseLanguage(profile?.target_languages?.[0]);
  }

  @Get('lifetime-counts')
  async getLifetimeCounts(@CurrentUser() user: User | null): Promise<{
    translations: number;
    corrections: number;
    moments: number;
  } | null> {
    if (!user) return null;
    return await this.momentsService.getLifetimeCounts(user.id);
  }

  @Get('stories')
  async getActiveStories(
    @CurrentUser() user: User | null,
  ): Promise<MomentRecord[]> {
    if (!user) return [];
    return await this.momentsService.getActiveStories(user.id);
  }

  @Post('upload-voice')
  async uploadVoice(
    @CurrentUser() user: User | null,
    @Body('filename') filename: string,
    @Body('contentType') contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string } | null> {
    if (!user) return null;
    return await this.momentsService.getVoiceUploadUrl(
      user.id,
      filename,
      contentType,
    );
  }

  @Post('upload-media')
  async uploadMedia(
    @CurrentUser() user: User | null,
    @Body('filename') filename: string,
    @Body('contentType') contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
    ];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException();
    }
    // user is authenticated via guard, no VIP check needed for general media uploads
    return await this.momentsService.getMediaUploadUrl(filename, contentType);
  }

  @Post('stories')
  async createStory(
    @CurrentUser() user: User | null,
    @Body() dto: CreateStoryDto,
  ): Promise<StoryResponse | null> {
    if (!user) return null;
    return await this.momentsService.createStory(user.id, dto);
  }

  @Post('language-questions')
  async createLanguageQuestion(
    @CurrentUser() user: User | null,
    @Body() dto: CreateLanguageQuestionDto,
  ): Promise<MomentRecord | null> {
    if (!user) return null;
    return await this.momentsService.createLanguageQuestion(user.id, dto);
  }

  @Post(':id/answer')
  async answerLanguageQuestion(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: AnswerLanguageQuestionDto,
  ): Promise<{ correct: boolean; correctAnswer: string } | null> {
    if (!user) return null;
    return await this.momentsService.answerLanguageQuestion(
      user.id,
      id,
      dto.answer,
    );
  }

  @Get('questions')
  async getQuestions(
    @CurrentUser() user: User | null,
    @Query('lang') lang?: string,
  ): Promise<MomentRecord[]> {
    if (!user) return [];
    return await this.momentsService.getQuestions(user.id, lang);
  }

  @Post(':id/like')
  async likeMoment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<{ likes_count: number; is_liked: boolean } | null> {
    if (!user) return null;
    return await this.momentsService.likeMoment(user.id, id);
  }

  @Get(':id/likes')
  async getMomentLikes(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query(
      'limit',
      new DefaultValuePipe(MomentLikesService.DEFAULT_LIMIT),
      ParseIntPipe,
    )
    limit: number,
  ): Promise<MomentLikeUser[]> {
    if (!user) return [];
    return await this.momentLikesService.listMomentLikes(id, user.id, {
      offset,
      limit,
    });
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

  @Post(':id/comments/:commentId/vote')
  async voteOnCorrection(
    @CurrentUser() user: User | null,
    @Param('id') momentId: string,
    @Param('commentId') commentId: string,
    @Body() dto: VoteCorrectionDto,
  ): Promise<{
    commentId: string;
    vote: string;
    upVotes: number;
    downVotes: number;
    userVote: string | null;
  } | null> {
    if (!user) return null;
    return await this.momentsService.voteOnCorrection(
      user.id,
      commentId,
      dto.vote,
    );
  }

  @Get(':id/comments')
  async getComments(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<MomentComment[]> {
    return await this.momentsService.getComments(id, user?.id);
  }

  @Patch(':id/edit-text')
  async editMomentText(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: EditTextDto,
  ): Promise<MomentRecord | null> {
    if (!user) return null;
    return await this.momentsService.editMomentText(user.id, id, dto);
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
