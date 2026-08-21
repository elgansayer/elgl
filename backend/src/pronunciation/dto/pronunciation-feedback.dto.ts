export class PronunciationFeedbackResponseDto {
  score: number;
  phonemeBreakdown: string[];
  overallAssessment: string;
  language: string;
}

export class PronunciationFeedbackRequestDto {
  referenceText?: string;
}
