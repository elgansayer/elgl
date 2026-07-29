import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  CENTRIFUGO_URL: Joi.string().uri().required(),
  CENTRIFUGO_API_KEY: Joi.string().required(),
  CENTRIFUGO_SECRET: Joi.string().required(),
  LIVEKIT_URL: Joi.string().required(),
  LIVEKIT_API_KEY: Joi.string().required(),
  LIVEKIT_SECRET: Joi.string().required(),
  CLOUDFLARE_R2_ENDPOINT: Joi.string().uri().required(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: Joi.string().required(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: Joi.string().required(),
  CLOUDFLARE_R2_BUCKET: Joi.string().required(),
  CLOUDFLARE_R2_PUBLIC_DOMAIN: Joi.string().uri().required(),
  DEEPL_API_KEY: Joi.string().required(),
  AZURE_TRANSLATOR_KEY: Joi.string().required(),
  AZURE_TRANSLATOR_REGION: Joi.string().default('global'),
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  STRIPE_MONTHLY_PRICE_ID: Joi.string().optional(),
  STRIPE_YEARLY_PRICE_ID: Joi.string().optional(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:4200'),
  APPLE_BUNDLE_ID: Joi.string().default('com.hellotalk.app'),
  APPLE_SHARED_SECRET: Joi.string().required(),
  APPLE_ROOT_CA_CERT_1: Joi.string().required(),
  APPLE_ROOT_CA_CERT_2: Joi.string().optional().allow(''),
  APPLE_VERIFICATION_URL: Joi.string()
    .uri()
    .default('https://sandbox.itunes.apple.com/verifyReceipt'),
  GOOGLE_PLAY_PACKAGE_NAME: Joi.string().optional(),
  GOOGLE_PLAY_ACCESS_TOKEN: Joi.string().optional(),
  // Identity of the Cloud Pub/Sub push subscription that delivers Google Play
  // RTDN webhooks, used to verify the OIDC bearer token Google attaches to
  // every push request (see GooglePlayNotificationService#verifyPubSubAuthorization).
  GOOGLE_PUBSUB_AUDIENCE: Joi.string().uri().required(),
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: Joi.string().email().required(),
});
