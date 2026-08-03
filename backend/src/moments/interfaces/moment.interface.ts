export interface MomentComment {
  id: string;
  moment_id: string;
  user_id: string;
  text_content?: string;
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  };
  created_at: string;
  upVotes?: number;
  downVotes?: number;
  userVote?: string | null;
  author?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

export interface MomentRecord {
  id: string;
  user_id: string;
  text_content?: string;
  media_urls?: string[];
  media_type: 'none' | 'images' | 'audio' | 'video';
  target_language: string;
  post_type?: 'moment' | 'question' | 'language_question';
  question_text?: string;
  question_options?: string[];
  correct_answer?: string;
  correct_answers_count?: number;
  total_answers_count?: number;
  is_pinned: boolean; // Indicates if the moment is pinned
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_ephemeral?: boolean;
  expires_at?: string;
  author?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  is_liked_by_me?: boolean;
}
