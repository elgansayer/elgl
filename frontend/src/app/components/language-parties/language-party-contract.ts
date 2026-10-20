import { AudioRoomRecord } from '../../services/audio-rooms.store';

export interface LanguagePartySummary {
  id: string;
  title: string;
  target_language: string;
  language_pair: string;
  topic_tag?: string;
  level?: string;
  max_speakers?: number;
  duration_minutes?: number;
  host: { id: string; display_name: string; avatar_url: string | null } | null;
  speakers: string[];
  listeners_count: number;
}

const MAX_PARTIES = 50;
const MAX_SPEAKERS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function optionalBoundedString(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return boundedString(value, max) ?? undefined;
}

function safeAvatarUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const normalized: string[] = [];
  for (const item of value) {
    const parsed = boundedString(item, 128);
    if (!parsed) return null;
    normalized.push(parsed);
  }
  return normalized;
}

function normalizeCount(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

function normalizeHost(value: unknown): LanguagePartySummary['host'] {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return null;
  const id = boundedString(value['id'], 128);
  const displayName = boundedString(value['display_name'], 100);
  if (!id || !displayName) return null;
  return {
    id,
    display_name: displayName,
    avatar_url: safeAvatarUrl(value['avatar_url']),
  };
}

function normalizeSummary(value: unknown): LanguagePartySummary | null {
  if (!isRecord(value)) return null;
  const id = boundedString(value['id'], 128);
  const title = boundedString(value['title'], 100);
  const targetLanguage = boundedString(value['target_language'], 20);
  const languagePair = boundedString(value['language_pair'], 32);
  const speakers = normalizeStringArray(value['speakers'], MAX_SPEAKERS);
  const listenersCount = normalizeCount(value['listeners_count'], 1_000_000);
  if (!id || !title || !targetLanguage || !languagePair || !speakers || listenersCount === null) {
    return null;
  }

  const maxSpeakers = normalizeCount(value['max_speakers'], MAX_SPEAKERS);
  const durationMinutes = normalizeCount(value['duration_minutes'], 24 * 60);

  return {
    id,
    title,
    target_language: targetLanguage,
    language_pair: languagePair,
    topic_tag: optionalBoundedString(value['topic_tag'], 100),
    level: optionalBoundedString(value['level'], 32),
    max_speakers: maxSpeakers === null ? undefined : maxSpeakers,
    duration_minutes: durationMinutes === null ? undefined : durationMinutes,
    host: normalizeHost(value['host']),
    speakers,
    listeners_count: listenersCount,
  };
}

export function parseLanguagePartyList(value: unknown): LanguagePartySummary[] {
  if (!Array.isArray(value) || value.length > MAX_PARTIES) {
    throw new Error('Invalid language party response');
  }

  const parties: LanguagePartySummary[] = [];
  const seenIds = new Set<string>();
  for (const item of value) {
    const party = normalizeSummary(item);
    if (!party || seenIds.has(party.id)) continue;
    seenIds.add(party.id);
    parties.push(party);
  }
  return parties;
}

export function parseJoinableLanguagePartyRoom(
  value: unknown,
  expectedId?: string,
): AudioRoomRecord {
  if (!isRecord(value)) throw new Error('Invalid audio room response');

  const id = boundedString(value['id'], 128);
  const roomName = boundedString(value['room_name'], 200);
  const title = boundedString(value['title'], 100);
  const targetLanguage = boundedString(value['target_language'], 20);
  const hostId = boundedString(value['host_id'], 128);
  const createdAt = boundedString(value['created_at'], 64);
  const speakers = normalizeStringArray(value['speakers'], MAX_SPEAKERS);
  const raisedHands = normalizeStringArray(value['raised_hands'], MAX_SPEAKERS);
  const listenersCount = normalizeCount(value['listeners_count'], 1_000_000);

  if (
    !id ||
    !roomName ||
    !title ||
    !targetLanguage ||
    !hostId ||
    !createdAt ||
    !speakers ||
    !raisedHands ||
    listenersCount === null ||
    value['is_active'] !== true ||
    (expectedId !== undefined && id !== expectedId)
  ) {
    throw new Error('Invalid audio room response');
  }

  const partyType = optionalBoundedString(value['party_type'], 32);
  if (partyType && partyType !== 'language_party') {
    throw new Error('Unexpected audio room type');
  }

  const languagePair = optionalBoundedString(value['language_pair'], 32);
  const topicTag = optionalBoundedString(value['topic_tag'], 100);
  const coHostId = optionalBoundedString(value['co_host_id'], 128) ?? null;

  return {
    id,
    room_name: roomName,
    title,
    target_language: targetLanguage,
    language_pair: languagePair,
    topic_tag: topicTag,
    host_id: hostId,
    co_host_id: coHostId,
    is_video_stream: value['is_video_stream'] === true,
    is_active: true,
    speakers,
    raised_hands: raisedHands,
    listeners_count: listenersCount,
    recording_url: safeAvatarUrl(value['recording_url']),
    created_at: createdAt,
    is_private: value['is_private'] === true,
    invited_user_ids: normalizeStringArray(value['invited_user_ids'] ?? [], MAX_SPEAKERS) ?? [],
    party_type: partyType,
    host: normalizeHost(value['host']) ?? undefined,
  };
}
