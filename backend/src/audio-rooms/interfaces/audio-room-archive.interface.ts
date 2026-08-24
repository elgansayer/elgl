export type AudioRoomSummaryStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed';

export interface AudioRoomArchiveSummary {
  room_id: string;
  recording_url: string | null;
  transcript_text: string | null;
  session_summary: string | null;
  vocabulary: string[];
  summary_status: AudioRoomSummaryStatus;
  summary_attempts: number;
  updated_at: string;
}

export interface AudioRoomArchiveListItem {
  id: string;
  title: string;
  language_pair?: string | null;
  topic_tag?: string | null;
  host_id: string;
  is_private: boolean;
  recording_url: string | null;
  created_at: string;
  summary_status: AudioRoomSummaryStatus | null;
}

export interface FinalizeAudioRoomArchiveResult {
  room_id: string;
  recording_url: string | null;
  summary_status: AudioRoomSummaryStatus;
}
