import { describe, expect, it } from 'vitest';
import {
  MAX_AUDIENCE_COUNT,
  MAX_RENDERED_STAGE_PARTICIPANTS,
  MAX_VISIBLE_AUDIENCE_SEATS,
  buildAudienceSeatIndexes,
  buildStageViewModel,
  normaliseAudienceCount,
} from './audio-room-view-model';
import {
  AudioRoomRecord,
  StageInfo,
  StageParticipant,
} from '../../services/audio-rooms.store';

function room(overrides: Partial<AudioRoomRecord> = {}): AudioRoomRecord {
  return {
    id: 'room-1',
    room_name: 'audio-room-1',
    title: 'Japanese practice',
    target_language: 'ja',
    language_pair: 'en-ja',
    topic_tag: 'conversation',
    host_id: 'host-1',
    co_host_id: null,
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 0,
    created_at: '2026-08-21T12:00:00.000Z',
    host: {
      id: 'host-1',
      display_name: 'Host Person',
      avatar_url: '/host.png',
    },
    ...overrides,
  };
}

function participant(
  userId: string,
  overrides: Partial<StageParticipant> = {},
): StageParticipant {
  return {
    user_id: userId,
    display_name: `User ${userId}`,
    avatar_url: null,
    isSpeaking: false,
    isMuted: false,
    isHost: false,
    isCoHost: false,
    ...overrides,
  };
}

function stage(overrides: Partial<StageInfo> = {}): StageInfo {
  return {
    room_id: 'room-1',
    room_name: 'audio-room-1',
    host: {
      id: 'host-1',
      display_name: 'Host Person',
      avatar_url: '/host.png',
    },
    co_host_id: null,
    speakers: [
      {
        user_id: 'host-1',
        display_name: 'Host Person',
        avatar_url: '/host.png',
      },
    ],
    raised_hands: [],
    listeners_count: 0,
    ...overrides,
  };
}

describe('audio room stage view model', () => {
  it('renders the host exactly once even when an older room omits them from speakers', () => {
    const result = buildStageViewModel(
      room({ speakers: ['speaker-1'] }),
      stage({
        speakers: [
          {
            user_id: 'speaker-1',
            display_name: 'Speaker One',
            avatar_url: null,
          },
        ],
      }),
      [participant('speaker-1')],
    );

    expect(result.participants.map((item) => item.user_id)).toEqual([
      'host-1',
      'speaker-1',
    ]);
    expect(result.participants.filter((item) => item.isHost)).toHaveLength(1);
    expect(result.participants[0].display_name).toBe('Host Person');
  });

  it('orders host then co-host while preserving live speaking and mute state', () => {
    const result = buildStageViewModel(
      room({ co_host_id: 'cohost-1' }),
      stage({
        co_host_id: 'cohost-1',
        speakers: [
          { user_id: 'speaker-1', display_name: 'Speaker One', avatar_url: null },
          { user_id: 'cohost-1', display_name: 'Co Host', avatar_url: null },
          { user_id: 'host-1', display_name: 'Host Person', avatar_url: '/host.png' },
        ],
      }),
      [
        participant('speaker-1', { isSpeaking: true }),
        participant('host-1'),
        participant('cohost-1', { isMuted: true }),
      ],
    );

    expect(result.participants.map((item) => item.user_id)).toEqual([
      'host-1',
      'cohost-1',
      'speaker-1',
    ]);
    expect(result.participants[1]).toMatchObject({ isCoHost: true, isMuted: true });
    expect(result.participants[2].isSpeaking).toBe(true);
  });

  it('deduplicates repeated participant identities', () => {
    const result = buildStageViewModel(room(), stage(), [
      participant('host-1'),
      participant('host-1', { display_name: 'Duplicate' }),
    ]);

    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].display_name).not.toBe('Duplicate');
  });

  it('bounds rendered stage cards and reports the hidden remainder', () => {
    const speakers = Array.from(
      { length: MAX_RENDERED_STAGE_PARTICIPANTS + 5 },
      (_, index) => participant(`speaker-${index}`),
    );
    const stageSpeakers = speakers.map((item) => ({
      user_id: item.user_id,
      display_name: item.display_name,
      avatar_url: item.avatar_url,
    }));

    const result = buildStageViewModel(
      room({ host_id: 'speaker-0', host: undefined }),
      stage({
        host: {
          id: 'speaker-0',
          display_name: 'Host',
          avatar_url: null,
        },
        speakers: stageSpeakers,
      }),
      speakers,
    );

    expect(result.participants).toHaveLength(MAX_RENDERED_STAGE_PARTICIPANTS);
    expect(result.overflowCount).toBe(5);
  });

  it('returns an empty stage when no room is selected', () => {
    expect(buildStageViewModel(null, null, [])).toEqual({
      participants: [],
      overflowCount: 0,
    });
  });
});

describe('audio room audience view model', () => {
  it('normalises invalid and fractional counts before rendering', () => {
    expect(normaliseAudienceCount(Number.NaN)).toBe(0);
    expect(normaliseAudienceCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normaliseAudienceCount(-4)).toBe(0);
    expect(normaliseAudienceCount(4.9)).toBe(4);
  });

  it('caps untrusted counters without allocating an unbounded audience grid', () => {
    expect(normaliseAudienceCount(MAX_AUDIENCE_COUNT * 10)).toBe(MAX_AUDIENCE_COUNT);
    expect(buildAudienceSeatIndexes(MAX_AUDIENCE_COUNT)).toHaveLength(
      MAX_VISIBLE_AUDIENCE_SEATS,
    );
  });

  it('builds stable one-based anonymous seat indexes', () => {
    expect(buildAudienceSeatIndexes(3)).toEqual([1, 2, 3]);
    expect(buildAudienceSeatIndexes(0)).toEqual([]);
  });
});
