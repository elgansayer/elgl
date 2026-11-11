export interface Event {
  id: string;
  title: string;
  description?: string;
  category?: string;
  date_time: string;
  location?: string;
  venue_type?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ticket_price_gbp?: number | null;
  ticket_price_usd?: number | null;
  host_id: string;
  language_pair?: string;
  max_participants?: number;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}
