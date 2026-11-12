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
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { WordOfTheDay, WordOfTheDayService } from './word-of-the-day.service';

@Controller('word-of-the-day')
@UseGuards(SupabaseAuthGuard)
export class WordOfTheDayController {
  constructor(private readonly service: WordOfTheDayService) {}

  /**
   * Returns the deterministic UTC word for the signed-in learner's primary
   * target language. The body depends on the learner's profile and rolls over
   * at UTC midnight, and every request is authenticated, so no shared cache may
   * keep it: CacheControlInterceptor would downgrade an edge directive to
   * no-store for an Authorization header anyway, so the policy is explicit.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  async findOne(@CurrentUser() user: User | null): Promise<WordOfTheDay> {
    if (!user) throw new UnauthorizedException();
    return this.service.getTodayWordForUser(user.id);
  }
}
