import { describe, expect, it } from 'vitest';
import {
  parseGeographyPoint,
  resolveVipMockLocation,
} from './vip-location-spoof.policy';

// Fixed EWKB vectors, generated independently of the parser, so the decoder is
// checked against known bytes rather than only against a mirrored encoder.
const TOKYO_EWKB_LE_SRID = '0101000020E610000095D4096822766140C74B378941D84140';
const NEW_YORK_EWKB_BE_SRID =
  '0020000001000010E6C0527F15B573EAB340445FCB923A29C7';
const LONDON_EWKB_LE_NO_SRID = '0101000000EBE2361AC05BC0BFC5FEB27BF2C04940';

const TOKYO = { latitude: 35.6895, longitude: 139.6917 };
const NEW_YORK = { latitude: 40.7484, longitude: -73.9857 };
const LONDON = { latitude: 51.5074, longitude: -0.1278 };

const encodeEwkbPoint = (options: {
  longitude: number;
  latitude: number;
  srid?: number;
  littleEndian: boolean;
}): string => {
  const { longitude, latitude, srid, littleEndian } = options;
  const hasSrid = srid !== undefined;
  const bytes = Buffer.alloc(1 + 4 + (hasSrid ? 4 : 0) + 16);
  let offset = 0;
  bytes.writeUInt8(littleEndian ? 1 : 0, offset);
  offset += 1;
  const type = (hasSrid ? 0x20000000 : 0) | 1;
  if (littleEndian) bytes.writeUInt32LE(type, offset);
  else bytes.writeUInt32BE(type, offset);
  offset += 4;
  if (hasSrid) {
    if (littleEndian) bytes.writeUInt32LE(srid, offset);
    else bytes.writeUInt32BE(srid, offset);
    offset += 4;
  }
  if (littleEndian) {
    bytes.writeDoubleLE(longitude, offset);
    bytes.writeDoubleLE(latitude, offset + 8);
  } else {
    bytes.writeDoubleBE(longitude, offset);
    bytes.writeDoubleBE(latitude, offset + 8);
  }
  return bytes.toString('hex').toUpperCase();
};

