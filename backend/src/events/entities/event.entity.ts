export interface Event {
  id: string;
  title: string;
  description?: string;
  category?: string;
  date_time: string;
  location?: string;
  host_id: string;
  language_pair?: string;
  max_participants?: number;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}
