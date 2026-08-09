export interface VoiceRoomNote {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string;
  content: string;
  vocabulary?: string | null;
  created_at: string;
}
