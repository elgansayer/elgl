export enum ProficiencyLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export interface AssessmentResult {
  level: ProficiencyLevel;
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  pronunciationScore: number;
  testedAt: string;
}
