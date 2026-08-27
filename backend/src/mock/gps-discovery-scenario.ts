import {
  MOCK_FIXTURE_EPOCH_MS,
  createDeterministicFixtureGenerator,
  resolveMockFixtureSeed,
} from './deterministic-fixtures';

const EARTH_RADIUS_METRES = 6_371_008.8;
const METRES_PER_MILE = 1_609.344;
const DEFAULT_RADIUS_METRES = 50_000;
const STALE_LOCATION_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const NAMESPACE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export const GPS_DISCOVERY_SCENARIO_VERSION = 'mb-017-v1' as const;

export interface GpsCoordinate {
  latitude: number;
  longitude: number;
}

export interface GpsDiscoveryFixtureUser {
  id: string;
  fixture_key: string;
  display_name: string;
  native_languages: string[];
  target_languages: string[];
  avatar_url: null;
  is_vip: boolean;
  privacy_hide_from_search: boolean;
  location: GpsCoordinate;
  location_updated_at: string;
  distance_metres: number;
  distance_miles: number;
  mock_location?: { type: 'Point'; coordinates: [number, number] };
}

export interface GpsDiscoveryFixtureCase {
  id: 'same-and-boundary' | 'antimeridian' | 'polar' | 'vip-spoof';
  query: {
    latitude: number;
    longitude: number;
    radius_metres: number;
    sort: 'nearest';
  };
  users: GpsDiscoveryFixtureUser[];
}

export interface GpsDiscoveryScenario {
  scenario: typeof GPS_DISCOVERY_SCENARIO_VERSION;
  seed: number;
  scenario_id: string;
  generated_at: string;
  stale_after_ms: number;
  cases: GpsDiscoveryFixtureCase[];
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

/** Great-circle distance used only by deterministic offline fixtures. */
export function haversineDistanceMetres(
  origin: GpsCoordinate,
  target: GpsCoordinate,
): number {
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(target.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(target.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(a)));
}

function destinationPoint(
  origin: GpsCoordinate,
  distanceMetres: number,
  bearingDegrees: number,
): GpsCoordinate {
  const angularDistance = distanceMetres / EARTH_RADIUS_METRES;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: Number(toDegrees(lat2).toFixed(6)),
    longitude: Number((((toDegrees(lon2) + 540) % 360) - 180).toFixed(6)),
  };
}

function fixtureUser(
  fixtureKey: string,
  displayName: string,
  origin: GpsCoordinate,
  location: GpsCoordinate,
  options: Partial<
    Pick<
      GpsDiscoveryFixtureUser,
      'is_vip' | 'privacy_hide_from_search' | 'location_updated_at' | 'mock_location'
    >
  > = {},
): GpsDiscoveryFixtureUser {
  const distanceMetres = Math.round(haversineDistanceMetres(origin, location));
  return {
    id: `mock-gps-${fixtureKey}`,
    fixture_key: fixtureKey,
    display_name: displayName,
    native_languages: ['ja'],
    target_languages: ['en'],
    avatar_url: null,
    is_vip: options.is_vip ?? false,
    privacy_hide_from_search: options.privacy_hide_from_search ?? false,
    location,
    location_updated_at:
      options.location_updated_at ?? new Date(MOCK_FIXTURE_EPOCH_MS).toISOString(),
    distance_metres: distanceMetres,
    distance_miles: Number((distanceMetres / METRES_PER_MILE).toFixed(3)),
    ...(options.mock_location ? { mock_location: options.mock_location } : {}),
  };
}

