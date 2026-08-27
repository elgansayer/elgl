import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { FollowHashtagDto } from './dto/hashtag-topic.dto';
import {
  HashtagTopicsService,
  type HashtagTopicSummary,
} from './hashtag-topics.service';
import type { MomentRecord } from './interfaces/moment.interface';

@Controller('moments/topics')
@UseGuards(SupabaseAuthGuard)
export class HashtagTopicsController {
  constructor(private readonly hashtagTopicsService: HashtagTopicsService) {}

  @Get('following')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async listFollowing(
    @CurrentUser() user: User | null,
  ): Promise<{ hashtags: string[] }> {
    return {
      hashtags: await this.hashtagTopicsService.listFollowed(this.requireUser(user)),
    };
  }

  @Post('follow')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async follow(
    @CurrentUser() user: User | null,
    @Body() dto: FollowHashtagDto,
  ): Promise<{ hashtag: string; is_following: true }> {
    return this.hashtagTopicsService.follow(this.requireUser(user), dto.hashtag);
  }

  @Delete(':hashtag')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async unfollow(
    @CurrentUser() user: User | null,
    @Param('hashtag') hashtag: string,
  ): Promise<{ hashtag: string; is_following: false }> {
    return this.hashtagTopicsService.unfollow(this.requireUser(user), hashtag);
  }

  @Get('feed')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getTopicsFeed(@CurrentUser() user: User | null): Promise<MomentRecord[]> {
    return this.hashtagTopicsService.getTopicsFeed(this.requireUser(user));
  }

  @Get('trending')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getTrending(
    @CurrentUser() user: User | null,
    @Query('limit') rawLimit?: string,
  ): Promise<HashtagTopicSummary[]> {
    const parsedLimit = rawLimit === undefined ? undefined : Number(rawLimit);
    return this.hashtagTopicsService.getTrending(
      this.requireUser(user),
      parsedLimit,
    );
  }

  @Get('hashtag/:hashtag')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getHashtagFeed(
    @CurrentUser() user: User | null,
    @Param('hashtag') hashtag: string,
  ): Promise<{
    hashtag: string;
    is_following: boolean;
    moments: MomentRecord[];
  }> {
    return this.hashtagTopicsService.getHashtagFeed(
      this.requireUser(user),
      hashtag,
    );
  }

  private requireUser(user: User | null): string {
    if (!user?.id) throw new UnauthorizedException();
    return user.id;
  }
}
