import { validationSchema } from './validation.schema';

describe('validationSchema', () => {
  it('applies safe development defaults', () => {
    const { error, value } = validationSchema.validate({
      TRANSFER_SECRET: 'test-transfer-secret',
    });

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.FRONTEND_URL).toBe('http://localhost:4200');
    expect(value.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(value.REDIS_URL).toBe('redis://localhost:6379');
    expect(value.CENTRIFUGO_URL).toBe('http://localhost:8000');
    expect(value.LIVEKIT_URL).toBe('ws://localhost:7880');

    expect(value.CLOUDFLARE_R2_GATEWAY_URL).toBe('http://localhost:8787');
    expect(value.CLOUDFLARE_R2_SIGNING_SECRET).toBe(
      'test-r2-signing-secret-with-at-least-32-characters',
    );
    expect(value.CLOUDFLARE_R2_SERVICE_TOKEN).toBe(
      'test-r2-service-token-with-at-least-32-characters',
    );
    expect(value.CLOUDFLARE_R2_PUBLIC_URL).toBe('https://cdn.example.com');
    expect(value.CLOUDFLARE_R2_SOURCE_HOSTS).toBe(
      'recordings.example.com',
    );
    expect(value.CLOUDFLARE_R2_UPLOAD_TTL_SECONDS).toBe(3600);
    expect(value.CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES).toBe(26214400);
    expect(value.CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES).toBe(104857600);
    expect(value.CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS).toBe(30000);

    expect(value.CLOUDFLARE_R2_ENDPOINT).toBe(
      'https://example.r2.cloudflarestorage.com',
    );
    expect(value.CLOUDFLARE_R2_ACCESS_KEY_ID).toBe(
      'test-r2-egress-access-key-id',
    );
    expect(value.CLOUDFLARE_R2_BUCKET).toBe('test-egress-bucket');
    expect(value.TRANSFER_SECRET).toBe('test-transfer-secret');
  });

  it('preserves explicitly provided gateway limits and URLs', () => {
    const env = {
      TRANSFER_SECRET: 'my-transfer-secret',
      CLOUDFLARE_R2_GATEWAY_URL: 'https://r2-gateway.example.com',
      CLOUDFLARE_R2_SIGNING_SECRET:
        'custom-signing-secret-with-at-least-32-characters',
      CLOUDFLARE_R2_SERVICE_TOKEN:
        'custom-service-token-with-at-least-32-characters',
      CLOUDFLARE_R2_PUBLIC_URL: 'https://media.example.com',
      CLOUDFLARE_R2_SOURCE_HOSTS:
        'recordings.example.com,*.livekit.example.com',
      CLOUDFLARE_R2_UPLOAD_TTL_SECONDS: '900',
      CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES: '1024',
      CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES: '2048',
      CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS: '5000',
    };

    const { error, value } = validationSchema.validate(env);

    expect(error).toBeUndefined();
    expect(value.CLOUDFLARE_R2_GATEWAY_URL).toBe(
      'https://r2-gateway.example.com',
    );
    expect(value.CLOUDFLARE_R2_SOURCE_HOSTS).toBe(
      'recordings.example.com,*.livekit.example.com',
    );
    expect(value.CLOUDFLARE_R2_UPLOAD_TTL_SECONDS).toBe(900);
    expect(value.CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES).toBe(1024);
    expect(value.CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES).toBe(2048);
    expect(value.CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS).toBe(5000);
  });

  it('rejects weak gateway secrets and invalid limits', () => {
    expect(
      validationSchema.validate({
        TRANSFER_SECRET: 'test-transfer-secret',
        CLOUDFLARE_R2_SIGNING_SECRET: 'short',
      }).error,
    ).toBeDefined();
    expect(
      validationSchema.validate({
        TRANSFER_SECRET: 'test-transfer-secret',
        CLOUDFLARE_R2_UPLOAD_TTL_SECONDS: '30',
      }).error,
    ).toBeDefined();
    expect(
      validationSchema.validate({
        TRANSFER_SECRET: 'test-transfer-secret',
        CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES: '0',
      }).error,
    ).toBeDefined();
  });

  it('continues to validate core environment and numeric coercion', () => {
    const result = validationSchema.validate({
      TRANSFER_SECRET: 'test-transfer-secret',
      NODE_ENV: 'production',
      PORT: '8080',
      MAIL_PORT: '465',
      LIVEKIT_TURN_TLS_PORT: '6000',
      UNEXPECTED_KEY: 'allowed-by-forward-compatible-schema',
    });

    expect(result.error).toBeUndefined();
    expect(result.value.PORT).toBe(8080);
    expect(result.value.MAIL_PORT).toBe(465);
    expect(result.value.LIVEKIT_TURN_TLS_PORT).toBe(6000);
    expect(
      validationSchema.validate({ NODE_ENV: 'staging' }).error,
    ).toBeDefined();
    expect(
      validationSchema.validate({ LIVEKIT_URL: 'ftp://example.com' }).error,
    ).toBeDefined();
  });
});
