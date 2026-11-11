import { ClassReplay } from './interfaces/class-replay.interface';

export function replayFixture(
  overrides: Partial<ClassReplay> = {},
): ClassReplay {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    host_id: 'host-1',
    room_id: 'room-1',
    title: 'Travel phrases',
    description: null,
    status: 'ready',
    hls_url: 'https://media.example.test/replay.m3u8',
    dash_url: 'https://media.example.test/replay.mpd',
    download_url: 'https://media.example.test/replay.mp4',
    thumbnail_url: null,
    duration_seconds: 60,
    failure_code: null,
    ready_at: '2026-11-11T08:00:00.000Z',
    expires_at: null,
    created_at: '2026-11-11T08:00:00.000Z',
    updated_at: '2026-11-11T08:00:00.000Z',
    ...overrides,
  };
}
