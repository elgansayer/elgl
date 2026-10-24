import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { buildMockFixtureSnapshot } from './mock-data';
import { resolveMockFixtureSeed } from './mock/deterministic-fixtures';

type MockFixtureSnapshot = ReturnType<typeof buildMockFixtureSnapshot>;

interface MockFixtureNamespaceState {
  seed: number;
  snapshot: MockFixtureSnapshot;
  checkpoints: Map<string, MockFixtureSnapshot>;
}

export interface MockFixtureSummary {
  users: number;
  linkedAccounts: number;
  totalRecords: number;
}

export interface MockFixtureStateResponse {
  namespace: string;
  seed: number;
  seedId: string;
  summary: MockFixtureSummary;
  snapshot: MockFixtureSnapshot;
}

export interface MockFixtureMutationResponse extends MockFixtureStateResponse {
  operation: 'reset' | 'reseed' | 'snapshot' | 'restore';
  checkpoint?: string;
}

const DEFAULT_MOCK_FIXTURE_NAMESPACE = 'default';
const MOCK_FIXTURE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

@Injectable()
export class AppService {
  private readonly mockFixtureNamespaces = new Map<
    string,
    MockFixtureNamespaceState
  >();

  getHello(): string {
    return 'Hey there!';
  }

  getMockFixtures(namespace?: string): MockFixtureStateResponse {
    const normalizedNamespace = this.normalizeMockFixtureName(
      namespace,
      DEFAULT_MOCK_FIXTURE_NAMESPACE,
      'namespace',
    );
    return this.toMockFixtureResponse(
      normalizedNamespace,
      this.getMockFixtureNamespaceState(normalizedNamespace),
    );
  }

  resetMockFixtures(namespace?: string): MockFixtureMutationResponse {
    const normalizedNamespace = this.normalizeMockFixtureName(
      namespace,
      DEFAULT_MOCK_FIXTURE_NAMESPACE,
      'namespace',
    );
    const state = this.getMockFixtureNamespaceState(normalizedNamespace);
    state.snapshot = buildMockFixtureSnapshot(state.seed);
    return {
      ...this.toMockFixtureResponse(normalizedNamespace, state),
      operation: 'reset',
    };
  }

  reseedMockFixtures(
    seed: unknown,
    namespace?: string,
  ): MockFixtureMutationResponse {
    const normalizedNamespace = this.normalizeMockFixtureName(
      namespace,
      DEFAULT_MOCK_FIXTURE_NAMESPACE,
      'namespace',
    );
    const normalizedSeed = resolveMockFixtureSeed({ MOCK_BACKEND_SEED: seed });
    const state = this.getMockFixtureNamespaceState(normalizedNamespace);
    state.seed = normalizedSeed;
    state.snapshot = buildMockFixtureSnapshot(normalizedSeed);
    return {
      ...this.toMockFixtureResponse(normalizedNamespace, state),
      operation: 'reseed',
    };
  }

  captureMockFixtureSnapshot(
    checkpoint: string,
    namespace?: string,
  ): MockFixtureMutationResponse {
    const normalizedNamespace = this.normalizeMockFixtureName(
      namespace,
      DEFAULT_MOCK_FIXTURE_NAMESPACE,
      'namespace',
    );
    const normalizedCheckpoint = this.normalizeMockFixtureName(
      checkpoint,
      undefined,
      'checkpoint',
    );
    const state = this.getMockFixtureNamespaceState(normalizedNamespace);
    state.checkpoints.set(normalizedCheckpoint, structuredClone(state.snapshot));
    return {
      ...this.toMockFixtureResponse(normalizedNamespace, state),
      operation: 'snapshot',
      checkpoint: normalizedCheckpoint,
    };
  }

  restoreMockFixtureSnapshot(
    checkpoint: string,
    namespace?: string,
  ): MockFixtureMutationResponse {
    const normalizedNamespace = this.normalizeMockFixtureName(
      namespace,
      DEFAULT_MOCK_FIXTURE_NAMESPACE,
      'namespace',
    );
    const normalizedCheckpoint = this.normalizeMockFixtureName(
      checkpoint,
      undefined,
      'checkpoint',
    );
    const state = this.getMockFixtureNamespaceState(normalizedNamespace);
    const snapshot = state.checkpoints.get(normalizedCheckpoint);
    if (!snapshot) {
      throw new NotFoundException(
        `Mock fixture checkpoint "${normalizedCheckpoint}" was not found`,
      );
    }

    state.snapshot = structuredClone(snapshot);
    state.seed = state.snapshot.diagnostics.seed;
    return {
      ...this.toMockFixtureResponse(normalizedNamespace, state),
      operation: 'restore',
      checkpoint: normalizedCheckpoint,
    };
  }

  private getMockFixtureNamespaceState(
    namespace: string,
  ): MockFixtureNamespaceState {
    const existing = this.mockFixtureNamespaces.get(namespace);
    if (existing) return existing;

    const seed = resolveMockFixtureSeed();
    const state: MockFixtureNamespaceState = {
      seed,
      snapshot: buildMockFixtureSnapshot(seed),
      checkpoints: new Map(),
    };
    this.mockFixtureNamespaces.set(namespace, state);
    return state;
  }

  private toMockFixtureResponse(
    namespace: string,
    state: MockFixtureNamespaceState,
  ): MockFixtureStateResponse {
    const snapshot = structuredClone(state.snapshot);
    const users = snapshot.users.length;
    const linkedAccounts = snapshot.linkedAccounts.length;
    return {
      namespace,
      seed: state.seed,
      seedId: snapshot.diagnostics.seedId,
      summary: {
        users,
        linkedAccounts,
        totalRecords: users + linkedAccounts,
      },
      snapshot,
    };
  }

  private normalizeMockFixtureName(
    value: string | undefined,
    fallback: string | undefined,
    field: 'namespace' | 'checkpoint',
  ): string {
    if (value === undefined || value.trim() === '') {
      if (fallback !== undefined) return fallback;
      throw new BadRequestException(`Mock fixture ${field} is required`);
    }

    const normalized = value.trim();
    if (!MOCK_FIXTURE_NAME_PATTERN.test(normalized)) {
      throw new BadRequestException(
        `Mock fixture ${field} must be 1-64 letters, digits, dots, underscores or hyphens`,
      );
    }
    return normalized;
  }
}
