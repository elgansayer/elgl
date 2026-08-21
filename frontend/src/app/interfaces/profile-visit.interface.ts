export interface ProfileVisit {
  id: string;
  created_at: string;
  is_blurred: boolean;
  visitor: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    native_language: string;
    target_languages: string[];
    bio_text?: string;
    is_vip?: boolean;
  };
}
