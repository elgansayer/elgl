export interface LessonProgress {
  progress_percent: number;
  last_position: number;
  completed: boolean;
  completed_at: string | null;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  content_json?: Record<string, unknown> | null;
  language_code: string;
  difficulty_level?: number | null;
  cover_image_url?: string | null;
  audio_url?: string | null;
  progress: LessonProgress;
}

export interface LessonSection {
  title: string | null;
  body: string;
}

export interface LessonProgressUpdate {
  progressPercent?: number;
  lastPosition?: number;
  completed?: boolean;
}
