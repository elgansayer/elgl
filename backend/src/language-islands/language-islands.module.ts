import { Module } from '@nestjs/common';
import { LanguageIslandsController } from './language-islands.controller';
import { LanguageIslandsService } from './language-islands.service';

@Module({
  controllers: [LanguageIslandsController],
  providers: [LanguageIslandsService],
  exports: [LanguageIslandsService],
})
export class LanguageIslandsModule {}
