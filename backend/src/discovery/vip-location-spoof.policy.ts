import type { UserProfile } from '../users/interfaces/user-profile.interface';

export interface GeographyPoint {
  latitude: number;
  longitude: number;
}

/**
 * Outcome of evaluating a viewer's stored VIP `mock_location`.
 *
 * - `inactive`: the viewer is not a VIP or has no stored value; the request
 *   coordinates stay authoritative.
 * - `applied`: the VIP's stored point replaces the request coordinates.
 * - `invalid`: a VIP has a stored value that cannot be used as a WGS84 point;
 *   the request coordinates stay authoritative.
 */
export type VipMockLocationResolution =
  | { status: 'inactive' }
  | { status: 'applied'; point: GeographyPoint }
  | { status: 'invalid' };

const WGS84_SRID = 4326;

// Little/big endian EWKB layout of a 2D point:
//   byte order (1) | type (4) | [SRID (4)] | longitude (8) | latitude (8)
const EWKB_POINT_TYPE = 1;
const EWKB_SRID_FLAG = 0x20000000;
const EWKB_HEADER_BYTES = 5;
const EWKB_SRID_BYTES = 4;
const EWKB_ORDINATE_BYTES = 8;

// The longest accepted representation is the 50 character EWKB hex of a 2D
// point with an SRID. The cap keeps oversized untrusted text away from the
// parsers below.
const MAX_POINT_TEXT_LENGTH = 128;

const HEX_PATTERN = /^[0-9a-f]+$/i;
const WKT_POINT_PATTERN =
  /^(?:SRID=(\d{1,9});)?POINT\s*\(\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*\)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toGeographyPoint(
  longitude: unknown,
  latitude: unknown,
): GeographyPoint | null {
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return null;
  }
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

function fromGeoJson(value: Record<string, unknown>): GeographyPoint | null {
  const type: unknown = value.type;
  const coordinates: unknown = value.coordinates;
  if (
    type !== 'Point' ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return null;
  }
  const longitude: unknown = coordinates[0];
  const latitude: unknown = coordinates[1];
  return toGeographyPoint(longitude, latitude);
}

function fromWkt(text: string): GeographyPoint | null {
  const match = WKT_POINT_PATTERN.exec(text);
  if (!match) return null;
  const [, srid, longitude, latitude] = match;
  if (srid !== undefined && Number(srid) !== WGS84_SRID) return null;
  return toGeographyPoint(Number(longitude), Number(latitude));
}

function fromEwkbHex(hex: string): GeographyPoint | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length < EWKB_HEADER_BYTES) return null;

  const byteOrder = bytes[0];
  if (byteOrder !== 0 && byteOrder !== 1) return null;
  const littleEndian = byteOrder === 1;
  const readUInt32 = (offset: number): number =>
    littleEndian ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
  const readDouble = (offset: number): number =>
    littleEndian ? bytes.readDoubleLE(offset) : bytes.readDoubleBE(offset);

  // Only a plain 2D point, optionally carrying an SRID, is a valid value for a
  // geography(Point, 4326) column. Z/M flags and other geometry types are
  // rejected rather than guessed at.
  const type = readUInt32(1);
  const hasSrid = type === (EWKB_POINT_TYPE | EWKB_SRID_FLAG);
  if (type !== EWKB_POINT_TYPE && !hasSrid) return null;

  const expectedLength =
    EWKB_HEADER_BYTES +
    (hasSrid ? EWKB_SRID_BYTES : 0) +
    2 * EWKB_ORDINATE_BYTES;
  if (bytes.length !== expectedLength) return null;

  let offset = EWKB_HEADER_BYTES;
  if (hasSrid) {
    if (readUInt32(offset) !== WGS84_SRID) return null;
    offset += EWKB_SRID_BYTES;
  }
  return toGeographyPoint(
    readDouble(offset),
    readDouble(offset + EWKB_ORDINATE_BYTES),
  );
}

/**
 * Decode a PostGIS point into validated WGS84 coordinates.
 *
 * `users.mock_location` is a `geography(Point, 4326)` column, and the
 * representation handed back to the backend depends on the column type and how
 * the row was read, so the decoder does not assume one. These forms are
 * accepted:
 *
 * - GeoJSON `{ type: 'Point', coordinates: [longitude, latitude] }`
 * - WKT / EWKT text such as `POINT(139.6917 35.6895)` or
 *   `SRID=4326;POINT(139.6917 35.6895)`
 * - hex encoded EWKB such as `0101000020E6100000...`
 *
 * Anything else, any non-finite or out-of-range ordinate, and any SRID other
 * than 4326 yields `null`. Callers must treat `null` as "no usable point" and
 * never invent coordinates.
 */
export function parseGeographyPoint(value: unknown): GeographyPoint | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.length === 0 || text.length > MAX_POINT_TEXT_LENGTH) return null;
    return HEX_PATTERN.test(text) ? fromEwkbHex(text) : fromWkt(text);
  }
  if (isRecord(value)) return fromGeoJson(value);
  return null;
}

/**
 * Decide whether a viewer's stored `mock_location` replaces their request
 * coordinates during discovery.
 *
 * The profile must be the server-loaded one: VIP entitlement and the stored
 * point are never read from the request, so a client cannot opt itself in.
 * Non-VIP viewers always resolve to `inactive`, whatever is stored.
 */
export function resolveVipMockLocation(
  profile: Pick<UserProfile, 'is_vip' | 'mock_location'> | null | undefined,
): VipMockLocationResolution {
  if (!profile?.is_vip) return { status: 'inactive' };

  const stored = profile.mock_location;
  if (stored === null || stored === undefined || stored === '') {
    return { status: 'inactive' };
  }

  const point = parseGeographyPoint(stored);
  return point ? { status: 'applied', point } : { status: 'invalid' };
}
