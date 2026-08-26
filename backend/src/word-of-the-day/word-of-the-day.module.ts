import { Module } from '@nestjs/common';
import { WordOfTheDayController } from './word-of-the-day.controller';
import { WordOfTheDayService } from './word-of-the-day.service';

@Module({
  controllers: [WordOfTheDayController],
  providers: [WordOfTheDayService],
})
export class WordOfTheDayModule {}
