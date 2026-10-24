import { Module } from '@nestjs/common';
import { LanguageChallengesController } from './language-challenges.controller';
import { LanguageChallengesService } from './language-challenges.service';
import { MonetisationModule } from '../monetisation/monetisation.module';

@Module({
  imports: [MonetisationModule],
  controllers: [LanguageChallengesController],
  providers: [LanguageChallengesService],
  exports: [LanguageChallengesService],
})
export class LanguageChallengesModule {}