describe('parseGeographyPoint', () => {
  describe('GeoJSON Point', () => {
    it('reads coordinates in GeoJSON [longitude, latitude] order', () => {
      expect(
        parseGeographyPoint({
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        }),
      ).toEqual(TOKYO);
    });

    it.each([
      [-180, -90],
      [180, 90],
      [0, 0],
      [-180, 90],
      [180, -90],
    ])('accepts the inclusive boundary [%d, %d]', (longitude, latitude) => {
      expect(
        parseGeographyPoint({
          type: 'Point',
          coordinates: [longitude, latitude],
        }),
      ).toEqual({ latitude, longitude });
    });

    it.each([
      ['a non-Point geometry', { type: 'LineString', coordinates: [1, 2] }],
      ['a missing type', { coordinates: [1, 2] }],
      ['missing coordinates', { type: 'Point' }],
      [
        'coordinates that are not an array',
        { type: 'Point', coordinates: '1' },
      ],
      ['a single ordinate', { type: 'Point', coordinates: [1] }],
      ['an altitude ordinate', { type: 'Point', coordinates: [1, 2, 3] }],
      ['nested coordinates', { type: 'Point', coordinates: [[1, 2]] }],
      [
        'numeric strings',
        { type: 'Point', coordinates: ['139.6917', '35.6895'] },
      ],
      ['null ordinates', { type: 'Point', coordinates: [null, null] }],
      ['NaN ordinates', { type: 'Point', coordinates: [Number.NaN, 0] }],
      [
        'infinite ordinates',
        { type: 'Point', coordinates: [0, Number.POSITIVE_INFINITY] },
      ],
      ['latitude above 90', { type: 'Point', coordinates: [0, 90.0001] }],
      ['latitude below -90', { type: 'Point', coordinates: [0, -90.0001] }],
      ['longitude above 180', { type: 'Point', coordinates: [180.0001, 0] }],
      ['longitude below -180', { type: 'Point', coordinates: [-180.0001, 0] }],
      [
        'swapped latitude and longitude',
        { type: 'Point', coordinates: [35.6895, 139.6917] },
      ],
    ])('rejects %s', (_label, value) => {
      expect(parseGeographyPoint(value)).toBeNull();
    });
  });

  describe('WKT and EWKT text', () => {
    it.each([
      ['POINT(139.6917 35.6895)', TOKYO],
      ['point( 139.6917   35.6895 )', TOKYO],
      ['POINT (139.6917 35.6895)', TOKYO],
      ['  POINT(139.6917 35.6895)  ', TOKYO],
      ['SRID=4326;POINT(-73.9857 40.7484)', NEW_YORK],
      ['srid=4326;point(-0.1278 51.5074)', LONDON],
      ['POINT(1e2 -4.5E1)', { latitude: -45, longitude: 100 }],
      ['POINT(+10 +20)', { latitude: 20, longitude: 10 }],
    ])('decodes %j', (text, expected) => {
      expect(parseGeographyPoint(text)).toEqual(expected);
    });

    it.each([
      ['an SRID other than 4326', 'SRID=3857;POINT(1 2)'],
      ['a Z point', 'POINT Z (1 2 3)'],
      ['three ordinates', 'POINT(1 2 3)'],
      ['an empty point', 'POINT EMPTY'],
      ['a single ordinate', 'POINT(1)'],
      ['a different geometry type', 'LINESTRING(1 2, 3 4)'],
      ['a multipoint', 'MULTIPOINT((1 2))'],
      ['trailing content', 'POINT(1 2) extra'],
      ['an injected statement', 'POINT(1 2); DROP TABLE users'],
      ['a comma separated pair', 'POINT(1,2)'],
      ['free text', 'Tokyo'],
      ['an out-of-range latitude', 'POINT(0 91)'],
      ['an out-of-range longitude', 'POINT(181 0)'],
      ['an overflowing ordinate', 'POINT(1e999 0)'],
      ['an empty string', ''],
      ['whitespace only', '   '],
    ])('rejects %s', (_label, text) => {
      expect(parseGeographyPoint(text)).toBeNull();
    });
  });

  describe('hex encoded EWKB', () => {
    it('decodes a little endian point with SRID 4326', () => {
      expect(parseGeographyPoint(TOKYO_EWKB_LE_SRID)).toEqual(TOKYO);
    });

    it('decodes a big endian point with SRID 4326', () => {
      expect(parseGeographyPoint(NEW_YORK_EWKB_BE_SRID)).toEqual(NEW_YORK);
    });

    it('decodes a point without an SRID', () => {
      expect(parseGeographyPoint(LONDON_EWKB_LE_NO_SRID)).toEqual(LONDON);
    });

    it('accepts lower case hex and surrounding whitespace', () => {
      expect(
        parseGeographyPoint(`  ${TOKYO_EWKB_LE_SRID.toLowerCase()}\n`),
      ).toEqual(TOKYO);
    });

    it.each([
      [-180, -90],
      [180, 90],
      [0, 0],
      [-122.4194, 37.7749],
      [151.2093, -33.8688],
    ])('round-trips [%d, %d] in both byte orders', (longitude, latitude) => {
      for (const littleEndian of [true, false]) {
        expect(
          parseGeographyPoint(
            encodeEwkbPoint({ longitude, latitude, srid: 4326, littleEndian }),
          ),
        ).toEqual({ latitude, longitude });
        expect(
          parseGeographyPoint(
            encodeEwkbPoint({ longitude, latitude, littleEndian }),
          ),
        ).toEqual({ latitude, longitude });
      }
    });

    it.each([
      [
        'an SRID other than 4326',
        '0101000020110F000095D4096822766140C74B378941D84140',
      ],
      [
        'a LineString type code',
        '0102000020E610000095D4096822766140C74B378941D84140',
      ],
      [
        'a Z flagged point',
        '01010000A0E610000095D4096822766140C74B378941D84140',
      ],
      [
        'an M flagged point',
        '0101000060E610000095D4096822766140C74B378941D84140',
      ],
      [
        'a Z and M flagged point',
        '01010000E0E610000095D4096822766140C74B378941D84140',
      ],
      [
        'an invalid byte order marker',
        '0201000020E610000095D4096822766140C74B378941D84140',
      ],
      ['a truncated ordinate', TOKYO_EWKB_LE_SRID.slice(0, -2)],
      ['a trailing byte', `${TOKYO_EWKB_LE_SRID}00`],
      ['an odd number of hex digits', TOKYO_EWKB_LE_SRID.slice(0, -1)],
      ['a non-hex digit', `${TOKYO_EWKB_LE_SRID.slice(0, -1)}G`],
      ['only a header', '0101000020'],
      [
        'an empty point (NaN ordinates)',
        '0101000020E6100000000000000000F87F000000000000F87F',
      ],
      [
        'an out-of-range latitude',
        '0101000020E610000000000000000024400000000000C05640',
      ],
      ['oversized input', 'A'.repeat(100_000)],
    ])('rejects %s', (_label, text) => {
      expect(parseGeographyPoint(text)).toBeNull();
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 35.6895],
    ['a boolean', true],
    ['an array pair', [139.6917, 35.6895]],
    ['an empty object', {}],
    ['a latitude/longitude object', { latitude: 35.6895, longitude: 139.6917 }],
    ['a function', () => 'POINT(1 2)'],
  ])('rejects %s', (_label, value) => {
    expect(parseGeographyPoint(value)).toBeNull();
  });
});

describe('resolveVipMockLocation', () => {
  const tokyoGeoJson = { type: 'Point', coordinates: [139.6917, 35.6895] };

  it.each([
    ['GeoJSON', tokyoGeoJson],
    ['WKT', 'POINT(139.6917 35.6895)'],
    ['EWKT', 'SRID=4326;POINT(139.6917 35.6895)'],
    ['EWKB hex', TOKYO_EWKB_LE_SRID],
  ])('applies a VIP mock_location stored as %s', (_label, mock_location) => {
    expect(resolveVipMockLocation({ is_vip: true, mock_location })).toEqual({
      status: 'applied',
      point: TOKYO,
    });
  });

  it('never applies a stored mock_location for a non-VIP profile', () => {
    expect(
      resolveVipMockLocation({ is_vip: false, mock_location: tokyoGeoJson }),
    ).toEqual({ status: 'inactive' });
    expect(
      resolveVipMockLocation({
        is_vip: false,
        mock_location: 'not a point at all',
      }),
    ).toEqual({ status: 'inactive' });
  });

  it.each([
    ['a missing profile', null],
    ['an undefined profile', undefined],
  ])('is inactive for %s', (_label, profile) => {
    expect(resolveVipMockLocation(profile)).toEqual({ status: 'inactive' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('is inactive for a VIP whose mock_location is %s', (_label, value) => {
    expect(
      resolveVipMockLocation({ is_vip: true, mock_location: value }),
    ).toEqual({ status: 'inactive' });
  });

  it.each([
    ['free text', 'Tokyo'],
    ['an unsupported geometry', { type: 'LineString', coordinates: [1, 2] }],
    ['an out-of-range point', { type: 'Point', coordinates: [0, 120] }],
    ['a number', 42],
  ])('flags a VIP mock_location holding %s as invalid', (_label, value) => {
    expect(
      resolveVipMockLocation({ is_vip: true, mock_location: value }),
    ).toEqual({ status: 'invalid' });
  });
});
