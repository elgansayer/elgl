import { validationSchema } from './validation.schema';
import { assertMockBackendActivationBoundary } from './mock-backend-mode';

export const PRODUCTION_REQUIRED_ENV_KEYS = [
  'FRONTEND_URL',
  'INTERNAL_API_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CHAT_E2EE_MASTER_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
  'CENTRIFUGO_URL',
  'CENTRIFUGO_API_KEY',
  'CENTRIFUGO_SECRET',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_SECRET',
  'CLOUDFLARE_R2_GATEWAY_URL',
  'CLOUDFLARE_R2_SIGNING_SECRET',
  'CLOUDFLARE_R2_SERVICE_TOKEN',
  'CLOUDFLARE_R2_PUBLIC_URL',
  'CLOUDFLARE_STREAM_ACCOUNT_ID',
  'CLOUDFLARE_STREAM_API_TOKEN',
  'DEEPL_API_KEY',
  'AZURE_TRANSLATOR_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_MONTHLY_PRICE_ID',
  'STRIPE_YEARLY_PRICE_ID',
  'APPLE_BUNDLE_ID',
  'APPLE_SHARED_SECRET',
  'APPLE_ROOT_CA_CERT_1',
  'APPLE_VERIFICATION_URL',
  'GOOGLE_PLAY_PACKAGE_NAME',
  'GOOGLE_PLAY_ACCESS_TOKEN',
  'GOOGLE_PUBSUB_AUDIENCE',
  'GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL',
  'TRANSFER_SECRET',
  'LLM_API_KEY',
] as const;

type ProductionRequiredEnvKey = (typeof PRODUCTION_REQUIRED_ENV_KEYS)[number];

const URL_REQUIREMENTS: ReadonlyArray<{
  key: string;
  schemes: readonly string[];
}> = [
  { key: 'FRONTEND_URL', schemes: ['http:', 'https:'] },
  { key: 'APP_URL', schemes: ['http:', 'https:'] },
  { key: 'SUPABASE_URL', schemes: ['http:', 'https:'] },
  { key: 'DATABASE_URL', schemes: ['postgres:', 'postgresql:'] },
  { key: 'REDIS_URL', schemes: ['redis:', 'rediss:'] },
  { key: 'CENTRIFUGO_URL', schemes: ['http:', 'https:', 'ws:', 'wss:'] },
  { key: 'CENTRIFUGO_API_URL', schemes: ['http:', 'https:'] },
  { key: 'LIVEKIT_URL', schemes: ['ws:', 'wss:'] },
  { key: 'CLOUDFLARE_R2_GATEWAY_URL', schemes: ['http:', 'https:'] },
  { key: 'CLOUDFLARE_R2_PUBLIC_URL', schemes: ['http:', 'https:'] },
  { key: 'APPLE_VERIFICATION_URL', schemes: ['http:', 'https:'] },
  { key: 'GOOGLE_PUBSUB_AUDIENCE', schemes: ['http:', 'https:'] },
  { key: 'LLM_BASE_URL', schemes: ['http:', 'https:'] },
  { key: 'LLM_API_URL', schemes: ['http:', 'https:'] },
];

const HOST_LABEL = '[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?';
const HOSTNAME = `${HOST_LABEL}(?:\\.${HOST_LABEL})*`;
const STUN_SERVER_PATTERN = new RegExp(
  `^stuns?:(?:${HOSTNAME}|\\[[0-9a-f:.]+\\])(?::(\\d{1,5}))?$`,
  'i',
);
const SOURCE_HOST_PATTERN = new RegExp(`^(?:\\*\\.)?${HOSTNAME}$`, 'i');

function isStunServer(entry: string): boolean {
  const match = STUN_SERVER_PATTERN.exec(entry);
  if (!match) return false;
  const port = match[1];
  return port === undefined || (Number(port) >= 1 && Number(port) <= 65535);
}

function isSourceHost(entry: string): boolean {
  return SOURCE_HOST_PATTERN.test(entry);
}

/**
 * Comma-separated variables whose entries are parsed with the same
 * split/trim/filter rules the services apply at runtime. A malformed entry is
 * otherwise accepted silently: a browser can refuse to create a peer
 * connection when an ICE server URL is invalid, and a source host with a
 * scheme or port never matches.
 */
const LIST_REQUIREMENTS: ReadonlyArray<{
  key: string;
  expectation: string;
  isValid: (entry: string) => boolean;
}> = [
  {
    key: 'LIVEKIT_RTC_STUN_SERVERS',
    expectation: 'a stun: or stuns: URI with an optional port',
    isValid: isStunServer,
  },
  {
    key: 'CLOUDFLARE_R2_SOURCE_HOSTS',
    expectation: 'a hostname or *.hostname without scheme, port or path',
    isValid: isSourceHost,
  },
];

/**
 * Variables holding a JSON document that the service parses lazily. The
 * notifications service swallows a parse failure and silently stops sending
 * push notifications, so a malformed credential must be rejected at startup.
 */
const JSON_OBJECT_KEYS = ['FIREBASE_SERVICE_ACCOUNT'] as const;

