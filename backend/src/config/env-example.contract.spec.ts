import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigModule } from '@nestjs/config';
import {
  PRODUCTION_REQUIRED_ENV_KEYS,
  validateEnvironment,
} from './env.validation';
import { validationSchema } from './validation.schema';

/**
 * Contract between the operator-facing `.env.example` files, the canonical Joi
 * schema, the code that reads configuration and the Docker Compose files.
 *
 * The examples promise to document every variable the API recognises. Nothing
 * else keeps that promise true, so these tests turn drift into a failing build:
 * a variable that is read but undeclared, declared but undocumented, or
 * documented but unknown fails here instead of at 3am in production.
 */

const backendRoot = fileURLToPath(new URL('../..', import.meta.url));
const repositoryRoot = join(backendRoot, '..');
const sourceRoot = join(backendRoot, 'src');

const EXAMPLES = [
  { label: 'backend/.env.example', path: join(backendRoot, '.env.example') },
  { label: '.env.example', path: join(repositoryRoot, '.env.example') },
] as const;

const COMPOSE_FILES = [
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'docker-compose.prod.yml',
] as const;

/**
 * Schema variables that are deliberately NOT documented in the examples.
 * `scripts/verify-livekit-turn-networking.mjs` forbids documenting static TURN
 * credentials because LiveKit's embedded TURN server issues short-lived ones.
 */
const UNDOCUMENTED_SCHEMA_KEYS: Readonly<Record<string, string>> = {
  LIVEKIT_TURN_USERNAME:
    'embedded TURN issues short-lived credentials; static ones must not be documented',
  LIVEKIT_TURN_PASSWORD:
    'embedded TURN issues short-lived credentials; static ones must not be documented',
};

/**
 * Variables that are not in the Joi schema because a dedicated parser owns
 * their validation (see `mock-backend-mode.ts`, `deterministic-fixtures.ts`
 * and `scenario-manifests.ts`). Each is documented in the examples.
 */
const VALIDATED_OUTSIDE_SCHEMA: ReadonlySet<string> = new Set([
  'MOCK_BACKEND_MODE',
  'MOCK_BACKEND_SEED',
  'MOCK_BACKEND_SCENARIOS',
]);

/** Compose-only credentials that must never be active example values. */
const INACTIVE_COMPOSE_SECRETS = ['GRAFANA_ADMIN_PASSWORD'] as const;

const FACTORY_SECTION_MARKER = /^# OpenHands Factory Configuration$/m;

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

/** The root example appends the unrelated OpenHands Factory settings. */
function applicationSection(text: string): string {
  const marker = FACTORY_SECTION_MARKER.exec(text);
  return marker ? text.slice(0, marker.index) : text;
}

/**
 * Variables documented as an active `KEY=value` entry or as an optional
 * commented `# KEY=value` entry. Prose comments never match because the
 * name must be immediately followed by `=`.
 */
function documentedKeys(text: string): Set<string> {
  const keys = new Set<string>();
  for (const line of text.split('\n')) {
    const match = /^(?:# )?([A-Z][A-Z0-9_]*)=/.exec(line);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function activeEntries(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match) entries.set(match[1], match[2]);
  }
  return entries;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

function productionSourceFiles(directory: string, found: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      productionSourceFiles(path, found);
    } else if (path.endsWith('.ts') && !/\.(?:e2e-)?spec\.ts$/.test(path)) {
      found.push(path);
    }
  }
  return found;
}

const PROCESS_ENV_READ =
  /process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\]/g;
