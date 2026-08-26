export const MOCK_BACKEND_MODES = ['disabled', 'local', 'test', 'demo'] as const;

export type MockBackendMode = (typeof MOCK_BACKEND_MODES)[number];

const ENABLED_MOCK_BACKEND_MODES = new Set<MockBackendMode>([
  'local',
  'test',
  'demo',
]);

const ALLOWED_NODE_ENVS = new Set(['development', 'test']);

export interface MockBackendEnvironment {
  NODE_ENV?: unknown;
  MOCK_BACKEND_MODE?: unknown;
}

/**
 * Parse and validate the explicit mock backend profile.
 *
 * Mock mode is opt-in. Missing/blank values are always treated as disabled;
 * dependency failures must never activate fixtures implicitly.
 */
export function resolveMockBackendMode(
  environment: MockBackendEnvironment,
): MockBackendMode {
  const rawMode = environment.MOCK_BACKEND_MODE;
  if (rawMode === undefined || rawMode === null || rawMode === '') {
    return 'disabled';
  }

  if (typeof rawMode !== 'string') {
    throw new Error('MOCK_BACKEND_MODE must be a string');
  }

  const mode = rawMode.trim().toLowerCase();
  if (!MOCK_BACKEND_MODES.includes(mode as MockBackendMode)) {
    throw new Error(
      `MOCK_BACKEND_MODE must be one of: ${MOCK_BACKEND_MODES.join(', ')}`,
    );
  }

  return mode as MockBackendMode;
}

/**
 * Refuse every fixture-enabled profile outside local/test runtimes.
 * This check is deliberately independent of service availability: outages are
 * errors, never a reason to turn production traffic into mock success.
 */
export function assertMockBackendActivationBoundary(
  environment: MockBackendEnvironment,
): MockBackendMode {
  const mode = resolveMockBackendMode(environment);
  if (!ENABLED_MOCK_BACKEND_MODES.has(mode)) {
    return mode;
  }

  const rawNodeEnv = environment.NODE_ENV;
  const nodeEnv =
    typeof rawNodeEnv === 'string'
      ? rawNodeEnv.trim().toLowerCase()
      : 'development';

  if (!ALLOWED_NODE_ENVS.has(nodeEnv)) {
    throw new Error(
      `MOCK_BACKEND_MODE=${mode} is not allowed when NODE_ENV=${nodeEnv || 'unknown'}`,
    );
  }

  return mode;
}

export function isMockBackendEnabled(
  environment: MockBackendEnvironment = process.env,
): boolean {
  return assertMockBackendActivationBoundary(environment) !== 'disabled';
}
