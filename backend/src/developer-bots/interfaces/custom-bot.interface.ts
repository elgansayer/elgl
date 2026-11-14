export const CUSTOM_BOT_TONES = [
  'friendly',
  'formal',
  'playful',
  'strict',
] as const;

export type CustomBotTone = (typeof CUSTOM_BOT_TONES)[number];

export interface CustomEducationalBotRow {
  id: string;
  owner_id: string;
  display_name: string;
  persona: string;
  target_language: string;
  tone: CustomBotTone;
  greeting: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}
