export interface CuratedArticle {
  id: string;
  title: string;
  cefr_level: string;
  language: string;
  source_url?: string;
  content_text: string;
  word_count?: number;
  difficulty_rating?: number;
  audio_url?: string;
  image_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface CuratedDialogue {
  id: string;
  title: string;
  cefr_level: string;
  language: string;
  source_url?: string;
  lines: {
    speaker: string;
    text: string;
    translation?: string;
    audioUrl?: string;
  }[];
  audio_url?: string;
  image_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}
