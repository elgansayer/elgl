import { Controller, Get, UseInterceptors } from '@nestjs/common';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_SHORT,
} from '../common/cache.interceptor';
import { WordOfTheDayService } from './word-of-the-day.service';

@Controller('word-of-the-day')
export class WordOfTheDayController {
  constructor(private readonly service: WordOfTheDayService) {}

  /**
   * The response is stable for a UTC calendar day. A short edge TTL avoids a
   * 24-hour cache entry crossing midnight and serving yesterday's word for a
   * full additional day.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  findOne() {
    return this.service.getTodayWord();
  }
}
