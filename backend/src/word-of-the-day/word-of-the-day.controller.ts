import { Controller, Get } from '@nestjs/common';
import { WordOfTheDayService } from './word-of-the-day.service';

@Controller('word-of-the-day')
export class WordOfTheDayController {
  constructor(private readonly service: WordOfTheDayService) {}

  @Get()
  findOne() {
    return this.service.getTodayWord();
  }
}
