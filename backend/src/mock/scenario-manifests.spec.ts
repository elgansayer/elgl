import {
  MOCK_SCENARIO_PACK_NAMES,
  compileMockScenarioSelection,
  listMockScenarioManifests,
  resolveMockScenarioSelection,
} from './scenario-manifests';

describe('mock scenario manifests', () => {
  it('defaults to the baseline pack', () => {
    expect(resolveMockScenarioSelection(undefined)).toEqual({
      requestedPacks: ['baseline'],
      packs: ['baseline'],
      traits: {
        population: 'baseline',
        degraded: false,
        moderationHeavy: false,
      },
    });
  });

  it('expands dependencies and preserves deterministic ordering', () => {
    expect(
      compileMockScenarioSelection([
        'moderation-heavy',
        'dense',
        'degraded',
        'dense',
      ]),
    ).toEqual({
      requestedPacks: ['moderation-heavy', 'dense', 'degraded'],
      packs: ['baseline', 'dense', 'degraded', 'moderation-heavy'],
      traits: {
        population: 'dense',
        degraded: true,
        moderationHeavy: true,
      },
    });
  });

  it('rejects incompatible packs with an actionable error', () => {
    expect(() => compileMockScenarioSelection(['empty', 'dense'])).toThrow(
      'cannot be combined',
    );
    expect(() => compileMockScenarioSelection(['empty', 'degraded'])).toThrow(
      'cannot be combined',
    );
  });

  it('rejects unknown packs and lists the supported names', () => {
    expect(() => compileMockScenarioSelection(['unknown'])).toThrow(
      `Available packs: ${MOCK_SCENARIO_PACK_NAMES.join(', ')}`,
    );
  });

  it('parses comma-separated CLI/environment selection', () => {
    expect(resolveMockScenarioSelection(' dense, degraded ')).toMatchObject({
      requestedPacks: ['dense', 'degraded'],
      packs: ['baseline', 'dense', 'degraded'],
    });
  });

  it('returns defensive manifest copies', () => {
    const first = listMockScenarioManifests();
    const second = listMockScenarioManifests();

    expect(first).toHaveLength(5);
    expect(first).not.toBe(second);
    expect(first[0]?.dependencies).not.toBe(second[0]?.dependencies);
  });
});
