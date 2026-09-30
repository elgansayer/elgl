import { BadRequestException, Injectable } from '@nestjs/common';
import { isMockBackendEnabled } from '../config/mock-backend-mode';
import { buildMockFixtureSnapshot, buildMockUsers } from '../mock-data';
import { resolveMockFixtureSeed } from './deterministic-fixtures';
import {
  CompiledMockScenarioSelection,
  compileMockScenarioSelection,
  listMockScenarioManifests,
  resolveMockScenarioSelection,
} from './scenario-manifests';

const DENSE_USER_COUNT = 450;
const MOCK_NAMESPACE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface MockScenarioSnapshot {
  namespace: string;
  seed: number;
  selection: CompiledMockScenarioSelection;
  summary: {
    users: number;
    linkedAccounts: number;
    totalRecords: number;
  };
  fixtures: ReturnType<typeof buildMockFixtureSnapshot>;
}

@Injectable()
export class MockScenariosService {
  private readonly defaultSelection = isMockBackendEnabled()
    ? resolveMockScenarioSelection(process.env.MOCK_BACKEND_SCENARIOS)
    : compileMockScenarioSelection(['baseline']);
  private readonly namespaceSelections = new Map<
    string,
    CompiledMockScenarioSelection
  >();

  list() {
    return {
      defaultSelection: this.cloneSelection(this.defaultSelection),
      manifests: listMockScenarioManifests(),
    };
  }

  get(namespace: string): CompiledMockScenarioSelection {
    const validatedNamespace = this.validateNamespace(namespace);
    const selection =
      this.namespaceSelections.get(validatedNamespace) ?? this.defaultSelection;
    return this.cloneSelection(selection);
  }

  select(
    namespace: string,
    packs: readonly string[],
  ): CompiledMockScenarioSelection {
    const validatedNamespace = this.validateNamespace(namespace);
    let selection: CompiledMockScenarioSelection;
    try {
      selection = compileMockScenarioSelection(packs);
    } catch (error) {
      throw new BadRequestException(this.errorMessage(error));
    }
    this.namespaceSelections.set(validatedNamespace, selection);
    return this.cloneSelection(selection);
  }

  reset(namespace: string): CompiledMockScenarioSelection {
    const validatedNamespace = this.validateNamespace(namespace);
    this.namespaceSelections.delete(validatedNamespace);
    return this.cloneSelection(this.defaultSelection);
  }

  snapshot(namespace: string): MockScenarioSnapshot {
    const validatedNamespace = this.validateNamespace(namespace);
    const selection = this.get(validatedNamespace);
    const seed = resolveMockFixtureSeed();
    const base = buildMockFixtureSnapshot(seed);

    const fixtures =
      selection.traits.population === 'empty'
        ? { ...base, linkedAccounts: [], users: [] }
        : selection.traits.population === 'dense'
          ? { ...base, users: this.buildDenseUsers(seed) }
          : base;

    const summary = {
      users: fixtures.users.length,
      linkedAccounts: fixtures.linkedAccounts.length,
      totalRecords: fixtures.users.length + fixtures.linkedAccounts.length,
    };

    return {
      namespace: validatedNamespace,
      seed,
      selection,
      summary,
      fixtures,
    };
  }

  private buildDenseUsers(seed: number): ReturnType<typeof buildMockUsers> {
    const users = Array.from({ length: 3 }, (_, batchIndex) =>
      buildMockUsers((seed + batchIndex) >>> 0).map((user, userIndex) => ({
        ...user,
        id: `fake-${batchIndex * 150 + userIndex + 1}`,
      })),
    ).flat();

    if (users.length !== DENSE_USER_COUNT) {
      throw new Error('Dense mock scenario produced an unexpected user count');
    }
    return users;
  }

  private validateNamespace(namespace: string): string {
    const value = namespace.trim();
    if (!MOCK_NAMESPACE_PATTERN.test(value)) {
      throw new BadRequestException(
        'Mock scenario namespace must be 1-64 characters using letters, numbers, dot, underscore or hyphen',
      );
    }
    return value;
  }

  private cloneSelection(
    selection: CompiledMockScenarioSelection,
  ): CompiledMockScenarioSelection {
    return {
      requestedPacks: [...selection.requestedPacks],
      packs: [...selection.packs],
      traits: { ...selection.traits },
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Invalid mock scenario selection';
  }
}