// Only applied to files that use ConfigService, and only to names containing an
// underscore, so unrelated `map.get('USD')` style calls are not mistaken for
// configuration reads.
const CONFIG_SERVICE_READ =
  /\.\s*(?:get|getOrThrow)\s*(?:<[^()]*>)?\s*\(\s*['"`]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"`]/g;

/**
 * Environment variables read through a string literal, either directly from
 * `process.env` or through `ConfigService.get/getOrThrow`. Helpers that wrap
 * `get(key)` with a variable key are invisible here and must still be declared
 * in the schema by convention.
 */
function environmentReads(): Map<string, string[]> {
  const reads = new Map<string, string[]>();
  const record = (name: string, file: string) => {
    const files = reads.get(name) ?? [];
    files.push(relative(backendRoot, file));
    reads.set(name, files);
  };

  for (const file of productionSourceFiles(sourceRoot)) {
    const source = readText(file);
    for (const match of source.matchAll(PROCESS_ENV_READ)) {
      record(match[1] ?? match[2], file);
    }
    if (source.includes('ConfigService')) {
      for (const match of source.matchAll(CONFIG_SERVICE_READ)) {
        record(match[1], file);
      }
    }
  }
  return reads;
}

function composeInterpolatedVariables(): Map<string, string[]> {
  const variables = new Map<string, string[]>();
  for (const file of COMPOSE_FILES) {
    for (const match of readText(join(repositoryRoot, file)).matchAll(
      /\$\{([A-Z][A-Z0-9_]*)[^}]*\}/g,
    )) {
      variables.set(match[1], [...(variables.get(match[1]) ?? []), file]);
    }
  }
  return variables;
}

const schemaKeys = new Set(Object.keys(validationSchema.describe().keys ?? {}));

describe('environment example contract', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    // ConfigModule.forRoot copies validated defaults into process.env.
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
  });

  /** Runs an example through the real ConfigModule loader and validator. */
  async function loadExample(
    path: string,
    overrides: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    let validated: Record<string, unknown> = {};
    await ConfigModule.forRoot({
      envFilePath: path,
      ignoreEnvVars: true,
      validate: (config) => {
        validated = validateEnvironment({ ...config, ...overrides });
        return validated;
      },
    });
    return validated;
  }

  describe.each(EXAMPLES)('$label', ({ path }) => {
    const text = applicationSection(readText(path));
    const documented = documentedKeys(text);

    it('documents every variable declared in the validation schema', () => {
      const missing = sorted(
        [...schemaKeys].filter(
          (key) => !documented.has(key) && !(key in UNDOCUMENTED_SCHEMA_KEYS),
        ),
      );

      expect(missing).toEqual([]);
    });

    it('documents no variable the application does not recognise', () => {
      const composeVariables = composeInterpolatedVariables();
      const unknown = sorted(
        [...documented].filter(
          (key) =>
            !schemaKeys.has(key) &&
            !VALIDATED_OUTSIDE_SCHEMA.has(key) &&
            !composeVariables.has(key),
        ),
      );

      expect(unknown).toEqual([]);
    });

    it('never documents the schema variables that are intentionally hidden', () => {
      for (const key of Object.keys(UNDOCUMENTED_SCHEMA_KEYS)) {
        expect(documented.has(key)).toBe(false);
      }
    });

    it('provides a real value for every production-required variable', () => {
      const entries = activeEntries(text);
      const blank = PRODUCTION_REQUIRED_ENV_KEYS.filter(
        (key) => (entries.get(key) ?? '').trim() === '',
      );

      expect(blank).toEqual([]);
    });

    it('boots through the real ConfigModule loader in development after `cp .env.example .env`', async () => {
      const validated = await loadExample(path);

      expect(validated.NODE_ENV).toBe('development');
      expect(validated.PORT).toBe(3000);
    });

    it('refuses to boot in production until every placeholder is replaced', async () => {
      await expect(
        loadExample(path, { NODE_ENV: 'production' }),
      ).rejects.toThrow(
        'Production environment contains placeholder values for:',
      );
    });

    it('does not enable mock fixtures by default', async () => {
      const validated = await loadExample(path);

      expect(validated.MOCK_BACKEND_MODE).toBe('disabled');
    });
  });

  it('documents in the root example every variable the backend example documents', () => {
    const [backend, root] = EXAMPLES.map(({ path }) =>
      documentedKeys(applicationSection(readText(path))),
    );

    expect(sorted([...backend].filter((key) => !root.has(key)))).toEqual([]);
  });

  it('only adds Docker Compose interpolation variables to the root example', () => {
    const [backend, root] = EXAMPLES.map(({ path }) =>
      documentedKeys(applicationSection(readText(path))),
    );
    const composeVariables = composeInterpolatedVariables();

    const unexplained = sorted(
      [...root].filter(
        (key) => !backend.has(key) && !composeVariables.has(key),
      ),
    );

    expect(unexplained).toEqual([]);
  });

  it('documents in the root example every variable interpolated by Docker Compose', () => {
    const root = documentedKeys(applicationSection(readText(EXAMPLES[1].path)));

    const missing = sorted(
      [...composeInterpolatedVariables().keys()].filter(
        (key) => !root.has(key),
      ),
    );

    expect(missing).toEqual([]);
  });

  it('documents production-only Compose secrets without activating placeholders', () => {
    const rootText = applicationSection(readText(EXAMPLES[1].path));
    const documented = documentedKeys(rootText);
    const active = activeEntries(rootText);

    for (const key of INACTIVE_COMPOSE_SECRETS) {
      expect(documented.has(key)).toBe(true);
      expect(active.has(key)).toBe(false);
    }
  });

  it('declares every environment variable the production source reads', () => {
    const undeclared = [...environmentReads()]
      .filter(
        ([name]) =>
          !schemaKeys.has(name) && !VALIDATED_OUTSIDE_SCHEMA.has(name),
      )
      .map(([name, files]) => `${name} (${[...new Set(files)].join(', ')})`)
      .sort();

    expect(undeclared).toEqual([]);
  });

  it('keeps the production-required inventory inside the schema', () => {
    const unknown = PRODUCTION_REQUIRED_ENV_KEYS.filter(
      (key) => !schemaKeys.has(key),
    );

    expect(unknown).toEqual([]);
  });

  it('keeps the scanner honest by recognising the reads it is meant to find', () => {
    const reads = environmentReads();

    expect(reads.has('NODE_ENV')).toBe(true);
    expect(reads.has('PORT')).toBe(true);
    expect(reads.has('SUPABASE_SERVICE_ROLE_KEY')).toBe(true);
    expect(reads.get('LIVEKIT_SECRET')?.length).toBeGreaterThan(1);
  });
});
