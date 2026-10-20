export type FlashcardAnswerGrade = 'again' | 'good' | 'known';
export type FlashcardAnswerMatch = 'exact' | 'partial' | 'incorrect' | 'unavailable';

export interface FlashcardAnswerAssessment {
  match: FlashcardAnswerMatch;
  score: number;
  distance: number | null;
  suggestedGrade: FlashcardAnswerGrade | null;
}

const MAX_SCORABLE_CODE_POINTS = 256;
const MAX_ALTERNATIVES = 8;

function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function splitExpectedAnswers(value: string): string[] {
  const alternatives = value
    .split(/(?:\s+\/\s+|\s*;\s*|\n+)/u)
    .map(normalizeAnswer)
    .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);

  return alternatives.slice(0, MAX_ALTERNATIVES);
}

function allowedMinorEdits(expectedLength: number): number {
  if (expectedLength < 3) return 0;
  if (expectedLength <= 7) return 1;
  if (expectedLength <= 14) return 2;
  return Math.min(3, Math.max(2, Math.floor(expectedLength * 0.12)));
}

/**
 * Optimal-string-alignment Damerau-Levenshtein distance over Unicode code points.
 * Adjacent transpositions count as one edit, which better matches common typing errors.
 */
function editDistance(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Uint16Array(columns));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      let distance = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );

      if (
        row > 1 &&
        column > 1 &&
        a[row - 1] === b[column - 2] &&
        a[row - 2] === b[column - 1]
      ) {
        distance = Math.min(distance, matrix[row - 2][column - 2] + 1);
      }

      matrix[row][column] = distance;
    }
  }

  return matrix[a.length][b.length];
}

export function scoreFlashcardAnswer(
  expectedAnswer: string,
  submittedAnswer: string,
): FlashcardAnswerAssessment {
  const submitted = normalizeAnswer(submittedAnswer);
  const alternatives = splitExpectedAnswers(expectedAnswer);

  if (submitted.length === 0 || alternatives.length === 0) {
    return { match: 'unavailable', score: 0, distance: null, suggestedGrade: null };
  }

  const submittedLength = Array.from(submitted).length;
  if (
    submittedLength > MAX_SCORABLE_CODE_POINTS ||
    alternatives.some((answer) => Array.from(answer).length > MAX_SCORABLE_CODE_POINTS)
  ) {
    return { match: 'unavailable', score: 0, distance: null, suggestedGrade: null };
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestLength = 0;

  for (const expected of alternatives) {
    const expectedLength = Array.from(expected).length;
    const distance = editDistance(expected, submitted);
    if (distance < bestDistance || (distance === bestDistance && expectedLength > bestLength)) {
      bestDistance = distance;
      bestLength = expectedLength;
    }
  }

  const denominator = Math.max(bestLength, submittedLength, 1);
  const score = Math.max(0, Math.round((1 - bestDistance / denominator) * 100));

  if (bestDistance === 0) {
    return { match: 'exact', score: 100, distance: 0, suggestedGrade: 'known' };
  }

  if (bestDistance <= allowedMinorEdits(bestLength)) {
    return { match: 'partial', score, distance: bestDistance, suggestedGrade: 'good' };
  }

  return { match: 'incorrect', score, distance: bestDistance, suggestedGrade: 'again' };
}
