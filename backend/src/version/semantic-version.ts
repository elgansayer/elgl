const MAX_VERSION_LENGTH = 64;

// Official semver.org grammar with an optional leading "v".
const SEMVER_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface ParsedSemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export function parseSemanticVersion(
  value: string,
): ParsedSemanticVersion | null {
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > MAX_VERSION_LENGTH) {
    return null;
  }

  const match = SEMVER_PATTERN.exec(candidate);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;

  return {
    major,
    minor,
    patch,
    prerelease: match[4] === undefined ? [] : match[4].split('.'),
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  // A release always has higher precedence than any of its prereleases.
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const l = left[index];
    const r = right[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;

    const lNumeric = /^\d+$/.test(l);
    const rNumeric = /^\d+$/.test(r);
    if (lNumeric && rNumeric) {
      // Identifiers have no leading zeroes, so length decides before value.
      if (l.length !== r.length) return l.length < r.length ? -1 : 1;
      return l < r ? -1 : 1;
    }
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (lNumeric !== rNumeric) return lNumeric ? -1 : 1;
    return l < r ? -1 : 1;
  }
  return 0;
}

/**
 * Compares two semantic versions by precedence. Returns a negative number when
 * `left` is older, zero when equivalent and a positive number when newer.
 * Malformed input returns `null` so callers never guess an ordering.
 */
export function compareSemanticVersions(
  left: string,
  right: string,
): number | null {
  const parsedLeft = parseSemanticVersion(left);
  const parsedRight = parseSemanticVersion(right);
  if (!parsedLeft || !parsedRight) return null;

  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major < parsedRight.major ? -1 : 1;
  }
  if (parsedLeft.minor !== parsedRight.minor) {
    return parsedLeft.minor < parsedRight.minor ? -1 : 1;
  }
  if (parsedLeft.patch !== parsedRight.patch) {
    return parsedLeft.patch < parsedRight.patch ? -1 : 1;
  }

  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}
