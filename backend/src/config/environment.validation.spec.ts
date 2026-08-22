import {
  PRODUCTION_REQUIRED_ENV_KEYS,
  validateEnvironment,
} from './environment.validation';

function productionEnvironment(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://app.elgl.example',
    INTERNAL_API_SECRET: 'prod-internal-secret-123',
    SUPABASE_URL: 'https://elgl.supabase.co',
    SUPABASE_ANON_KEY: 'prod-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-key',
    DATABASE_URL: 'postgresql://postgres:secret@db.internal:5432/elgl',
    REDIS_URL: 'rediss://redis.internal:6379',
    CENTRIFUGO_URL: 'https://realtime.elgl.app',
    CENTRIFUGO_API_KEY: 'prod-centrifugo-api-key',
    CENTRIFUGO_SECRET: 'prod-centrifugo-secret',
    LIVEKIT_URL: 'wss://livekit.elgl.app',
    LIVEKIT_API_KEY: 'prod-livekit-api-key',
    LIVEKIT_SECRET: 'prod-livekit-secret',
    CLOUDFLARE_R2_GATEWAY_URL: 'https://r2-gateway.elgl.workers.dev',
    CLOUDFLARE_R2_SIGNING_SECRET:
      'prod-r2-signing-secret-with-at-least-32-characters',
    CLOUDFLARE_R2_SERVICE_TOKEN:
      'prod-r2-service-token-with-at-least-32-characters',
    CLOUDFLARE_R2_PUBLIC_URL: 'https://media.elgl.app',
    CLOUDFLARE_STREAM_ACCOUNT_ID: 'prod-cloudflare-account',
    CLOUDFLARE_STREAM_API_TOKEN:
      'prod-cloudflare-stream-token-at-least-twenty-chars',
    DEEPL_API_KEY: 'prod-deepl-api-key',
    AZURE_TRANSLATOR_KEY: 'prod-azure-translator-key',
    STRIPE_SECRET_KEY: 'sk_live_123456789',
    STRIPE_WEBHOOK_SECRET: 'whsec_live_123456789',
    STRIPE_MONTHLY_PRICE_ID: 'price_live_monthly',
    STRIPE_YEARLY_PRICE_ID: 'price_live_yearly',
    APPLE_BUNDLE_ID: 'com.elgl.app',
    APPLE_SHARED_SECRET: 'prod-apple-shared-secret',
    APPLE_ROOT_CA_CERT_1: 'prod-apple-root-ca-cert',
    APPLE_VERIFICATION_URL: 'https://buy.itunes.apple.com/verifyReceipt',
    GOOGLE_PLAY_PACKAGE_NAME: 'com.elgl.app',
    GOOGLE_PLAY_ACCESS_TOKEN: 'prod-google-play-access-token',
    GOOGLE_PUBSUB_AUDIENCE: 'https://api.elgl.app/google-play/webhook',
    GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'billing@elgl-prod.iam.gserviceaccount.com',
    TRANSFER_SECRET: 'prod-transfer-secret',
    LLM_API_KEY: 'prod-llm-api-key',
  };
}

describe('validateEnvironment', () => {
  it('accepts a complete production environment and applies safe non-secret defaults', () => {
    const validated = validateEnvironment(productionEnvironment());

    expect(validated.NODE_ENV).toBe('production');
    expect(validated.PORT).toBe(3000);
    expect(validated.LOG_LEVEL).toBe('info');
  });

  it('requires every production variable before Joi defaults can mask omissions', () => {
    const config = productionEnvironment();
    delete config.SUPABASE_SERVICE_ROLE_KEY;
    delete config.CENTRIFUGO_SECRET;

    expect(() => validateEnvironment(config)).toThrow(
      'Production environment is missing required variables: SUPABASE_SERVICE_ROLE_KEY, CENTRIFUGO_SECRET',
    );
  });

  it('keeps the production required-key inventory explicit and stable', () => {
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('STRIPE_WEBHOOK_SECRET');
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('TRANSFER_SECRET');
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('LLM_API_KEY');
  });

  it.each([
    ['INTERNAL_API_SECRET', 'change-me-in-production'],
    ['CLOUDFLARE_R2_SIGNING_SECRET', 'replace-with-a-real-secret'],
    ['STRIPE_SECRET_KEY', 'sk_test_123'],
    ['SUPABASE_URL', 'https://example.supabase.co'],
  ])('rejects production placeholder %s values', (key, value) => {
    expect(() =>
      validateEnvironment({ ...productionEnvironment(), [key]: value }),
    ).toThrow('Production environment contains placeholder values for:');
  });

  it.each([
    ['SUPABASE_URL', 'not-a-url', 'must be a valid URL'],
    ['DATABASE_URL', 'https://db.internal/elgl', 'must use postgres: or postgresql:'],
    ['REDIS_URL', 'http://redis.internal', 'must use redis: or rediss:'],
    ['LIVEKIT_URL', 'https://livekit.elgl.app', 'must use ws: or wss:'],
  ])('rejects malformed or wrong-scheme %s values', (key, value, message) => {
    expect(() =>
      validateEnvironment({ ...productionEnvironment(), [key]: value }),
    ).toThrow(message);
  });

  it('retains schema range validation after raw production checks', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        CENTRIFUGO_CONNECTION_RATE_LIMIT: '0',
      }),
    ).toThrow('Environment validation failed:');
  });

  it('preserves development/test defaults while still validating supplied URLs', () => {
    const validated = validateEnvironment({
      NODE_ENV: 'test',
      TRANSFER_SECRET: 'test-transfer-secret',
    });

    expect(validated.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(validated.CENTRIFUGO_URL).toBe('http://localhost:8000');

    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        TRANSFER_SECRET: 'test-transfer-secret',
        REDIS_URL: 'https://wrong-scheme.example',
      }),
    ).toThrow('REDIS_URL must use redis: or rediss:');
  });
});
