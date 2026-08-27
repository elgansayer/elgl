export interface TranslationResult {
  original_text: string;
  translated_text: string;
  detected_language: string;
  transliteration?: string;
  definition?: string;
  pronunciation_url?: string;
}

export interface GrammarCheckResult {
  original: string;
  corrected: string;
  explanation: string;
  errors_found: number;
}

export interface PhonemeScore {
  phoneme: string;
  score: number;
  expected_phoneme: string;
  feedback?: string;
}

export interface WordBreakdownItem {
  word: string;
  score: number;
  feedback?: string;
  phonemes: PhonemeScore[];
}

export interface PronunciationScoreResult {
  overall_score: number;
  breakdown: WordBreakdownItem[];
  feedback_summary: string;
  detected_language?: string;
  transcription?: string;
}

export interface TranslateUiResult {
  target_language: string;
  translations: Record<string, string>;
  cached: boolean;
}

export interface TranscribeVoiceResult {
  original_text: string;
  detected_language: string;
  confidence: number;
}
