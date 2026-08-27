import {
  DEFAULT_MOCK_FIXTURE_SEED,
  DeterministicFixtureGenerator,
  MOCK_FIXTURE_GENERATOR_VERSION,
  MOCK_FIXTURE_SEED_NAME,
  createDeterministicFixtureGenerator,
  getMockFixtureDiagnostics,
  resolveMockFixtureSeed,
} from './deterministic-fixtures';

function sampleFixturePrimitives(seed: number): string {
  const generator = createDeterministicFixtureGenerator(seed);
  return JSON.stringify({
    random: generator.random(),
    uuid: generator.uuid(),
    timestamp: generator.timestamp(120_000),
    coordinates: generator.coordinates(),
    counter: generator.counter(10_000),
  });
}

describe('deterministic mock fixture generator', () => {
  it('uses a named and versioned default seed contract', () => {
    expect(resolveMockFixtureSeed({})).toBe(DEFAULT_MOCK_FIXTURE_SEED);
    expect(getMockFixtureDiagnostics()).toMatchObject({
      seedName: MOCK_FIXTURE_SEED_NAME,
      seed: DEFAULT_MOCK_FIXTURE_SEED,
      generatorVersion: MOCK_FIXTURE_GENERATOR_VERSION,
      epoch: '2024-01-01T00:00:00.000Z',
    });
    expect(getMockFixtureDiagnostics().seedId).toContain(
      `${MOCK_FIXTURE_GENERATOR_VERSION}:${DEFAULT_MOCK_FIXTURE_SEED}`,
    );
  });

  it('replays UUID, timestamp, coordinate and counter values byte-for-byte', () => {
    expect(sampleFixturePrimitives(42)).toBe(sampleFixturePrimitives(42));

    const parsed = JSON.parse(sampleFixturePrimitives(42)) as {
      uuid: string;
      coordinates: { latitude: number; longitude: number };
      counter: number;
    };
    expect(parsed.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(parsed.coordinates.latitude).toBeGreaterThanOrEqual(-90);
    expect(parsed.coordinates.latitude).toBeLessThanOrEqual(90);
    expect(parsed.coordinates.longitude).toBeGreaterThanOrEqual(-180);
    expect(parsed.coordinates.longitude).toBeLessThanOrEqual(180);
    expect(parsed.counter).toBeGreaterThanOrEqual(0);
    expect(parsed.counter).toBeLessThanOrEqual(10_000);
  });

  it('produces distinct valid fixture streams for different seeds', () => {
    expect(sampleFixturePrimitives(42)).not.toBe(sampleFixturePrimitives(43));
  });

  it('accepts explicit test seeds and rejects malformed values', () => {
    expect(resolveMockFixtureSeed({ MOCK_BACKEND_SEED: '12345' })).toBe(12345);
    expect(resolveMockFixtureSeed({ MOCK_BACKEND_SEED: 99 })).toBe(99);
    expect(() =>
      resolveMockFixtureSeed({ MOCK_BACKEND_SEED: '12;console.log(1)' }),
    ).toThrow('unsigned 32-bit integer');
    expect(() =>
      resolveMockFixtureSeed({ MOCK_BACKEND_SEED: '4294967296' }),
    ).toThrow('unsigned 32-bit integer');
  });

  it('keeps generator instances isolated for parallel test workers', () => {
    const first = new DeterministicFixtureGenerator(7);
    const second = new DeterministicFixtureGenerator(7);

    expect(first.random()).toBe(second.random());
    first.random();
    expect(first.random()).not.toBe(second.random());
  });
});
