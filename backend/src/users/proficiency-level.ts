export const PROFICIENCY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export function isProficiencyLevel(value: unknown): value is ProficiencyLevel {
  return typeof value === 'string' && (PROFICIENCY_LEVELS as readonly string[]).includes(value);
}
