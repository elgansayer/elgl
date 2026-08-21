import { Controller, Get, UseInterceptors } from '@nestjs/common';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
} from '../common/cache.interceptor';
import { WordOfTheDayService } from './word-of-the-day.service';

@Controller('word-of-the-day')
export class WordOfTheDayController {
  constructor(private readonly service: WordOfTheDayService) {}

  /**
   * Word of the day changes once daily.
   * Aggressive public CDN caching is safe and recommended.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  findOne() {
    return this.service.getTodayWord();
  }
}
