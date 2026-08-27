import {
  buildGlobalMockUserPopulation,
  MOCK_USER_POPULATION_COUNTS,
  MockUserPopulationSize,
} from './global-user-population';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('global mock user population', () => {
  it('replays the exact same population for the same namespace and seed', () => {
    const first = buildGlobalMockUserPopulation('medium', 'worker-a');
    const replay = buildGlobalMockUserPopulation('medium', 'worker-a');

    expect(replay).toEqual(first);
    expect(first.seedId).toContain('worker-a');
  });

  it.each(
    Object.entries(MOCK_USER_POPULATION_COUNTS) as [
      MockUserPopulationSize,
      number,
    ][],
  )('builds the documented %s population size', (size, expectedCount) => {
    const population = buildGlobalMockUserPopulation(size, `size-${size}`);

    expect(population.size).toBe(size);
    expect(population.count).toBe(expectedCount);
    expect(population.profiles).toHaveLength(expectedCount);
  });

  it('covers languages, scripts, profile levels, and display-name edge cases', () => {
    const population = buildGlobalMockUserPopulation('minimal', 'coverage');
    const nativeLanguages = new Set(
      population.profiles.flatMap((profile) => profile.native_languages),
    );
    const levels = new Set(
      population.profiles.map((profile) => profile.proficiency_level),
    );

    expect(nativeLanguages).toEqual(
      new Set([
        'ja',
        'en',
        'ar',
        'he',
        'ko',
        'hi',
        'es',
        'pt',
        'tr',
        'vi',
        'fr',
        'pl',
      ]),
    );
    expect(levels.size).toBeGreaterThanOrEqual(4);
    expect(
      population.profiles.some((profile) => profile.display_name === undefined),
    ).toBe(true);
    expect(
      population.profiles.some(
        (profile) => (profile.display_name?.length ?? 0) >= 80,
      ),
    ).toBe(true);
    expect(
      population.profiles.some((profile) =>
        /[\u0590-\u08ff]/u.test(profile.display_name ?? ''),
      ),
    ).toBe(true);
    expect(
      population.profiles.every(
        (profile) =>
          profile.native_languages.length === 1 &&
          profile.target_languages.length === 1 &&
          profile.native_languages[0] !== profile.target_languages[0],
      ),
    ).toBe(true);
  });

  it('produces unique deterministic identifiers without remote media dependencies', () => {
    const population = buildGlobalMockUserPopulation('large', 'offline');
    const ids = population.profiles.map((profile) => profile.id);

    expect(new Set(ids).size).toBe(population.count);
    expect(ids.every((id) => UUID_V4_PATTERN.test(id))).toBe(true);
    expect(
      population.profiles.every(
        (profile) =>
          profile.avatar_url === undefined &&
          profile.audio_intro_url === undefined &&
          profile.cover_photo_url === undefined,
      ),
    ).toBe(true);
  });

  it('isolates parallel namespaces without sharing mutable generator state', () => {
    const workerA = buildGlobalMockUserPopulation('minimal', 'worker-a');
    const workerB = buildGlobalMockUserPopulation('minimal', 'worker-b');
    const workerAReplay = buildGlobalMockUserPopulation('minimal', 'worker-a');

    expect(workerA.seed).not.toBe(workerB.seed);
    expect(workerA.profiles[0]?.id).not.toBe(workerB.profiles[0]?.id);
    expect(workerAReplay).toEqual(workerA);
  });
});
