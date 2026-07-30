export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: 'attending' | 'interested';
  created_at: string;
}
