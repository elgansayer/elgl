export interface Lesson {
  id: string;
  title: string;
  description?: string;
  content_json?: Record<string, unknown>;
  language_code: string;
  difficulty_level?: number;
  created_at: string;
  updated_at: string;
}