export function buildGpsDiscoveryScenario(
  seed = resolveMockFixtureSeed(),
): GpsDiscoveryScenario {
  const generator = createDeterministicFixtureGenerator(seed);
  const london: GpsCoordinate = { latitude: 51.5074, longitude: -0.1278 };
  const antimeridian: GpsCoordinate = { latitude: 0, longitude: 179.9 };
  const northPoleEdge: GpsCoordinate = { latitude: 89.9, longitude: 0 };
  const tokyo: GpsCoordinate = { latitude: 35.6895, longitude: 139.6917 };
  const staleTimestamp = new Date(
    MOCK_FIXTURE_EPOCH_MS - STALE_LOCATION_AGE_MS,
  ).toISOString();

  const sameAndBoundary: GpsDiscoveryFixtureCase = {
    id: 'same-and-boundary',
    query: { ...london, radius_metres: DEFAULT_RADIUS_METRES, sort: 'nearest' },
    users: [
      fixtureUser('same-location', 'GPS Same Location', london, london),
      fixtureUser(
        'hidden-nearby',
        'GPS Hidden Nearby',
        london,
        destinationPoint(london, 500, 45),
        { privacy_hide_from_search: true },
      ),
      fixtureUser(
        'stale-nearby',
        'GPS Stale Nearby',
        london,
        destinationPoint(london, 1_000, 90),
        { location_updated_at: staleTimestamp },
      ),
      fixtureUser(
        'radius-inside',
        'GPS Radius Inside',
        london,
        destinationPoint(london, DEFAULT_RADIUS_METRES - 1, 0),
      ),
      fixtureUser(
        'radius-outside',
        'GPS Radius Outside',
        london,
        destinationPoint(london, DEFAULT_RADIUS_METRES + 1, 180),
      ),
    ],
  };

  const antimeridianCase: GpsDiscoveryFixtureCase = {
    id: 'antimeridian',
    query: { ...antimeridian, radius_metres: 25_000, sort: 'nearest' },
    users: [
      fixtureUser(
        'antimeridian-crossing',
        'GPS Antimeridian',
        antimeridian,
        { latitude: 0, longitude: -179.9 },
      ),
    ],
  };

  const polarCase: GpsDiscoveryFixtureCase = {
    id: 'polar',
    query: { ...northPoleEdge, radius_metres: 20_000, sort: 'nearest' },
    users: [
      fixtureUser('polar-crossing', 'GPS Polar', northPoleEdge, {
        latitude: 89.9,
        longitude: 90,
      }),
    ],
  };

  const vipSpoofCase: GpsDiscoveryFixtureCase = {
    id: 'vip-spoof',
    query: { ...tokyo, radius_metres: 10_000, sort: 'nearest' },
    users: [
      fixtureUser('vip-spoofed', 'GPS VIP Spoofed', tokyo, tokyo, {
        is_vip: true,
        mock_location: { type: 'Point', coordinates: [139.6917, 35.6895] },
      }),
    ],
  };

  return {
    scenario: GPS_DISCOVERY_SCENARIO_VERSION,
    seed,
    scenario_id: generator.uuid(),
    generated_at: new Date(MOCK_FIXTURE_EPOCH_MS).toISOString(),
    stale_after_ms: 30 * 24 * 60 * 60 * 1000,
    cases: [sameAndBoundary, antimeridianCase, polarCase, vipSpoofCase],
  };
}

function cloneScenario(scenario: GpsDiscoveryScenario): GpsDiscoveryScenario {
  return JSON.parse(JSON.stringify(scenario)) as GpsDiscoveryScenario;
}

export class GpsDiscoveryScenarioStore {
  private readonly states = new Map<string, GpsDiscoveryScenario>();

  constructor(private readonly seed = resolveMockFixtureSeed()) {}

  get(namespace = 'default'): GpsDiscoveryScenario {
    const key = this.normalizeNamespace(namespace);
    const state = this.states.get(key) ?? buildGpsDiscoveryScenario(this.seed);
    if (!this.states.has(key)) this.states.set(key, state);
    return cloneScenario(state);
  }

  setLocationVisibility(
    userId: string,
    hidden: boolean,
    namespace = 'default',
  ): GpsDiscoveryScenario {
    const key = this.normalizeNamespace(namespace);
    const state = this.states.get(key) ?? buildGpsDiscoveryScenario(this.seed);
    const user = state.cases.flatMap((fixtureCase) => fixtureCase.users).find(
      (candidate) => candidate.id === userId,
    );
    if (!user) throw new Error(`Unknown mock GPS user: ${userId}`);
    user.privacy_hide_from_search = hidden;
    this.states.set(key, state);
    return cloneScenario(state);
  }

  reset(namespace = 'default'): GpsDiscoveryScenario {
    const key = this.normalizeNamespace(namespace);
    this.states.delete(key);
    return this.get(key);
  }

  private normalizeNamespace(namespace: string): string {
    const normalized = namespace.trim() || 'default';
    if (!NAMESPACE_PATTERN.test(normalized)) {
      throw new Error(
        'Mock GPS namespace must be 1-64 letters, digits, dots, underscores or hyphens',
      );
    }
    return normalized;
  }
}
