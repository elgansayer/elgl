import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_EDGE_MEDIUM,
} from '../common/cache.interceptor';
import { WordOfTheDay, WordOfTheDayService } from './word-of-the-day.service';

@Controller('word-of-the-day')
@UseGuards(SupabaseAuthGuard)
export class WordOfTheDayController {
  constructor(private readonly service: WordOfTheDayService) {}

  /**
   * Returns the deterministic UTC word for the signed-in learner's primary
   * target language. Responses are partitioned by Authorization at the edge.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  async findOne(@CurrentUser() user: User | null): Promise<WordOfTheDay> {
    if (!user) throw new UnauthorizedException();
    return this.service.getTodayWordForUser(user.id);
  }
}
