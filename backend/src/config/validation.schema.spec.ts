import { validationSchema } from './validation.schema';

describe('validationSchema', () => {
  it('applies default values when no environment variables are provided', () => {
    const { error, value } = validationSchema.validate({
      TRANSFER_SECRET: 'test-transfer-secret',
    });
    expect(error).toBeUndefined();

    // Application
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.FRONTEND_URL).toBe('http://localhost:4200');
    expect(value.INTERNAL_API_SECRET).toBe('test-internal-api-secret');
    expect(value.LOG_LEVEL).toBe('info');

    // Supabase
    expect(value.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(value.SUPABASE_ANON_KEY).toBe('test-anon-key');
    expect(value.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key');
    expect(value.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/db');

    // Redis
    expect(value.REDIS_URL).toBe('redis://localhost:6379');

    // Centrifugo
    expect(value.CENTRIFUGO_URL).toBe('http://localhost:8000');
    expect(value.CENTRIFUGO_API_KEY).toBe('test-centrifugo-api-key');
    expect(value.CENTRIFUGO_SECRET).toBe('test-centrifugo-secret');
    expect(value.CENTRIFUGO_CONNECTION_RATE_LIMIT).toBe(5);
    expect(value.CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC).toBe(60);

    // LiveKit
    expect(value.LIVEKIT_URL).toBe('ws://localhost:7880');
    expect(value.LIVEKIT_API_KEY).toBe('test-livekit-api-key');
    expect(value.LIVEKIT_SECRET).toBe('test-livekit-secret');
    expect(value.LIVEKIT_TURN_ENABLED).toBe('false');
    expect(value.LIVEKIT_TURN_DOMAIN).toBe('turn.example.com');
    expect(value.LIVEKIT_TURN_CERT_FILE).toBe('');
    expect(value.LIVEKIT_TURN_KEY_FILE).toBe('');
    expect(value.LIVEKIT_TURN_TLS_PORT).toBe(5349);
    expect(value.LIVEKIT_TURN_UDP_PORT).toBe(3478);
    expect(value.LIVEKIT_TURN_USERNAME).toBe('guest');
    expect(value.LIVEKIT_TURN_PASSWORD).toBe('somepassword');
    expect(value.LIVEKIT_RTC_STUN_SERVERS).toBe(
      'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
    );

    // Cloudflare R2
    expect(value.CLOUDFLARE_R2_ENDPOINT).toBe(
      'https://example.r2.cloudflarestorage.com',
    );
    expect(value.CLOUDFLARE_R2_ACCESS_KEY_ID).toBe('test-r2-access-key-id');
    expect(value.CLOUDFLARE_R2_SECRET_ACCESS_KEY).toBe(
      'test-r2-secret-access-key',
    );
    expect(value.CLOUDFLARE_R2_BUCKET).toBe('test-bucket');
    expect(value.CLOUDFLARE_R2_PUBLIC_DOMAIN).toBe('https://cdn.example.com');
    expect(value.CLOUDFLARE_R2_PUBLIC_URL).toBe('https://cdn.example.com');

    // AI & NLP
    expect(value.DEEPL_API_KEY).toBe('test-deepl-key');
    expect(value.AZURE_TRANSLATOR_KEY).toBe('test-azure-key');
    expect(value.AZURE_TRANSLATOR_REGION).toBe('global');
    expect(value.AZURE_SPEECH_KEY).toBe('test-azure-speech-key');
    expect(value.AZURE_SPEECH_REGION).toBe('westeurope');

    // Stripe
    expect(value.STRIPE_SECRET_KEY).toBe('sk_test_123');
    expect(value.STRIPE_WEBHOOK_SECRET).toBe('whsec_test');
    expect(value.STRIPE_MONTHLY_PRICE_ID).toBe('price_monthly_test');
    expect(value.STRIPE_YEARLY_PRICE_ID).toBe('price_yearly_test');
    expect(value.STRIPE_PRO_MONTHLY_PRICE_ID).toBe('price_pro_monthly_test');
    expect(value.STRIPE_PRO_YEARLY_PRICE_ID).toBe('price_pro_yearly_test');
    expect(value.STRIPE_DEVELOPER_MONTHLY_PRICE_ID).toBe(
      'price_dev_monthly_test',
    );
    expect(value.STRIPE_DEVELOPER_YEARLY_PRICE_ID).toBe(
      'price_dev_yearly_test',
    );

    // Apple
    expect(value.APPLE_BUNDLE_ID).toBe('com.hellotalk.app');
    expect(value.APPLE_SHARED_SECRET).toBe('test-apple-secret');
    expect(value.APPLE_ROOT_CA_CERT_1).toBe('test-apple-ca-cert-1');
    expect(value.APPLE_ROOT_CA_CERT_2).toBe('');
    expect(value.APPLE_VERIFICATION_URL).toBe(
      'https://sandbox.itunes.apple.com/verifyReceipt',
    );

    // Google Play
    expect(value.GOOGLE_PLAY_PACKAGE_NAME).toBe('com.hellotalk.app');
    expect(value.GOOGLE_PLAY_ACCESS_TOKEN).toBe('test-google-play-token');
    expect(value.GOOGLE_PUBSUB_AUDIENCE).toBe(
      'https://pubsub.googleapis.com/test',
    );
    expect(value.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL).toBe('test@example.com');

    // Email
    expect(value.MAIL_PORT).toBe(587);
    expect(value.MAIL_FROM_NAME).toBe('HelloTalk');

    // Versioning
    expect(value.MINIMUM_SUPPORTED_APP_VERSION).toBe('1.0.0');

    // Spam Detection
    expect(value.SPAM_DUPLICATE_THRESHOLD).toBe(3);
    expect(value.SPAM_SIMILARITY_THRESHOLD).toBe(0.75);

    // Transfer
    expect(value.TRANSFER_SECRET).toBe('test-transfer-secret');

    // LLM
    expect(value.LLM_API_KEY).toBe('test-llm-key');
    expect(value.LLM_PROVIDER).toBe('openai');
    expect(value.ANTHROPIC_VERSION).toBe('2023-06-01');
  });

  it('preserves explicitly provided values', () => {
    const env = {
      PORT: '8080',
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://frontend.example.com',
      INTERNAL_API_SECRET: 'custom-internal-secret',
      LOG_LEVEL: 'debug',
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
      LIVEKIT_URL: 'ws://livekit.example.com:7880',
      LIVEKIT_API_KEY: 'livekit-api-key',
      LIVEKIT_SECRET: 'livekit-secret',
      LIVEKIT_TURN_ENABLED: 'true',
      LIVEKIT_TURN_TLS_PORT: '6000',
      LIVEKIT_TURN_UDP_PORT: '4000',
      CLOUDFLARE_R2_ENDPOINT: 'https://r2.example.com',
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2-access',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2-secret',
      CLOUDFLARE_R2_BUCKET: 'my-bucket',
      CLOUDFLARE_R2_PUBLIC_DOMAIN: 'https://cdn.example.com',
      CLOUDFLARE_R2_PUBLIC_URL: 'https://cdn2.example.com',
      DEEPL_API_KEY: 'deepl-key',
      AZURE_TRANSLATOR_KEY: 'azure-key',
      AZURE_TRANSLATOR_REGION: 'westeurope',
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'eastus',
      STRIPE_SECRET_KEY: 'sk_live_custom',
      STRIPE_WEBHOOK_SECRET: 'whsec_custom',
      STRIPE_MONTHLY_PRICE_ID: 'price_monthly_custom',
      STRIPE_YEARLY_PRICE_ID: 'price_yearly_custom',
      STRIPE_PRO_MONTHLY_PRICE_ID: 'price_pro_monthly_custom',
      STRIPE_DEVELOPER_YEARLY_PRICE_ID: 'price_dev_yearly_custom',
      APPLE_BUNDLE_ID: 'com.example.app',
      APPLE_SHARED_SECRET: 'apple-shared-secret',
      APPLE_ROOT_CA_CERT_1: 'apple-ca-1',
      APPLE_ROOT_CA_CERT_2: 'apple-ca-2',
      APPLE_VERIFICATION_URL: 'https://buy.itunes.apple.com/verifyReceipt',
      GOOGLE_PLAY_PACKAGE_NAME: 'com.example.play',
      GOOGLE_PLAY_ACCESS_TOKEN: 'play-token',
      GOOGLE_PUBSUB_AUDIENCE: 'https://pubsub.googleapis.com/custom',
      GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'custom@example.com',
      FIREBASE_SERVICE_ACCOUNT: '{"type":"service_account"}',
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: '465',
      MAIL_USER: 'user@example.com',
      MAIL_PASS: 'password123',
      MAIL_FROM_NAME: 'MyApp',
      MAIL_FROM_ADDRESS: 'noreply@example.com',
      MINIMUM_SUPPORTED_APP_VERSION: '2.0.0',
      GITHUB_REPO: 'org/repo',
      SPAM_DUPLICATE_THRESHOLD: '5',
      SPAM_SIMILARITY_THRESHOLD: '0.85',
      TRANSFER_SECRET: 'my-transfer-secret',
      PRIVACY_EFFECTIVE_DATE: '2024-01-01',
      TOS_EFFECTIVE_DATE: '2024-01-01',
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
    expect(value.FRONTEND_URL).toBe('https://frontend.example.com');
    expect(value.INTERNAL_API_SECRET).toBe('custom-internal-secret');
    expect(value.LOG_LEVEL).toBe('debug');
    expect(value.SUPABASE_URL).toBe('https://supabase.example.com');
    expect(value.AZURE_TRANSLATOR_REGION).toBe('westeurope');
    expect(value.AZURE_SPEECH_KEY).toBe('speech-key');
    expect(value.STRIPE_PRO_MONTHLY_PRICE_ID).toBe('price_pro_monthly_custom');
    expect(value.STRIPE_DEVELOPER_YEARLY_PRICE_ID).toBe(
      'price_dev_yearly_custom',
    );
    expect(value.APPLE_BUNDLE_ID).toBe('com.example.app');
    expect(value.FIREBASE_SERVICE_ACCOUNT).toBe('{"type":"service_account"}');
    expect(value.MAIL_HOST).toBe('smtp.example.com');
    expect(value.MAIL_PORT).toBe(465);
    expect(value.MAIL_FROM_NAME).toBe('MyApp');
    expect(value.MINIMUM_SUPPORTED_APP_VERSION).toBe('2.0.0');
    expect(value.SPAM_DUPLICATE_THRESHOLD).toBe(5);
    expect(value.SPAM_SIMILARITY_THRESHOLD).toBe(0.85);
    expect(value.TRANSFER_SECRET).toBe('my-transfer-secret');
    expect(value.LLM_PROVIDER).toBe('anthropic');
    expect(value.LLM_BASE_URL).toBe('https://api.anthropic.com');
    expect(value.LLM_MODEL).toBe('claude-3-opus-20240229');
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

  it('rejects an invalid LOG_LEVEL value', () => {
    const result = validationSchema.validate({ LOG_LEVEL: 'verbose' });
    expect(result.error).toBeDefined();
  });

  it('rejects a malformed LIVEKIT_URL with bad scheme', () => {
    const result = validationSchema.validate({
      LIVEKIT_URL: 'ftp://livekit.example.com',
    });
    expect(result.error).toBeDefined();
  });

  it('rejects an invalid LLM_PROVIDER value', () => {
    const result = validationSchema.validate({ LLM_PROVIDER: 'cohere' });
    expect(result.error).toBeDefined();
  });

  it('allows unknown keys because of unknown(true)', () => {
    const result = validationSchema.validate({
      TRANSFER_SECRET: 'test-transfer-secret',
      UNEXPECTED_KEY: 'anything',
    });
    expect(result.error).toBeUndefined();
  });

  it('accepts optional fields that are present', () => {
    const result = validationSchema.validate({
      TRANSFER_SECRET: 'test-transfer-secret',
      APPLE_ROOT_CA_CERT_2: '',
      GOOGLE_PLAY_PACKAGE_NAME: 'com.example.play',
      GOOGLE_PLAY_ACCESS_TOKEN: 'token',
      CLOUDFLARE_API_TOKEN: '',
      CLOUDFLARE_ZONE_ID: '',
      FIREBASE_SERVICE_ACCOUNT: '',
      MAIL_HOST: '',
      MAIL_USER: '',
      MAIL_PASS: '',
      MAIL_FROM_ADDRESS: '',
      GITHUB_REPO: '',
      PRIVACY_EFFECTIVE_DATE: '',
      TOS_EFFECTIVE_DATE: '',
      APP_URL: 'https://api.example.com',
    });
    expect(result.error).toBeUndefined();
  });

  it('coerces numeric string values to numbers where appropriate', () => {
    const result = validationSchema.validate({
      TRANSFER_SECRET: 'test-transfer-secret',
      MAIL_PORT: '465',
      SPAM_DUPLICATE_THRESHOLD: '5',
      SPAM_SIMILARITY_THRESHOLD: '0.85',
      LIVEKIT_TURN_TLS_PORT: '6000',
      LIVEKIT_TURN_UDP_PORT: '4000',
    });
    expect(result.error).toBeUndefined();
    expect(result.value.MAIL_PORT).toBe(465);
    expect(result.value.SPAM_DUPLICATE_THRESHOLD).toBe(5);
    expect(result.value.SPAM_SIMILARITY_THRESHOLD).toBe(0.85);
    expect(result.value.LIVEKIT_TURN_TLS_PORT).toBe(6000);
    expect(result.value.LIVEKIT_TURN_UDP_PORT).toBe(4000);
  });
});
