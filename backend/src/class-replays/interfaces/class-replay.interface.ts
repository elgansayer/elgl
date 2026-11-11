export type ClassReplayStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface ClassReplay {
  id: string;
  host_id: string;
  room_id: string | null;
  title: string;
  description: string | null;
  status: ClassReplayStatus;
  hls_url: string | null;
  dash_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  failure_code: string | null;
  ready_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassReplayPlayback {
  replay_id: string;
  status: ClassReplayStatus;
  hls_url: string | null;
  dash_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  expires_at: string | null;
}
