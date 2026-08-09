import { Injectable } from '@nestjs/common';
import { AssessmentResultDto } from './dto/assessment-result.dto';
import {
  AssessmentResult,
  ProficiencyLevel,
} from './interfaces/proficiency.interface';
import { LanguageSelectionDto } from './dto/language-selection.dto';
import { XpService } from '../xp/xp.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ProficiencyService {
  constructor(
    private readonly xpService: XpService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async assess(
    assessment: AssessmentResultDto,
    userId: string,
  ): Promise<AssessmentResult> {
    const scores: number[] = [];
    if (assessment.grammarScore !== undefined)
      scores.push(assessment.grammarScore);
    if (assessment.vocabularyScore !== undefined)
      scores.push(assessment.vocabularyScore);
    if (assessment.pronunciationScore !== undefined)
      scores.push(assessment.pronunciationScore);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 50;
    const overallScore = Math.round(avgScore * 10) / 10;
    const level = this.mapScoreToLevel(overallScore);

    // Persist proficiency level in database
    const supabase = this.supabaseService.getClient();
    const { error: updateError } = await supabase
      .from('users')
      .update({ proficiency_level: level })
      .eq('id', userId);
    if (updateError) {
      throw new Error(
        `Failed to save proficiency level: ${updateError.message}`,
      );
    }

    await this.xpService.awardXpForActivity(userId, 'complete_assessment');

    const result: AssessmentResult = {
      level,
      overallScore,
      grammarScore: assessment.grammarScore ?? 0,
      vocabularyScore: assessment.vocabularyScore ?? 0,
      pronunciationScore: assessment.pronunciationScore ?? 0,
      testedAt: new Date().toISOString(),
    };

    return result;
  }

  async setLanguages(dto: LanguageSelectionDto): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const languageCodes = dto.targetLanguages.map((t) => t.language);
    const languageLevels = dto.targetLanguages.reduce(
      (acc, t) => {
        acc[t.language] = t.level;
        return acc;
      },
      {} as Record<string, string>,
    );

    const { error } = await supabase
      .from('users')
      .update({
        native_languages: [dto.nativeLanguage],
        target_languages: languageCodes,
        language_levels: languageLevels,
      })
      .eq('id', dto.userId);

    if (error) {
      throw new Error(`Failed to update user languages: ${error.message}`);
    }
  }

  private mapScoreToLevel(score: number): ProficiencyLevel {
    if (score < 20) return ProficiencyLevel.A1;
    if (score < 40) return ProficiencyLevel.A2;
    if (score < 60) return ProficiencyLevel.B1;
    if (score < 80) return ProficiencyLevel.B2;
    if (score < 95) return ProficiencyLevel.C1;
    return ProficiencyLevel.C2;
  }
}
