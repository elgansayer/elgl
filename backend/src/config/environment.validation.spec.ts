import {
  PRODUCTION_REQUIRED_ENV_KEYS,
  validateEnvironment,
} from './env.validation';

function productionEnvironment(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://app.elgl.example',
    INTERNAL_API_SECRET: 'prod-internal-secret-123',
    SUPABASE_URL: 'https://elgl.supabase.co',
    SUPABASE_ANON_KEY: 'prod-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-key',
    CHAT_E2EE_MASTER_SECRET:
      'prod-chat-e2ee-master-secret-at-least-32-characters',
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
    GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL:
      'billing@elgl-prod.iam.gserviceaccount.com',
    TRANSFER_SECRET: 'prod-transfer-secret',
    LLM_API_KEY: 'prod-llm-api-key',
  };
}

function development(extra: Record<string, string>): Record<string, string> {
  return {
    NODE_ENV: 'development',
    TRANSFER_SECRET: 'test-transfer-secret',
    ...extra,
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
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('CHAT_E2EE_MASTER_SECRET');
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('STRIPE_WEBHOOK_SECRET');
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('TRANSFER_SECRET');
    expect(PRODUCTION_REQUIRED_ENV_KEYS).toContain('LLM_API_KEY');
  });

  it.each([
    ['INTERNAL_API_SECRET', 'change-me-in-production'],
    ['CLOUDFLARE_R2_SIGNING_SECRET', 'replace-with-a-real-secret'],
    ['STRIPE_SECRET_KEY', 'sk_test_123'],
    ['SUPABASE_URL', 'https://example.supabase.co'],
    ['CENTRIFUGO_API_KEY', 'secret-centrifugo-api-key-change-in-prod'],
    ['CENTRIFUGO_SECRET', 'secret-centrifugo-token-key-change-in-prod'],
    ['TRANSFER_SECRET', 'device-transfer-secret-dev-only'],
    ['TRANSFER_SECRET', 'test-transfer-secret'],
    ['LIVEKIT_API_KEY', 'dev_livekit_key_test_value_123'],
    ['LIVEKIT_SECRET', 'dev_livekit_secret_test_value_123'],
    ['FRONTEND_URL', 'http://localhost:4200'],
    ['FRONTEND_URL', 'https://localhost:4200'],
    ['DATABASE_URL', 'postgres://user:pass@localhost:5432/db'],
    ['REDIS_URL', 'redis://localhost:6379'],
    ['CENTRIFUGO_URL', 'http://localhost:8000'],
    ['LIVEKIT_URL', 'ws://localhost:7880'],
    ['CLOUDFLARE_R2_GATEWAY_URL', 'http://localhost:8787'],
    ['STRIPE_MONTHLY_PRICE_ID', 'price_monthly_test'],
    ['STRIPE_YEARLY_PRICE_ID', 'price_yearly_test'],
    ['APPLE_BUNDLE_ID', 'com.hellotalk.app'],
    [
      'APPLE_VERIFICATION_URL',
      'https://sandbox.itunes.apple.com/verifyReceipt',
    ],
    ['GOOGLE_PLAY_PACKAGE_NAME', 'com.hellotalk.app'],
    ['GOOGLE_PUBSUB_AUDIENCE', 'https://pubsub.googleapis.com/test'],
    ['GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL', 'test@example.com'],
  ])('rejects production placeholder %s values', (key, value) => {
    expect(() =>
      validateEnvironment({ ...productionEnvironment(), [key]: value }),
    ).toThrow('Production environment contains placeholder values for:');
  });

  it.each([
    ['CENTRIFUGO_API_KEY', ' prod-centrifugo-api-key'],
    ['CENTRIFUGO_SECRET', 'prod-centrifugo-secret '],
  ])('rejects whitespace-padded production %s values', (key, value) => {
    expect(() =>
      validateEnvironment({ ...productionEnvironment(), [key]: value }),
    ).toThrow(
      `Production environment contains surrounding whitespace for: ${key}`,
    );
  });

  it.each([
    ['SUPABASE_URL', 'not-a-url', 'must be a valid URL'],
    [
      'DATABASE_URL',
      'https://db.internal/elgl',
      'must use postgres: or postgresql:',
    ],
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

  describe('optional override URLs', () => {
    it.each([
      ['CENTRIFUGO_API_URL', 'ws://websocket:8000', 'must use http: or https:'],
      ['CENTRIFUGO_API_URL', 'websocket:8000/api', 'must use http: or https:'],
      ['LLM_API_URL', 'ftp://llm.internal/v1', 'must use http: or https:'],
      ['LLM_API_URL', 'not-a-url', 'must be a valid URL'],
    ])('rejects %s=%s', (key, value, message) => {
      expect(() => validateEnvironment(development({ [key]: value }))).toThrow(
        message,
      );
    });

    it('accepts well-formed overrides and leaves them unset by default', () => {
      const validated = validateEnvironment(
        development({
          CENTRIFUGO_API_URL: 'http://websocket:8000',
          LLM_API_URL: 'https://llm.internal/v1/chat/completions',
        }),
      );

      expect(validated.CENTRIFUGO_API_URL).toBe('http://websocket:8000');
      expect(validated.LLM_API_URL).toBe(
        'https://llm.internal/v1/chat/completions',
      );
      expect(validateEnvironment(development({})).LLM_API_URL).toBeUndefined();
    });
  });

  describe('list-valued variables', () => {
    it('accepts STUN lists using the runtime split, trim and filter rules', () => {
      expect(() =>
        validateEnvironment(
          development({
            LIVEKIT_RTC_STUN_SERVERS:
              ' stun:stun.l.google.com:19302 , stuns:stun.example.org:5349,stun:10.0.0.5,stun:[2001:db8::1]:3478, ',
          }),
        ),
      ).not.toThrow();
    });

    it.each([
      'stun.l.google.com:19302',
      'https://stun.example.org',
      'turn:turn.example.org:3478',
      'stun:stun.example.org:70000',
      'stun:stun.example.org:0',
      'stun:stun.example.org/path',
      'stun:',
    ])('rejects the STUN server entry %s', (entry) => {
      expect(() =>
        validateEnvironment(
          development({
            LIVEKIT_RTC_STUN_SERVERS: `stun:stun.l.google.com:19302,${entry}`,
          }),
        ),
      ).toThrow(
        'LIVEKIT_RTC_STUN_SERVERS entry 2 must be a stun: or stuns: URI with an optional port',
      );
    });

    it('accepts R2 source host allow-lists', () => {
      expect(() =>
        validateEnvironment(
          development({
            CLOUDFLARE_R2_SOURCE_HOSTS:
              'recordings.example.com, *.livekit.example.com,Media.Example.ORG',
          }),
        ),
      ).not.toThrow();
      expect(() =>
        validateEnvironment(development({ CLOUDFLARE_R2_SOURCE_HOSTS: '' })),
      ).not.toThrow();
    });

    it.each([
      'https://recordings.example.com',
      'recordings.example.com:8443',
      'recordings.example.com/path',
      '*',
      '*.',
      'rec ordings.example.com',
      '**.example.com',
    ])('rejects the R2 source host entry %s', (entry) => {
      expect(() =>
        validateEnvironment(
          development({
            CLOUDFLARE_R2_SOURCE_HOSTS: `recordings.example.com,${entry}`,
          }),
        ),
      ).toThrow(
        'CLOUDFLARE_R2_SOURCE_HOSTS entry 2 must be a hostname or *.hostname without scheme, port or path',
      );
    });

    it('never echoes list entries into the error message', () => {
      let message = '';
      try {
        validateEnvironment(
          development({
            CLOUDFLARE_R2_SOURCE_HOSTS: 'https://user:hunter2-secret@host',
          }),
        );
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('CLOUDFLARE_R2_SOURCE_HOSTS entry 1');
      expect(message).not.toContain('hunter2-secret');
    });
  });

  describe('JSON document variables', () => {
    it('accepts a JSON object credential and an unset or blank value', () => {
      expect(() =>
        validateEnvironment(
          development({
            FIREBASE_SERVICE_ACCOUNT: '{"type":"service_account"}',
          }),
        ),
      ).not.toThrow();
      expect(() =>
        validateEnvironment(development({ FIREBASE_SERVICE_ACCOUNT: '' })),
      ).not.toThrow();
      expect(() => validateEnvironment(development({}))).not.toThrow();
    });

    it.each(['{not json', '[]', '"just a string"', 'null', '42'])(
      'rejects the non-object FIREBASE_SERVICE_ACCOUNT value %s',
      (value) => {
        expect(() =>
          validateEnvironment(development({ FIREBASE_SERVICE_ACCOUNT: value })),
        ).toThrow('FIREBASE_SERVICE_ACCOUNT must be a JSON object');
      },
    );

    it('never echoes the credential into the error message', () => {
      let message = '';
      try {
        validateEnvironment(
          development({
            FIREBASE_SERVICE_ACCOUNT: '{"private_key": "super-secret-key"',
          }),
        );
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('FIREBASE_SERVICE_ACCOUNT must be a JSON');
      expect(message).not.toContain('super-secret-key');
    });
  });

  describe('format failure reporting', () => {
    it('reports every malformed URL, list entry and JSON document in one failure', () => {
      let message = '';
      try {
        validateEnvironment({
          NODE_ENV: 'development',
          TRANSFER_SECRET: 'test-transfer-secret',
          REDIS_URL: 'https://wrong-scheme.example',
          LLM_API_URL: 'not-a-url',
          LIVEKIT_RTC_STUN_SERVERS: 'stun.example.org',
          FIREBASE_SERVICE_ACCOUNT: '{broken',
        });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('Invalid environment values:');
      expect(message).toContain('REDIS_URL must use redis: or rediss:');
      expect(message).toContain('LLM_API_URL must be a valid URL');
      expect(message).toContain('LIVEKIT_RTC_STUN_SERVERS entry 1');
      expect(message).toContain(
        'FIREBASE_SERVICE_ACCOUNT must be a JSON object',
      );
    });

    it('still reaches the production missing-variable check first', () => {
      // backend-container-ci.yml boots the production image with only
      // NODE_ENV=production and greps for this message, so it must stay first.
      expect(() =>
        validateEnvironment({
          NODE_ENV: 'production',
          REDIS_URL: 'https://wrong-scheme.example',
          FIREBASE_SERVICE_ACCOUNT: '{broken',
        }),
      ).toThrow('Production environment is missing required variables:');
    });

    it('validates formats in production once the required variables are present', () => {
      expect(() =>
        validateEnvironment({
          ...productionEnvironment(),
          CLOUDFLARE_R2_SOURCE_HOSTS: 'https://recordings.elgl.app',
        }),
      ).toThrow('CLOUDFLARE_R2_SOURCE_HOSTS entry 1');
    });
  });
});
