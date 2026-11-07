import type { ProfileVisit, ProfileVisitorsPage } from '../interfaces/profile-visit.interface';

/** Matches the backend page-size ceiling so one response is never an unbounded history scan. */
export const MAX_PROFILE_VISITS_PER_PAGE = 50;

/** Opaque identifier given to every masked row. It never resolves to a real user. */
export const HIDDEN_VISITOR_ID = 'hidden-vip-only';

const MAX_LANGUAGES = 10;
const MAX_LANGUAGE_CODE_LENGTH = 32;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_TIMESTAMP_LENGTH = 64;
const MAX_AVATAR_URL_LENGTH = 2_048;

type UnknownRecord = Record<string, unknown>;

export interface ProfileVisitorsPageRequest {
  limit: number;
  offset: number;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function languageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_LANGUAGES);
}

/**
 * Older profile-visit rows exposed a singular `native_language`. Accept both shapes and expose the
 * frontend `native_languages: string[]` contract so mixed-version deployments keep rendering.
 */
function nativeLanguages(visitor: UnknownRecord): string[] {
  const plural = languageList(visitor['native_languages']);
  if (plural.length > 0) return plural;

  const singular = boundedString(visitor['native_language'], MAX_LANGUAGE_CODE_LENGTH);
  return singular ? [singular] : [];
}

/** Accepts only absolute HTTP(S) avatar URLs that carry no embedded credentials. */
export function safeVisitorAvatarUrl(value: unknown): string | null {
  const candidate = boundedString(value, MAX_AVATAR_URL_LENGTH);
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

function maskedVisit(id: string, createdAt: string): ProfileVisit {
  return {
    id,
    created_at: createdAt,
    is_blurred: true,
    visitor: {
      id: HIDDEN_VISITOR_ID,
      avatar_url: null,
      native_languages: [],
      target_languages: [],
    },
  };
}

function visibleVisit(
  id: string,
  createdAt: string,
  visitor: UnknownRecord,
): ProfileVisit | undefined {
  const visitorId = boundedString(visitor['id'], MAX_IDENTIFIER_LENGTH);
  if (!visitorId || visitorId === HIDDEN_VISITOR_ID) return undefined;

  return {
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
  };
}

/**
 * Treats a `/profile-visits/my-visitors` response as untrusted and returns a page whose identity
 * state is internally consistent.
 *
 * The page exposes visitor identities only when the server marks the whole page as
 * `identity_visible` and no row is flagged `is_blurred`. In every other case each row is replaced
 * with an opaque masked row before any component stores it, so names, avatars, identifiers,
 * biography text and language metadata accidentally included in a masked response can never reach
 * component state, the DOM or analytics. CSS blur is presentation only and is never the privacy
 * boundary.
 *
 * Throws when the payload is not a visitor page at all, so callers show their error and retry state
 * instead of a misleading "no visitors yet" message.
 */
export function normaliseProfileVisitorsPage(
  value: unknown,
  request: ProfileVisitorsPageRequest,
): ProfileVisitorsPage {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    throw new Error('Unexpected profile visitors response');
  }

  const rawItems: unknown[] = value['items'].slice(0, MAX_PROFILE_VISITS_PER_PAGE);
  const identityVisible =
    value['identity_visible'] === true &&
    rawItems.every((raw) => !isRecord(raw) || raw['is_blurred'] !== true);

  const items: ProfileVisit[] = [];
  for (const raw of rawItems) {
    if (!isRecord(raw)) continue;

    const id = boundedString(raw['id'], MAX_IDENTIFIER_LENGTH);
    const createdAt = boundedString(raw['created_at'], MAX_TIMESTAMP_LENGTH);
    if (!id || !createdAt || Number.isNaN(Date.parse(createdAt))) continue;

    if (!identityVisible) {
      items.push(maskedVisit(id, createdAt));
      continue;
    }

    const visitor = raw['visitor'];
    const visit = isRecord(visitor) ? visibleVisit(id, createdAt, visitor) : undefined;
    if (visit) items.push(visit);
  }

  const requestedLimit = Math.min(
    Math.max(Math.trunc(request.limit) || 1, 1),
    MAX_PROFILE_VISITS_PER_PAGE,
  );
  const limit = Math.min(
    Math.max(nonNegativeInteger(value['limit']) ?? requestedLimit, 1),
    MAX_PROFILE_VISITS_PER_PAGE,
  );
  const offset = nonNegativeInteger(value['offset']) ?? Math.max(Math.trunc(request.offset) || 0, 0);
  const hasMore = value['has_more'] === true;

  // A repeated or backwards cursor would make "load more" loop on the same page, so only a cursor
  // that moves forward is trusted. Otherwise fall back to the next contiguous window.
  const advertisedNextOffset = nonNegativeInteger(value['next_offset']);
  const nextOffset = hasMore
    ? advertisedNextOffset !== null && advertisedNextOffset > offset
      ? advertisedNextOffset
      : offset + limit
    : null;

  return {
    items,
    identity_visible: identityVisible,
    limit,
    offset,
    has_more: hasMore,
    next_offset: nextOffset,
  };
}
