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
    expect(value.CLOUDFLARE_R2_SOURCE_HOSTS).toBe('recordings.example.com');
    expect(value.CLOUDFLARE_R2_UPLOAD_TTL_SECONDS).toBe(3600);
    expect(value.CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES).toBe(26214400);
    expect(value.CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES).toBe(104857600);
    expect(value.CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS).toBe(30000);

    expect(value.CLOUDFLARE_STREAM_ACCOUNT_ID).toBe(
      'test-cloudflare-account-id',
    );
    expect(value.CLOUDFLARE_STREAM_API_TOKEN).toBe(
      'test-cloudflare-stream-api-token',
    );
    expect(value.CLOUDFLARE_STREAM_ALLOWED_ORIGINS).toBe(
      'http://localhost:4200',
    );
    expect(value.CLOUDFLARE_STREAM_POLL_INTERVAL_MS).toBe(5000);
    expect(value.CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS).toBe(120000);
    expect(value.CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS).toBe(1);
    expect(value.AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS).toBe(600000);
    expect(value.TRANSFER_SECRET).toBe('test-transfer-secret');
  });

  it('preserves explicitly provided gateway, stream and provider limits', () => {
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
      CLOUDFLARE_STREAM_ACCOUNT_ID: 'account-123',
      CLOUDFLARE_STREAM_API_TOKEN:
        'custom-stream-token-with-at-least-20-characters',
      CLOUDFLARE_STREAM_ALLOWED_ORIGINS:
        'https://app.example.com,https://admin.example.com',
      CLOUDFLARE_STREAM_POLL_INTERVAL_MS: '250',
      CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS: '30000',
      CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS: '7',
      AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS: '120000',
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
    expect(value.CLOUDFLARE_STREAM_ACCOUNT_ID).toBe('account-123');
    expect(value.CLOUDFLARE_STREAM_ALLOWED_ORIGINS).toBe(
      'https://app.example.com,https://admin.example.com',
    );
    expect(value.CLOUDFLARE_STREAM_POLL_INTERVAL_MS).toBe(250);
    expect(value.CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS).toBe(30000);
    expect(value.CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS).toBe(7);
    expect(value.AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS).toBe(120000);
  });

  it('rejects weak secrets and invalid limits', () => {
    expect(
      validationSchema.validate({
        TRANSFER_SECRET: 'test-transfer-secret',
        CLOUDFLARE_R2_SIGNING_SECRET: 'short',
      }).error,
    ).toBeDefined();
    expect(
      validationSchema.validate({
        TRANSFER_SECRET: 'test-transfer-secret',
        CLOUDFLARE_STREAM_API_TOKEN: 'short',
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
    expect(
      validationSchema.validate({
        TRANSFER_SECRET: 'test-transfer-secret',
        CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS: '31',
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

  describe('previously undeclared variables', () => {
    const base = { TRANSFER_SECRET: 'test-transfer-secret' };

    it('defaults the Cloudflare trust flags to off', () => {
      const { error, value } = validationSchema.validate(base);

      expect(error).toBeUndefined();
      expect(value.TRUST_CLOUDFLARE_CONNECTING_IP).toBe('false');
      expect(value.TRUST_CLOUDFLARE_NETWORK_METADATA).toBe('false');
    });

    it('accepts only the exact strings the network abuse guard understands', () => {
      expect(
        validationSchema.validate({
          ...base,
          TRUST_CLOUDFLARE_CONNECTING_IP: 'true',
          TRUST_CLOUDFLARE_NETWORK_METADATA: 'true',
        }).error,
      ).toBeUndefined();

      for (const spelling of ['TRUE', '1', 'yes', 'on', '']) {
        expect(
          validationSchema.validate({
            ...base,
            TRUST_CLOUDFLARE_CONNECTING_IP: spelling,
          }).error,
        ).toBeDefined();
        expect(
          validationSchema.validate({
            ...base,
            TRUST_CLOUDFLARE_NETWORK_METADATA: spelling,
          }).error,
        ).toBeDefined();
      }
    });

    it('validates the optional Centrifugo health probe override', () => {
      expect(validationSchema.validate(base).value.CENTRIFUGO_API_URL).toBe(
        undefined,
      );
      expect(
        validationSchema.validate({ ...base, CENTRIFUGO_API_URL: '' }).error,
      ).toBeUndefined();
      expect(
        validationSchema.validate({
          ...base,
          CENTRIFUGO_API_URL: 'http://websocket:8000',
        }).error,
      ).toBeUndefined();
      expect(
        validationSchema.validate({ ...base, CENTRIFUGO_API_URL: 'nope' })
          .error,
      ).toBeDefined();
    });

    it('rejects blank LLM overrides that consumers would send to the provider', () => {
      expect(
        validationSchema.validate({ ...base, LLM_MODEL: '' }).error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, LLM_API_URL: '' }).error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, LLM_API_URL: 'not a url' }).error,
      ).toBeDefined();

      const { error, value } = validationSchema.validate({
        ...base,
        LLM_MODEL: 'gpt-4o-mini',
        LLM_API_URL: 'https://api.openai.com/v1/chat/completions',
      });
      expect(error).toBeUndefined();
      expect(value.LLM_MODEL).toBe('gpt-4o-mini');
    });

    it('treats blank Datadog settings as disabled and validates configured ones', () => {
      expect(
        validationSchema.validate({
          ...base,
          DD_AGENT_HOST: '',
          DD_DOGSTATSD_PORT: '',
          DD_API_KEY: '',
          DD_ENV: '',
        }).error,
      ).toBeUndefined();

      const { error, value } = validationSchema.validate({
        ...base,
        DD_AGENT_HOST: 'datadog',
        DD_DOGSTATSD_PORT: '8125',
        DD_API_KEY: 'dd-key',
        DD_ENV: 'staging',
      });
      expect(error).toBeUndefined();
      expect(value.DD_DOGSTATSD_PORT).toBe(8125);

      expect(
        validationSchema.validate({ ...base, DD_AGENT_HOST: 'http://datadog' })
          .error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, DD_DOGSTATSD_PORT: '70000' })
          .error,
      ).toBeDefined();
    });
  });

  describe('port ranges', () => {
    const base = { TRANSFER_SECRET: 'test-transfer-secret' };

    it.each([
      'PORT',
      'MAIL_PORT',
      'LIVEKIT_TURN_TLS_PORT',
      'LIVEKIT_TURN_UDP_PORT',
    ])('rejects an out-of-range or fractional %s', (key) => {
      expect(
        validationSchema.validate({ ...base, [key]: '65536' }).error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, [key]: '-1' }).error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, [key]: '80.5' }).error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, [key]: 'abc' }).error,
      ).toBeDefined();
      expect(
        validationSchema.validate({ ...base, [key]: '65535' }).error,
      ).toBeUndefined();
    });
  });
});
