/**
 * Environment every end-to-end suite needs before `AppModule` is imported.
 *
 * The values are inert test credentials. Call this in `beforeAll`, before the
 * dynamic `import('./../src/app.module')`, so configuration is read from them.
 */
export const E2E_CENTRIFUGO_SECRET = 'test-centrifugo-secret';

export function applyE2eEnvironment(): void {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://hellotalk.test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    CENTRIFUGO_URL: 'http://localhost:8000',
    CENTRIFUGO_API_KEY: 'test-centrifugo-api-key',
    CENTRIFUGO_SECRET: E2E_CENTRIFUGO_SECRET,
    LIVEKIT_URL: 'ws://localhost:7880',
    LIVEKIT_API_KEY: 'test-livekit-key',
    LIVEKIT_SECRET: 'test-livekit-secret',
    CLOUDFLARE_R2_ENDPOINT: 'https://test-r2.example.com',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-r2-access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-r2-secret',
    CLOUDFLARE_R2_BUCKET: 'test-bucket',
    CLOUDFLARE_R2_PUBLIC_DOMAIN: 'https://example.com',
    DEEPL_API_KEY: 'test-deepl-key',
    AZURE_TRANSLATOR_KEY: 'test-azure-key',
    STRIPE_SECRET_KEY: 'test-stripe-key',
    STRIPE_WEBHOOK_SECRET: 'test-stripe-webhook-secret',
    STRIPE_MONTHLY_PRICE_ID: 'price_monthly_test',
    STRIPE_YEARLY_PRICE_ID: 'price_yearly_test',
    JWT_SECRET: 'test-jwt-secret',
    TRANSFER_SECRET: 'test-transfer-secret',
    NODE_ENV: 'test',
    APPLE_SHARED_SECRET: 'test-apple-secret',
    APPLE_ROOT_CA_CERT_1: 'test-apple-ca-cert-1',
    GOOGLE_PUBSUB_AUDIENCE: 'https://pubsub.googleapis.com/test',
    GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
    LLM_API_KEY: 'test-llm-key',
  });
}
