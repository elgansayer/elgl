export interface User {
  id: string;
  aud: string;
  role: string;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  cover_photo_url?: string;
  proficiency_level?: string;
}
