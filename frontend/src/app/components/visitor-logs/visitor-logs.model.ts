import type { VisitorLog } from '../../services/user.service';

export const MAX_VISITOR_LOGS = 50;
const MAX_LANGUAGES = 10;
const MAX_DISPLAY_NAME_LENGTH = 120;
const HIDDEN_VISITOR_ID = 'hidden-vip-only';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function languageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_LANGUAGES);
}

function nativeLanguages(visitor: UnknownRecord): string[] {
  const plural = languageList(visitor['native_languages']);
  if (plural.length > 0) return plural;

  const singular = boundedString(visitor['native_language'], 32);
  return singular ? [singular] : [];
}

export function safeVisitorAvatarUrl(value: unknown): string | null {
  const candidate = boundedString(value, 2_048);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function normalizeVisitorLogs(value: unknown): VisitorLog[] {
  if (!Array.isArray(value)) return [];

  const normalized: VisitorLog[] = [];
  for (const raw of value.slice(0, MAX_VISITOR_LOGS)) {
    if (!isRecord(raw) || !isRecord(raw['visitor'])) continue;

    const id = boundedString(raw['id'], 128);
    const createdAt = boundedString(raw['created_at'], 64);
    if (!id || !createdAt || Number.isNaN(Date.parse(createdAt))) continue;

    const isBlurred = raw['is_blurred'] === true;
    if (isBlurred) {
      normalized.push({
        id,
        created_at: createdAt,
        is_blurred: true,
        visitor: {
          id: HIDDEN_VISITOR_ID,
          avatar_url: null,
          native_languages: [],
          target_languages: [],
        },
      });
      continue;
    }

    const visitor = raw['visitor'];
    const visitorId = boundedString(visitor['id'], 128);
    if (!visitorId) continue;

    normalized.push({
      id,
      created_at: createdAt,
      is_blurred: false,
      visitor: {
        id: visitorId,
        display_name: boundedString(visitor['display_name'], MAX_DISPLAY_NAME_LENGTH),
        avatar_url: safeVisitorAvatarUrl(visitor['avatar_url']),
        native_languages: nativeLanguages(visitor),
        target_languages: languageList(visitor['target_languages']),
        is_vip: typeof visitor['is_vip'] === 'boolean' ? visitor['is_vip'] : undefined,
      },
    });
  }

  return normalized;
}
