import { Injectable } from '@nestjs/common';
import { AssessmentResultDto } from './dto/assessment-result.dto';
import {
  AssessmentResult,
  ProficiencyLevel,
} from './interfaces/proficiency.interface';
import { XpService } from '../xp/xp.service';

@Injectable()
export class ProficiencyService {
  constructor(private readonly xpService: XpService) {}

  assess(assessment: AssessmentResultDto): AssessmentResult {
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

    const result: AssessmentResult = {
      level,
      overallScore,
      grammarScore: assessment.grammarScore ?? 0,
      vocabularyScore: assessment.vocabularyScore ?? 0,
      pronunciationScore: assessment.pronunciationScore ?? 0,
      testedAt: new Date().toISOString(),
    };

    void this.xpService.awardXpForActivity(
      assessment.userId,
      'complete_assessment',
    );

    return result;
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
