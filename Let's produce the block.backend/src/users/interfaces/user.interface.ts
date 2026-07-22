// Supabase User type (from @supabase/supabase-js)
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
  last_sign_in_at?: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  identities?: Array<{
    id: string;
    user_id: string;
    identity_data: Record<string, any>;
    provider: string;
    created_at: string;
    last_sign_in_at: string;
  }>;
  created_at: string;
  updated_at?: string;
}
