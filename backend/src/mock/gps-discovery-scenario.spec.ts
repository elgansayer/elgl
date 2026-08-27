import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SearchQueryDto } from '../discovery/dto/search-query.dto';
import {
  GpsDiscoveryScenarioStore,
  buildGpsDiscoveryScenario,
} from './gps-discovery-scenario';

describe('GPS discovery mock scenario', () => {
  it('is byte-stable for the documented seed and isolated between seeds', () => {
    expect(JSON.stringify(buildGpsDiscoveryScenario(7932))).toBe(
      JSON.stringify(buildGpsDiscoveryScenario(7932)),
    );
    expect(buildGpsDiscoveryScenario(7933).scenario_id).not.toBe(
      buildGpsDiscoveryScenario(7932).scenario_id,
    );
  });

  it('covers same-location and both sides of the 50 km radius boundary', () => {
    const fixtureCase = buildGpsDiscoveryScenario(7932).cases.find(
      (candidate) => candidate.id === 'same-and-boundary',
    );
    expect(fixtureCase).toBeDefined();

    const byKey = new Map(
      fixtureCase!.users.map((user) => [user.fixture_key, user]),
    );
    expect(byKey.get('same-location')?.distance_metres).toBe(0);
    expect(byKey.get('radius-inside')?.distance_metres).toBe(49_999);
    expect(byKey.get('radius-outside')?.distance_metres).toBe(50_001);
  });

  it('covers antimeridian, polar, hidden, stale and VIP-spoofed locations', () => {
    const scenario = buildGpsDiscoveryScenario(7932);
    const users = scenario.cases.flatMap((fixtureCase) => fixtureCase.users);
    const byKey = new Map(users.map((user) => [user.fixture_key, user]));

    expect(byKey.get('antimeridian-crossing')?.distance_metres).toBeLessThan(
      25_000,
    );
    expect(byKey.get('polar-crossing')?.distance_metres).toBeLessThan(20_000);
    expect(byKey.get('hidden-nearby')?.privacy_hide_from_search).toBe(true);
    expect(Date.parse(byKey.get('stale-nearby')!.location_updated_at)).toBeLessThan(
      Date.parse(scenario.generated_at) - scenario.stale_after_ms,
    );
    expect(byKey.get('vip-spoofed')).toMatchObject({
      is_vip: true,
      mock_location: {
        type: 'Point',
        coordinates: [139.6917, 35.6895],
      },
    });
  });

  it('provides consistent metric and imperial distance values', () => {
    const users = buildGpsDiscoveryScenario(7932).cases.flatMap(
      (fixtureCase) => fixtureCase.users,
    );

    for (const user of users) {
      expect(user.distance_miles).toBeCloseTo(
        user.distance_metres / 1_609.344,
        3,
      );
    }
  });

  it('uses the authoritative SearchQueryDto contract for every search case', async () => {
    const scenario = buildGpsDiscoveryScenario(7932);

    for (const fixtureCase of scenario.cases) {
      const dto = plainToInstance(SearchQueryDto, fixtureCase.query);
      const errors = await validate(dto);
      expect(errors, fixtureCase.id).toEqual([]);
    }
  });

  it('supports worker-local state changes and exact reset/replay', () => {
    const store = new GpsDiscoveryScenarioStore(7932);
    const initial = store.get('worker-a');
    const targetId = initial.cases[0].users.find(
      (user) => user.fixture_key === 'same-location',
    )!.id;

    const changed = store.setLocationVisibility(targetId, true, 'worker-a');
    expect(
      changed.cases.flatMap((fixtureCase) => fixtureCase.users).find(
        (user) => user.id === targetId,
      )?.privacy_hide_from_search,
    ).toBe(true);
    expect(
      store
        .get('worker-b')
        .cases.flatMap((fixtureCase) => fixtureCase.users)
        .find((user) => user.id === targetId)?.privacy_hide_from_search,
    ).toBe(false);

    expect(store.reset('worker-a')).toEqual(initial);
  });

  it('contains no remote media or third-party URLs', () => {
    const payload = JSON.stringify(buildGpsDiscoveryScenario(7932));
    expect(payload).not.toMatch(/https?:\/\//);
    expect(
      buildGpsDiscoveryScenario(7932).cases
        .flatMap((fixtureCase) => fixtureCase.users)
        .every((user) => user.avatar_url === null),
    ).toBe(true);
  });
});
