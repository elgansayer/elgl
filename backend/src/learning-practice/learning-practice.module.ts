import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { IpaAlphabetController } from './ipa-alphabet.controller';
import { IpaAlphabetService } from './ipa-alphabet.service';
import { PracticeProgressService } from './practice-progress.service';
import { VerbConjugationController } from './verb-conjugation.controller';
import { VerbConjugationService } from './verb-conjugation.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [VerbConjugationController, IpaAlphabetController],
  providers: [
    VerbConjugationService,
    IpaAlphabetService,
    PracticeProgressService,
  ],
  exports: [
    VerbConjugationService,
    IpaAlphabetService,
    PracticeProgressService,
  ],
})
export class LearningPracticeModule {}
