export const MOCK_SCENARIO_PACK_NAMES = [
  'baseline',
  'empty',
  'dense',
  'degraded',
  'moderation-heavy',
] as const;

export type MockScenarioPackName = (typeof MOCK_SCENARIO_PACK_NAMES)[number];

export interface MockScenarioManifest {
  name: MockScenarioPackName;
  description: string;
  dependencies: readonly MockScenarioPackName[];
  conflicts: readonly MockScenarioPackName[];
  order: number;
}

export interface CompiledMockScenarioSelection {
  requestedPacks: MockScenarioPackName[];
  packs: MockScenarioPackName[];
  traits: {
    population: 'empty' | 'baseline' | 'dense';
    degraded: boolean;
    moderationHeavy: boolean;
  };
}

const MANIFESTS: Record<MockScenarioPackName, MockScenarioManifest> = {
  baseline: {
    name: 'baseline',
    description: 'Standard deterministic users and linked-account fixtures',
    dependencies: [],
    conflicts: ['empty'],
    order: 10,
  },
  empty: {
    name: 'empty',
    description: 'No user or linked-account fixture records',
    dependencies: [],
    conflicts: ['baseline', 'dense', 'moderation-heavy'],
    order: 20,
  },
  dense: {
    name: 'dense',
    description: 'Higher-volume deterministic fixture population',
    dependencies: ['baseline'],
    conflicts: ['empty'],
    order: 30,
  },
  degraded: {
    name: 'degraded',
    description:
      'Marks the scenario for deterministic degraded-service fixtures',
    dependencies: ['baseline'],
    conflicts: [],
    order: 40,
  },
  'moderation-heavy': {
    name: 'moderation-heavy',
    description: 'Marks the scenario for moderation-heavy fixture generation',
    dependencies: ['baseline'],
    conflicts: ['empty'],
    order: 50,
  },
};

export const MOCK_SCENARIO_MANIFESTS: Readonly<
  Record<MockScenarioPackName, MockScenarioManifest>
> = MANIFESTS;

function isMockScenarioPackName(value: string): value is MockScenarioPackName {
  return MOCK_SCENARIO_PACK_NAMES.some((name) => name === value);
}

function normaliseRequestedPacks(
  values: readonly string[],
): MockScenarioPackName[] {
  const result: MockScenarioPackName[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim().toLowerCase();
    if (!value) continue;
    if (!isMockScenarioPackName(value)) {
      throw new Error(
        `Unknown mock scenario pack "${rawValue}". Available packs: ${MOCK_SCENARIO_PACK_NAMES.join(', ')}`,
      );
    }
    if (!result.includes(value)) result.push(value);
  }

  if (result.length === 0) return ['baseline'];
  return result;
}

function assertNoRequestedConflicts(
  packs: readonly MockScenarioPackName[],
): void {
  for (const pack of packs) {
    for (const conflict of MANIFESTS[pack].conflicts) {
      if (packs.includes(conflict)) {
        throw new Error(
          `Mock scenario pack "${pack}" cannot be combined with "${conflict}"`,
        );
      }
    }
  }
}

function visitDependencies(
  pack: MockScenarioPackName,
  visiting: Set<MockScenarioPackName>,
  visited: Set<MockScenarioPackName>,
  output: MockScenarioPackName[],
): void {
  if (visited.has(pack)) return;
  if (visiting.has(pack)) {
    throw new Error(
      `Mock scenario manifest dependency cycle detected at "${pack}"`,
    );
  }

  visiting.add(pack);
  for (const dependency of MANIFESTS[pack].dependencies) {
    visitDependencies(dependency, visiting, visited, output);
  }
  visiting.delete(pack);
  visited.add(pack);
  output.push(pack);
}

export function compileMockScenarioSelection(
  values: readonly string[],
): CompiledMockScenarioSelection {
  const requestedPacks = normaliseRequestedPacks(values);
  assertNoRequestedConflicts(requestedPacks);

  const packs: MockScenarioPackName[] = [];
  const visiting = new Set<MockScenarioPackName>();
  const visited = new Set<MockScenarioPackName>();
  for (const pack of requestedPacks) {
    visitDependencies(pack, visiting, visited, packs);
  }
  assertNoRequestedConflicts(packs);

  packs.sort((left, right) => MANIFESTS[left].order - MANIFESTS[right].order);

  return {
    requestedPacks,
    packs,
    traits: {
      population: packs.includes('empty')
        ? 'empty'
        : packs.includes('dense')
          ? 'dense'
          : 'baseline',
      degraded: packs.includes('degraded'),
      moderationHeavy: packs.includes('moderation-heavy'),
    },
  };
}

export function resolveMockScenarioSelection(
  rawValue: unknown,
): CompiledMockScenarioSelection {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return compileMockScenarioSelection(['baseline']);
  }
  if (typeof rawValue !== 'string') {
    throw new Error('MOCK_BACKEND_SCENARIOS must be a comma-separated string');
  }

  return compileMockScenarioSelection(rawValue.split(','));
}

export function listMockScenarioManifests(): MockScenarioManifest[] {
  return MOCK_SCENARIO_PACK_NAMES.map((name) => ({
    ...MANIFESTS[name],
    dependencies: [...MANIFESTS[name].dependencies],
    conflicts: [...MANIFESTS[name].conflicts],
  }));
}
