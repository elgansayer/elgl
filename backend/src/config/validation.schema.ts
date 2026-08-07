import * as Joi from 'joi';

const testDefaults: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  CENTRIFUGO_URL: 'http://localhost:8000',
  CENTRIFUGO_API_KEY: 'test-centrifugo-api-key',
  CENTRIFUGO_SECRET: 'test-centrifugo-secret',
  LIVEKIT_URL: 'http://localhost:7880',
  LIVEKIT_API_KEY: 'test-livekit-api-key',
  LIVEKIT_SECRET: 'test-livekit-secret',
  LIVEKIT_TURN_ENABLED: 'false',
  LIVEKIT_TURN_DOMAIN: 'turn.example.com',
  LIVEKIT_TURN_CERT_FILE: '',
  LIVEKIT_TURN_KEY_FILE: '',
  LIVEKIT_TURN_TLS_PORT: '5349',
  LIVEKIT_TURN_UDP_PORT: '3478',
  LIVEKIT_RTC_STUN_SERVERS: 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
  CLOUDFLARE_R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-r2-access-key-id',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-r2-secret-access-key',
  CLOUDFLARE_R2_BUCKET: 'test-bucket',
  CLOUDFLARE_R2_PUBLIC_DOMAIN: 'https://example.com',
  DEEPL_API_KEY: 'test-deepl-key',
  AZURE_TRANSLATOR_KEY: 'test-azure-key',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_MONTHLY_PRICE_ID: 'price_monthly_test',
  STRIPE_YEARLY_PRICE_ID: 'price_yearly_test',
  APPLE_SHARED_SECRET: 'test-apple-secret',
  APPLE_ROOT_CA_CERT_1: 'test-apple-ca-cert-1',
  GOOGLE_PUBSUB_AUDIENCE: 'https://pubsub.googleapis.com/test',
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
  LLM_API_KEY: 'test-llm-key',
};

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  SUPABASE_URL: Joi.string().uri().default(testDefaults.SUPABASE_URL),
  SUPABASE_ANON_KEY: Joi.string().default(testDefaults.SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().default(
    testDefaults.SUPABASE_SERVICE_ROLE_KEY,
  ),
  DATABASE_URL: Joi.string().default(testDefaults.DATABASE_URL),
  REDIS_URL: Joi.string().default(testDefaults.REDIS_URL),
  CENTRIFUGO_URL: Joi.string().uri().default(testDefaults.CENTRIFUGO_URL),
  CENTRIFUGO_API_KEY: Joi.string().default(testDefaults.CENTRIFUGO_API_KEY),
  CENTRIFUGO_SECRET: Joi.string().default(testDefaults.CENTRIFUGO_SECRET),
  CENTRIFUGO_CONNECTION_RATE_LIMIT: Joi.number().integer().min(1).default(5),
  CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC: Joi.number()
    .integer()
    .min(1)
    .default(60),
  LIVEKIT_URL: Joi.string().default(testDefaults.LIVEKIT_URL),
  LIVEKIT_API_KEY: Joi.string().default(testDefaults.LIVEKIT_API_KEY),
  LIVEKIT_SECRET: Joi.string().default(testDefaults.LIVEKIT_SECRET),
  LIVEKIT_TURN_ENABLED: Joi.string()
    .valid('true', 'false')
    .default(testDefaults.LIVEKIT_TURN_ENABLED),
  LIVEKIT_TURN_DOMAIN: Joi.string().default(testDefaults.LIVEKIT_TURN_DOMAIN),
  LIVEKIT_TURN_CERT_FILE: Joi.string()
    .allow('')
    .default(testDefaults.LIVEKIT_TURN_CERT_FILE),
  LIVEKIT_TURN_KEY_FILE: Joi.string()
    .allow('')
    .default(testDefaults.LIVEKIT_TURN_KEY_FILE),
  LIVEKIT_TURN_TLS_PORT: Joi.string().default(testDefaults.LIVEKIT_TURN_TLS_PORT),
  LIVEKIT_TURN_UDP_PORT: Joi.string().default(testDefaults.LIVEKIT_TURN_UDP_PORT),
  LIVEKIT_RTC_STUN_SERVERS: Joi.string().default(
    testDefaults.LIVEKIT_RTC_STUN_SERVERS,
  ),
  CLOUDFLARE_R2_ENDPOINT: Joi.string()
    .uri()
    .default(testDefaults.CLOUDFLARE_R2_ENDPOINT),
  CLOUDFLARE_R2_ACCESS_KEY_ID: Joi.string().default(
    testDefaults.CLOUDFLARE_R2_ACCESS_KEY_ID,
  ),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: Joi.string().default(
    testDefaults.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  ),
  CLOUDFLARE_R2_BUCKET: Joi.string().default(testDefaults.CLOUDFLARE_R2_BUCKET),
  CLOUDFLARE_R2_PUBLIC_DOMAIN: Joi.string()
    .uri()
    .default(testDefaults.CLOUDFLARE_R2_PUBLIC_DOMAIN),
  DEEPL_API_KEY: Joi.string().default(testDefaults.DEEPL_API_KEY),
  AZURE_TRANSLATOR_KEY: Joi.string().default(testDefaults.AZURE_TRANSLATOR_KEY),
  AZURE_TRANSLATOR_REGION: Joi.string().default('global'),
  STRIPE_SECRET_KEY: Joi.string().default(testDefaults.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: Joi.string().default(
    testDefaults.STRIPE_WEBHOOK_SECRET,
  ),
  STRIPE_MONTHLY_PRICE_ID: Joi.string().default(
    testDefaults.STRIPE_MONTHLY_PRICE_ID,
  ),
  STRIPE_YEARLY_PRICE_ID: Joi.string().default(
    testDefaults.STRIPE_YEARLY_PRICE_ID,
  ),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:4200'),
  APPLE_BUNDLE_ID: Joi.string().default('com.hellotalk.app'),
  APPLE_SHARED_SECRET: Joi.string().default(testDefaults.APPLE_SHARED_SECRET),
  APPLE_ROOT_CA_CERT_1: Joi.string().default(testDefaults.APPLE_ROOT_CA_CERT_1),
  APPLE_ROOT_CA_CERT_2: Joi.string().optional().allow(''),
  APPLE_VERIFICATION_URL: Joi.string()
    .uri()
    .default('https://sandbox.itunes.apple.com/verifyReceipt'),
  GOOGLE_PLAY_PACKAGE_NAME: Joi.string().optional(),
  GOOGLE_PLAY_ACCESS_TOKEN: Joi.string().optional(),
  // Identity of the Cloud Pub/Sub push subscription that delivers Google Play
  // RTDN webhooks, used to verify the OIDC bearer token Google attaches to
  // every push request (see GooglePlayNotificationService#verifyPubSubAuthorization).
  GOOGLE_PUBSUB_AUDIENCE: Joi.string()
    .uri()
    .default(testDefaults.GOOGLE_PUBSUB_AUDIENCE),
  // tlds disabled: this is matched as a literal string against an OIDC claim
  // (see GooglePlayNotificationService#verifyPubSubAuthorization), never used
  // for delivery, so rely on basic email syntax only.
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: Joi.string()
    .allow('')
    .default(testDefaults.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL),

  LLM_PROVIDER: Joi.string()
    .valid('openai', 'anthropic', 'google', 'local')
    .default('openai'),
  LLM_API_KEY: Joi.string().default(testDefaults.LLM_API_KEY),
  LLM_BASE_URL: Joi.string().uri().optional(),
  LLM_MODEL: Joi.string().optional(),
  ANTHROPIC_VERSION: Joi.string().default('2023-06-01'),
}).unknown(true);
