import * as Joi from 'joi';

const uriOpt = { scheme: ['http', 'https', 'ws', 'wss'] };

const testDefaults: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  CENTRIFUGO_URL: 'http://localhost:8000',
  CENTRIFUGO_API_KEY: 'test-centrifugo-api-key',
  CENTRIFUGO_SECRET: 'test-centrifugo-secret',
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'test-livekit-api-key',
  LIVEKIT_SECRET: 'test-livekit-secret',
  LIVEKIT_TURN_ENABLED: 'false',
  LIVEKIT_TURN_DOMAIN: 'turn.example.com',
  LIVEKIT_TURN_CERT_FILE: '',
  LIVEKIT_TURN_KEY_FILE: '',
  LIVEKIT_TURN_TLS_PORT: '5349',
  LIVEKIT_TURN_UDP_PORT: '3478',
  LIVEKIT_TURN_USERNAME: 'guest',
  LIVEKIT_TURN_PASSWORD: 'somepassword',
  LIVEKIT_RTC_STUN_SERVERS:
    'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
  CLOUDFLARE_R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-r2-access-key-id',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-r2-secret-access-key',
  CLOUDFLARE_R2_BUCKET: 'test-bucket',
  CLOUDFLARE_R2_PUBLIC_DOMAIN: 'https://cdn.example.com',
  CLOUDFLARE_R2_PUBLIC_URL: 'https://cdn.example.com',
  DEEPL_API_KEY: 'test-deepl-key',
  AZURE_TRANSLATOR_KEY: 'test-azure-key',
  AZURE_TRANSLATOR_REGION: 'global',
  AZURE_SPEECH_KEY: 'test-azure-speech-key',
  AZURE_SPEECH_REGION: 'westeurope',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_MONTHLY_PRICE_ID: 'price_monthly_test',
  STRIPE_YEARLY_PRICE_ID: 'price_yearly_test',
  STRIPE_PRO_MONTHLY_PRICE_ID: 'price_pro_monthly_test',
  STRIPE_PRO_YEARLY_PRICE_ID: 'price_pro_yearly_test',
  STRIPE_DEVELOPER_MONTHLY_PRICE_ID: 'price_dev_monthly_test',
  STRIPE_DEVELOPER_YEARLY_PRICE_ID: 'price_dev_yearly_test',
  APPLE_BUNDLE_ID: 'com.hellotalk.app',
  APPLE_SHARED_SECRET: 'test-apple-secret',
  APPLE_ROOT_CA_CERT_1: 'test-apple-ca-cert-1',
  APPLE_ROOT_CA_CERT_2: '',
  APPLE_VERIFICATION_URL: 'https://sandbox.itunes.apple.com/verifyReceipt',
  GOOGLE_PLAY_PACKAGE_NAME: 'com.hellotalk.app',
  GOOGLE_PLAY_ACCESS_TOKEN: 'test-google-play-token',
  GOOGLE_PUBSUB_AUDIENCE: 'https://pubsub.googleapis.com/test',
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
  INTERNAL_API_SECRET: 'test-internal-api-secret',
  FRONTEND_URL: 'http://localhost:4200',
  LLM_API_KEY: 'test-llm-key',
  TRANSFER_SECRET: 'test-transfer-secret',
};