const PLACEHOLDER_PATTERNS = [
  /^change-me/i,
  /^replace-with/i,
  /^your-/i,
  /^test-/i,
  /^sk_test(?:_|$)/i,
  /^whsec_test(?:_|$)/i,
  /-change-in-prod$/i,
  /example\.supabase\.co/i,
  /\.example\.(?:com|org|net)$/i,
  /^device-transfer-secret-dev-only$/i,
  /^test-transfer-secret$/i,
  /^dev_livekit_(?:key|secret)_test_value/i,
  /localhost/i,
  /^https?:\/\/pubsub\.googleapis\.com\/test/i,
  /^test@example\.com/i,
  /^price_.*_test$/i,
  /^com\.hellotalk\.app$/i,
  /sandbox\.itunes\.apple\.com/i,
] as const;

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isEnvironmentRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRequiredProductionValues(config: Record<string, unknown>): void {
  const missing = PRODUCTION_REQUIRED_ENV_KEYS.filter((key) =>
    isBlank(config[key]),
  );
  if (missing.length > 0) {
    throw new Error(
      `Production environment is missing required variables: ${missing.join(', ')}`,
    );
  }
}

function assertNoProductionPlaceholders(config: Record<string, unknown>): void {
  const placeholders: ProductionRequiredEnvKey[] = [];

  for (const key of PRODUCTION_REQUIRED_ENV_KEYS) {
    const value = config[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      placeholders.push(key);
    }
  }

  if (placeholders.length > 0) {
    throw new Error(
      `Production environment contains placeholder values for: ${placeholders.join(', ')}`,
    );
  }
}

function assertNoProductionPadding(config: Record<string, unknown>): void {
  const padded = PRODUCTION_REQUIRED_ENV_KEYS.filter((key) => {
    const value = config[key];
    return typeof value === 'string' && value !== value.trim();
  });

  if (padded.length > 0) {
    throw new Error(
      `Production environment contains surrounding whitespace for: ${padded.join(', ')}`,
    );
  }
}

function isUnset(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === '';
}

function collectUrlErrors(config: Record<string, unknown>): string[] {
  const errors: string[] = [];

  for (const requirement of URL_REQUIREMENTS) {
    const raw = config[requirement.key];
    if (isUnset(raw)) continue;
    if (typeof raw !== 'string') {
      errors.push(`${requirement.key} must be a URL string`);
      continue;
    }

    try {
      const parsed = new URL(raw);
      if (!requirement.schemes.includes(parsed.protocol)) {
        errors.push(
          `${requirement.key} must use ${requirement.schemes.join(' or ')}`,
        );
      }
    } catch {
      errors.push(`${requirement.key} must be a valid URL`);
    }
  }

  return errors;
}

/**
 * Entries are reported by position, never by value, so a misplaced secret in a
 * list variable cannot be echoed into deployment logs.
 */
function collectListErrors(config: Record<string, unknown>): string[] {
  const errors: string[] = [];

  for (const requirement of LIST_REQUIREMENTS) {
    const raw = config[requirement.key];
    if (isUnset(raw)) continue;
    if (typeof raw !== 'string') {
      errors.push(`${requirement.key} must be a comma-separated string`);
      continue;
    }

    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry, index) => {
        if (!requirement.isValid(entry)) {
          errors.push(
            `${requirement.key} entry ${index + 1} must be ${requirement.expectation}`,
          );
        }
      });
  }

  return errors;
}

function isJsonObject(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}

function collectJsonErrors(config: Record<string, unknown>): string[] {
  const errors: string[] = [];

  for (const key of JSON_OBJECT_KEYS) {
    const raw = config[key];
    if (isUnset(raw)) continue;
    if (typeof raw !== 'string' || !isJsonObject(raw)) {
      errors.push(`${key} must be a JSON object`);
    }
  }

  return errors;
}

/**
 * URL, list and JSON format checks run together so an operator sees every
 * malformed value in one startup failure instead of fixing them one restart
 * at a time. Messages name variables and rules only, never their values.
 */
function assertValueFormats(config: Record<string, unknown>): void {
  const errors = [
    ...collectUrlErrors(config),
    ...collectListErrors(config),
    ...collectJsonErrors(config),
  ];

  if (errors.length > 0) {
    throw new Error(`Invalid environment values: ${errors.join('; ')}`);
  }
}

/**
 * NestJS ConfigModule validator.
 *
 * The historical Joi schema intentionally supplies test/development defaults so
 * isolated unit tests can boot cheaply. Production must never inherit those
 * synthetic credentials. We therefore validate the raw environment first,
 * before Joi has a chance to apply defaults, then run the canonical schema for
 * type/range validation and normalisation.
 */
export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const rawNodeEnv = rawConfig.NODE_ENV;
  const nodeEnv =
    typeof rawNodeEnv === 'string' ? rawNodeEnv.toLowerCase() : 'development';
  const mockBackendMode = assertMockBackendActivationBoundary(rawConfig);

  if (nodeEnv === 'production') {
    assertRequiredProductionValues(rawConfig);
    assertNoProductionPadding(rawConfig);
    assertNoProductionPlaceholders(rawConfig);
  }

  assertValueFormats(rawConfig);

  const result = validationSchema.validate(rawConfig, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (result.error) {
    const details = result.error.details
      .map((detail) => detail.message)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  const validatedValue: unknown = result.value;
  if (!isEnvironmentRecord(validatedValue)) {
    throw new Error('Environment validation failed: expected an object');
  }

  return {
    ...validatedValue,
    MOCK_BACKEND_MODE: mockBackendMode,
  };
}
