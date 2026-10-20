import { validationSchema } from './validation.schema';
import { assertMockBackendActivationBoundary } from './mock-backend-mode';

export const PRODUCTION_REQUIRED_ENV_KEYS = [
  'FRONTEND_URL',
  'INTERNAL_API_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
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
  { key: 'LIVEKIT_URL', schemes: ['ws:', 'wss:'] },
  { key: 'CLOUDFLARE_R2_GATEWAY_URL', schemes: ['http:', 'https:'] },
  { key: 'CLOUDFLARE_R2_PUBLIC_URL', schemes: ['http:', 'https:'] },
  { key: 'APPLE_VERIFICATION_URL', schemes: ['http:', 'https:'] },
  { key: 'GOOGLE_PUBSUB_AUDIENCE', schemes: ['http:', 'https:'] },
  { key: 'LLM_BASE_URL', schemes: ['http:', 'https:'] },
];

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
] as const;

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
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

function assertUrlSchemes(config: Record<string, unknown>): void {
  const errors: string[] = [];

  for (const requirement of URL_REQUIREMENTS) {
    const raw = config[requirement.key];
    if (raw === undefined || raw === null || raw === '') continue;
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

  if (errors.length > 0) {
    throw new Error(`Invalid environment URLs: ${errors.join('; ')}`);
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

  assertUrlSchemes(rawConfig);

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

  return {
    ...result.value,
    MOCK_BACKEND_MODE: mockBackendMode,
  };
}
