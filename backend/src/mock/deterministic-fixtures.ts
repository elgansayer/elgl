export const MOCK_FIXTURE_GENERATOR_VERSION = 'mulberry32-v1' as const;
export const MOCK_FIXTURE_SEED_NAME = 'elgl-offline-fixtures' as const;
export const DEFAULT_MOCK_FIXTURE_SEED = 7932;
export const MOCK_FIXTURE_EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0);

const UINT32_MAX = 0xffff_ffff;

export interface MockFixtureSeedEnvironment {
  MOCK_BACKEND_SEED?: unknown;
}

export interface MockFixtureDiagnostics {
  seedName: typeof MOCK_FIXTURE_SEED_NAME;
  seed: number;
  seedId: string;
  generatorVersion: typeof MOCK_FIXTURE_GENERATOR_VERSION;
  epoch: string;
}

/**
 * Resolve the deterministic fixture seed. The seed is intentionally numeric,
 * bounded and safe to include in local/test diagnostics.
 */
export function resolveMockFixtureSeed(
  environment: MockFixtureSeedEnvironment = process.env,
): number {
  const rawSeed = environment.MOCK_BACKEND_SEED;
  if (rawSeed === undefined || rawSeed === null || rawSeed === '') {
    return DEFAULT_MOCK_FIXTURE_SEED;
  }

  const normalized = typeof rawSeed === 'number' ? String(rawSeed) : rawSeed;
  if (typeof normalized !== 'string' || !/^\d{1,10}$/.test(normalized.trim())) {
    throw new Error('MOCK_BACKEND_SEED must be an unsigned 32-bit integer');
  }

  const seed = Number(normalized.trim());
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new Error('MOCK_BACKEND_SEED must be an unsigned 32-bit integer');
  }

  return seed;
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Versioned deterministic primitives for mock/offline fixture factories.
 * A generator instance owns its sequence, so callers can create isolated
 * instances per scenario or test worker without sharing mutable PRNG state.
 */
export class DeterministicFixtureGenerator {
  readonly seed: number;
  private readonly nextValue: () => number;

  constructor(seed: number = DEFAULT_MOCK_FIXTURE_SEED) {
    if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
      throw new Error('Fixture seed must be an unsigned 32-bit integer');
    }
    this.seed = seed;
    this.nextValue = createMulberry32(seed);
  }

  random(): number {
    return this.nextValue();
  }

  integer(minInclusive: number, maxInclusive: number): number {
    if (
      !Number.isSafeInteger(minInclusive) ||
      !Number.isSafeInteger(maxInclusive) ||
      maxInclusive < minInclusive
    ) {
      throw new Error('Fixture integer bounds must be safe and ordered');
    }

    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.random() * span);
  }

  boolean(probability = 0.5): boolean {
    if (probability < 0 || probability > 1 || !Number.isFinite(probability)) {
      throw new Error('Fixture probability must be between 0 and 1');
    }
    return this.random() < probability;
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error('Fixture choices must not be empty');
    }
    return values[this.integer(0, values.length - 1)];
  }

  counter(maxInclusive = 1_000_000): number {
    return this.integer(0, maxInclusive);
  }

  uuid(): string {
    const bytes = Array.from({ length: 16 }, () => this.integer(0, 255));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  }

  timestamp(offsetMs = 0): string {
    if (!Number.isSafeInteger(offsetMs)) {
      throw new Error('Fixture timestamp offset must be a safe integer');
    }
    const deterministicJitterMs = this.integer(0, 59_999);
    return new Date(
      MOCK_FIXTURE_EPOCH_MS + offsetMs + deterministicJitterMs,
    ).toISOString();
  }

  coordinates(): { latitude: number; longitude: number } {
    return {
      latitude: Number((this.random() * 180 - 90).toFixed(6)),
      longitude: Number((this.random() * 360 - 180).toFixed(6)),
    };
  }
}

export function createDeterministicFixtureGenerator(
  seed = resolveMockFixtureSeed(),
): DeterministicFixtureGenerator {
  return new DeterministicFixtureGenerator(seed);
}

export function getMockFixtureDiagnostics(
  seed = resolveMockFixtureSeed(),
): MockFixtureDiagnostics {
  return {
    seedName: MOCK_FIXTURE_SEED_NAME,
    seed,
    seedId: `${MOCK_FIXTURE_SEED_NAME}@${MOCK_FIXTURE_GENERATOR_VERSION}:${seed}`,
    generatorVersion: MOCK_FIXTURE_GENERATOR_VERSION,
    epoch: new Date(MOCK_FIXTURE_EPOCH_MS).toISOString(),
  };
}
