import { createHash, randomBytes } from 'node:crypto';

const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REFERENCE_LENGTH = 10;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MAX_REFERENCE_LENGTH = 2048;

export type MaterialReference =
  | { kind: 'id'; id: string }
  | { kind: 'media'; url: string; ownerId: string }
  | { kind: 'unknown' };

/**
 * Adds whole business days (Monday to Friday, UTC) to an instant, keeping the
 * time of day. National holidays are deliberately not modelled: the statute
 * allows restoration between 10 and 14 business days, and ignoring holidays
 * keeps the restore inside that window.
 */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const result = new Date(from.getTime());
  let remaining = businessDays;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
}

/** Public, human-quotable identifier, for example `DMCA-7K2M9QX4TB`. */
export function generateNoticeReference(
  random: (size: number) => Buffer = randomBytes,
): string {
  const bytes = random(REFERENCE_LENGTH);
  let suffix = '';
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    // 32 symbols and a byte modulo 32 keep the distribution uniform.
    suffix +=
      REFERENCE_ALPHABET[(bytes[index] ?? 0) % REFERENCE_ALPHABET.length];
  }
  return `DMCA-${suffix}`;
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 256-bit single-purpose token; only its hash is stored. */
export function generateVerificationToken(
  random: (size: number) => Buffer = randomBytes,
): { token: string; hash: string } {
  const token = random(32).toString('base64url');
  return { token, hash: hashVerificationToken(token) };
}

export function normaliseClaimantEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Object key for a URL on our public media origin, or null when the URL points
 * anywhere else. Keys are decoded segment by segment and any traversal or
 * control character rejects the whole URL.
 */
export function keyFromPublicUrl(
  value: string,
  publicBaseUrl: string,
): string | null {
  let url: URL;
  let base: URL;
  try {
    url = new URL(value);
    base = new URL(publicBaseUrl);
  } catch {
    return null;
  }

  if (url.origin !== base.origin || url.search !== '' || url.hash !== '') {
    return null;
  }

  const basePath = base.pathname.replace(/\/+$/, '');
  if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
    return null;
  }

  const relative = url.pathname.slice(basePath.length + 1);
  if (!relative) return null;

  const segments: string[] = [];
  for (const rawSegment of relative.split('/')) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return null;
    }
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('/') ||
      segment.includes('\\') ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f]/.test(segment)
    ) {
      return null;
    }
    segments.push(segment);
  }

  const key = segments.join('/');
  return key.length <= 1024 ? key : null;
}

/**
 * Interprets what a claimant typed to identify the material: a content
 * identifier (or a link containing one), or the public URL of an uploaded file.
 * Uploaded files are stored as `<folder>/<ownerId>/<file>`, so the owner can be
 * read from the key and the search stays within that account.
 */
export function parseMaterialReference(
  reference: string,
  publicBaseUrl: string,
): MaterialReference {
  const trimmed = reference.trim();
  if (!trimmed || trimmed.length > MAX_REFERENCE_LENGTH) {
    return { kind: 'unknown' };
  }

  const key = keyFromPublicUrl(trimmed, publicBaseUrl);
  if (key) {
    const ownerSegment = key.split('/')[1];
    const owner = ownerSegment ? UUID_PATTERN.exec(ownerSegment) : null;
    if (owner && owner[0].length === ownerSegment?.length) {
      return { kind: 'media', url: trimmed, ownerId: owner[0].toLowerCase() };
    }
    return { kind: 'unknown' };
  }

  const uuid = UUID_PATTERN.exec(trimmed);
  return uuid ? { kind: 'id', id: uuid[0].toLowerCase() } : { kind: 'unknown' };
}

export function monthsBefore(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

export function daysBefore(from: Date, days: number): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function hoursAfter(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}
