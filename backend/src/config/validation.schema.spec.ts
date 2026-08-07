import { validationSchema } from './validation.schema';

describe('validationSchema', () => {
  it('applies default values when no environment variables are provided', () => {
    const { error, value } = validationSchema.validate({});
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(value.SUPABASE_ANON_KEY).toBe('test-anon-key');
    expect(value.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key');
    expect(value.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/db');
    expect(value.REDIS_URL).toBe('redis://localhost:6379');
    expect(value.CENTRIFUGO_URL).toBe('http://localhost:8000');
    expect(value.CENTRIFUGO_API_KEY).toBe('test-centrifugo-api-key');
    expect(value.CENTRIFUGO_SECRET).toBe('test-centrifugo-secret');
    expect(value.CENTRIFUGO_CONNECTION_RATE_LIMIT).toBe(5);
    expect(value.CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC).toBe(60);
    expect(value.LIVEKIT_URL).toBe('http://localhost:7880');
    expect(value.LIVEKIT_API_KEY).toBe('test-livekit-api-key');
    expect(value.LIVEKIT_SECRET).toBe('test-livekit-secret');
    expect(value.LIVEKIT_TURN_ENABLED).toBe('false');
    expect(value.LIVEKIT_TURN_DOMAIN).toBe('turn.example.com');
    expect(value.LIVEKIT_TURN_CERT_FILE).toBe('');
    expect(value.LIVEKIT_TURN_KEY_FILE).toBe('');
    expect(value.LIVEKIT_TURN_TLS_PORT).toBe('5349');
    expect(value.LIVEKIT_TURN_UDP_PORT).toBe('3478');
    expect(value.LIVEKIT_RTC_STUN_SERVERS).toBe(
      'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
    );
    expect(value.CLOUDFLARE_R2_ENDPOINT).toBe(
      'https://example.r2.cloudflarestorage.com',
    );
    expect(value.CLOUDFLARE_R2_ACCESS_KEY_ID).toBe('test-r2-access-key-id');
    expect(value.CLOUDFLARE_R2_SECRET_ACCESS_KEY).toBe(
      'test-r2-secret-access-key',
    );
    expect(value.CLOUDFLARE_R2_BUCKET).toBe('test-bucket');
    expect(value.CLOUDFLARE_R2_PUBLIC_DOMAIN).toBe('https://example.com');
    expect(value.DEEPL_API_KEY).toBe('test-deepl-key');
    expect(value.AZURE_TRANSLATOR_KEY).toBe('test-azure-key');
    expect(value.STRIPE_SECRET_KEY).toBe('sk_test_123');
    expect(value.STRIPE_WEBHOOK_SECRET).toBe('whsec_test');
    expect(value.STRIPE_MONTHLY_PRICE_ID).toBe('price_monthly_test');
    expect(value.STRIPE_YEARLY_PRICE_ID).toBe('price_yearly_test');
    expect(value.APPLE_SHARED_SECRET).toBe('test-apple-secret');
    expect(value.APPLE_ROOT_CA_CERT_1).toBe('test-apple-ca-cert-1');
    expect(value.GOOGLE_PUBSUB_AUDIENCE).toBe(
      'https://pubsub.googleapis.com/test',
    );
    expect(value.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL).toBe('test@example.com');
    expect(value.LLM_API_KEY).toBe('test-llm-key');
    expect(value.LLM_PROVIDER).toBe('openai');
  });

  it('preserves explicitly provided values', () => {
    const env = {
      PORT: '8080',
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://supabase.example.com',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      DATABASE_URL: 'postgres://custom-host:5432/db',
      REDIS_URL: 'redis://custom-redis:6379',
      CENTRIFUGO_URL: 'http://centrifugo.example.com',
      CENTRIFUGO_API_KEY: 'cent-api-key',
      CENTRIFUGO_SECRET: 'cent-secret',
      CENTRIFUGO_CONNECTION_RATE_LIMIT: '10',
      CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC: '120',
      LIVEKIT_URL: 'http://livekit.example.com',
      LIVEKIT_API_KEY: 'livekit-api-key',
      LIVEKIT_SECRET: 'livekit-secret',
      CLOUDFLARE_R2_ENDPOINT: 'https://r2.example.com',
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2-access',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2-secret',
      CLOUDFLARE_R2_BUCKET: 'my-bucket',
      CLOUDFLARE_R2_PUBLIC_DOMAIN: 'https://cdn.example.com',
      DEEPL_API_KEY: 'deepl-key',
      AZURE_TRANSLATOR_KEY: 'azure-key',
      AZURE_TRANSLATOR_REGION: 'westeurope',
      STRIPE_SECRET_KEY: 'sk_live_custom',
      STRIPE_WEBHOOK_SECRET: 'whsec_custom',
      STRIPE_MONTHLY_PRICE_ID: 'price_monthly_custom',
      STRIPE_YEARLY_PRICE_ID: 'price_yearly_custom',
      FRONTEND_URL: 'https://frontend.example.com',
      APPLE_BUNDLE_ID: 'com.example.app',
      APPLE_SHARED_SECRET: 'apple-shared-secret',
      APPLE_ROOT_CA_CERT_1: 'apple-ca-1',
      APPLE_ROOT_CA_CERT_2: 'apple-ca-2',
      APPLE_VERIFICATION_URL: 'https://buy.itunes.apple.com/verifyReceipt',
      GOOGLE_PLAY_PACKAGE_NAME: 'com.example.play',
      GOOGLE_PLAY_ACCESS_TOKEN: 'play-token',
      GOOGLE_PUBSUB_AUDIENCE: 'https://pubsub.googleapis.com/custom',
      GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'custom@example.com',
      LLM_PROVIDER: 'anthropic',
      LLM_API_KEY: 'anthropic-key',
      LLM_BASE_URL: 'https://api.anthropic.com',
      LLM_MODEL: 'claude-3-opus-20240229',
      ANTHROPIC_VERSION: '2023-06-01',
    };

    const { error, value } = validationSchema.validate(env);
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(8080);
    expect(value.NODE_ENV).toBe('production');
    expect(value.SUPABASE_URL).toBe('https://supabase.example.com');
    expect(value.AZURE_TRANSLATOR_REGION).toBe('westeurope');
    expect(value.LLM_PROVIDER).toBe('anthropic');
    expect(value.LLM_BASE_URL).toBe('https://api.anthropic.com');
  });

  it('rejects an invalid NODE_ENV value', () => {
    const result = validationSchema.validate({ NODE_ENV: 'staging' });
    expect(result.error).toBeDefined();
  });

  it('rejects a non-numeric PORT value', () => {
    const result = validationSchema.validate({ PORT: 'not-a-number' });
    expect(result.error).toBeDefined();
  });

  it('rejects a non-URI SUPABASE_URL value', () => {
    const result = validationSchema.validate({ SUPABASE_URL: 'not-a-url' });
    expect(result.error).toBeDefined();
  });

  it('allows unknown keys because of unknown(true)', () => {
    const result = validationSchema.validate({ UNEXPECTED_KEY: 'anything' });
    expect(result.error).toBeUndefined();
  });

  it('accepts optional fields that are present', () => {
    const result = validationSchema.validate({
      APPLE_ROOT_CA_CERT_2: '',
      GOOGLE_PLAY_PACKAGE_NAME: 'com.example.play',
      GOOGLE_PLAY_ACCESS_TOKEN: 'token',
    });
    expect(result.error).toBeUndefined();
  });
});