export const validationSchema = Joi.object({
  // -- Application --
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  FRONTEND_URL: Joi.string().uri().default(testDefaults.FRONTEND_URL),
  APP_URL: Joi.string().uri().optional(),
  INTERNAL_API_SECRET: Joi.string().default(testDefaults.INTERNAL_API_SECRET),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),

  // -- Supabase (PostgreSQL + Auth) --
  SUPABASE_URL: Joi.string().uri().default(testDefaults.SUPABASE_URL),
  SUPABASE_ANON_KEY: Joi.string().default(testDefaults.SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().default(
    testDefaults.SUPABASE_SERVICE_ROLE_KEY,
  ),
  DATABASE_URL: Joi.string().default(testDefaults.DATABASE_URL),

  // -- Redis --
  REDIS_URL: Joi.string().default(testDefaults.REDIS_URL),

  // -- Centrifugo (Real-Time Messaging) --
  CENTRIFUGO_URL: Joi.string().uri().default(testDefaults.CENTRIFUGO_URL),
  CENTRIFUGO_API_KEY: Joi.string().default(testDefaults.CENTRIFUGO_API_KEY),
  CENTRIFUGO_SECRET: Joi.string().default(testDefaults.CENTRIFUGO_SECRET),
  CENTRIFUGO_CONNECTION_RATE_LIMIT: Joi.number().integer().min(1).default(5),
  CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC: Joi.number()
    .integer()
    .min(1)
    .default(60),

  // -- LiveKit (WebRTC Audio/Video) --
  LIVEKIT_URL: Joi.string().uri(uriOpt).default(testDefaults.LIVEKIT_URL),
  LIVEKIT_API_KEY: Joi.string().default(testDefaults.LIVEKIT_API_KEY),
  LIVEKIT_SECRET: Joi.string().default(testDefaults.LIVEKIT_SECRET),
  LIVEKIT_TURN_ENABLED: Joi.string()
    .valid('true', 'false')
    .default(testDefaults.LIVEKIT_TURN_ENABLED),
  LIVEKIT_TURN_DOMAIN: Joi.string()
    .allow('')
    .default(testDefaults.LIVEKIT_TURN_DOMAIN),
  LIVEKIT_TURN_CERT_FILE: Joi.string()
    .allow('')
    .default(testDefaults.LIVEKIT_TURN_CERT_FILE),
  LIVEKIT_TURN_KEY_FILE: Joi.string()
    .allow('')
    .default(testDefaults.LIVEKIT_TURN_KEY_FILE),
  LIVEKIT_TURN_TLS_PORT: Joi.number().default(5349),
  LIVEKIT_TURN_UDP_PORT: Joi.number().default(3478),
  LIVEKIT_TURN_USERNAME: Joi.string().default(
    testDefaults.LIVEKIT_TURN_USERNAME,
  ),
  LIVEKIT_TURN_PASSWORD: Joi.string().default(
    testDefaults.LIVEKIT_TURN_PASSWORD,
  ),
  LIVEKIT_RTC_STUN_SERVERS: Joi.string().default(
    testDefaults.LIVEKIT_RTC_STUN_SERVERS,
  ),

  // -- Cloudflare R2 (Media Storage) --
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
  CLOUDFLARE_R2_PUBLIC_URL: Joi.string()
    .uri()
    .default(testDefaults.CLOUDFLARE_R2_PUBLIC_URL),
  CLOUDFLARE_API_TOKEN: Joi.string().optional().allow(''),
  CLOUDFLARE_ZONE_ID: Joi.string().optional().allow(''),

  // -- AI & NLP --
  DEEPL_API_KEY: Joi.string().default(testDefaults.DEEPL_API_KEY),
  AZURE_TRANSLATOR_KEY: Joi.string().default(testDefaults.AZURE_TRANSLATOR_KEY),
  AZURE_TRANSLATOR_REGION: Joi.string().default(
    testDefaults.AZURE_TRANSLATOR_REGION,
  ),
  AZURE_SPEECH_KEY: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.AZURE_SPEECH_KEY),
  AZURE_SPEECH_REGION: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.AZURE_SPEECH_REGION),

  // -- Stripe (Payments) --
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
  STRIPE_PRO_MONTHLY_PRICE_ID: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.STRIPE_PRO_MONTHLY_PRICE_ID),
  STRIPE_PRO_YEARLY_PRICE_ID: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.STRIPE_PRO_YEARLY_PRICE_ID),
  STRIPE_DEVELOPER_MONTHLY_PRICE_ID: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.STRIPE_DEVELOPER_MONTHLY_PRICE_ID),
  STRIPE_DEVELOPER_YEARLY_PRICE_ID: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.STRIPE_DEVELOPER_YEARLY_PRICE_ID),

  // -- Apple App Store (IAP + Server Notifications) --
  APPLE_BUNDLE_ID: Joi.string().default(testDefaults.APPLE_BUNDLE_ID),
  APPLE_SHARED_SECRET: Joi.string().default(testDefaults.APPLE_SHARED_SECRET),
  APPLE_ROOT_CA_CERT_1: Joi.string().default(testDefaults.APPLE_ROOT_CA_CERT_1),
  APPLE_ROOT_CA_CERT_2: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.APPLE_ROOT_CA_CERT_2),
  APPLE_VERIFICATION_URL: Joi.string()
    .uri()
    .default(testDefaults.APPLE_VERIFICATION_URL),

  // -- Google Play (IAP + RTDN Webhooks) --
  GOOGLE_PLAY_PACKAGE_NAME: Joi.string().default(
    testDefaults.GOOGLE_PLAY_PACKAGE_NAME,
  ),
  GOOGLE_PLAY_ACCESS_TOKEN: Joi.string()
    .optional()
    .allow('')
    .default(testDefaults.GOOGLE_PLAY_ACCESS_TOKEN),
  GOOGLE_PUBSUB_AUDIENCE: Joi.string()
    .uri()
    .default(testDefaults.GOOGLE_PUBSUB_AUDIENCE),
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: Joi.string()
    .allow('')
    .default(testDefaults.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL),

  // -- Firebase (Push Notifications + Google Play Auth) --
  FIREBASE_SERVICE_ACCOUNT: Joi.string().optional().allow(''),

  // -- Email (password reset, notifications, etc.) --
  MAIL_HOST: Joi.string().optional().allow(''),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().optional().allow(''),
  MAIL_PASS: Joi.string().optional().allow(''),
  MAIL_FROM_NAME: Joi.string().default('HelloTalk'),
  MAIL_FROM_ADDRESS: Joi.string().optional().allow(''),

  // -- Versioning --
  MINIMUM_SUPPORTED_APP_VERSION: Joi.string().default('1.0.0'),
  GITHUB_REPO: Joi.string().optional().allow(''),

  // -- Spam Detection --
  SPAM_DUPLICATE_THRESHOLD: Joi.number().default(3),
  SPAM_SIMILARITY_THRESHOLD: Joi.number().default(0.75),

  // -- Transfer --
  TRANSFER_SECRET: Joi.string().required(),

  // -- Privacy & Legal --
  PRIVACY_EFFECTIVE_DATE: Joi.string().optional().allow(''),
  TOS_EFFECTIVE_DATE: Joi.string().optional().allow(''),

  // -- LLM --
  LLM_PROVIDER: Joi.string()
    .valid('openai', 'anthropic', 'google', 'local')
    .default('openai'),
  LLM_API_KEY: Joi.string().default(testDefaults.LLM_API_KEY),
  LLM_BASE_URL: Joi.string().uri().optional().allow(''),
  LLM_MODEL: Joi.string().optional(),
  ANTHROPIC_VERSION: Joi.string().default('2023-06-01'),
  MESSAGE_EDIT_WINDOW_MINUTES: Joi.number().integer().min(1).default(5),
}).unknown(true);
