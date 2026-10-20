import { Module } from '@nestjs/common';
import { LanguageChallengesController } from './language-challenges.controller';
import { LanguageChallengesService } from './language-challenges.service';

@Module({
  controllers: [LanguageChallengesController],
  providers: [LanguageChallengesService],
  exports: [LanguageChallengesService],
})
export class LanguageChallengesModule {}
