import { plainToInstance } from 'class-transformer';
import { IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  PORT: number = 3000;

  @IsString()
  NODE_ENV: string = 'development';

  @IsString()
  SUPABASE_URL!: string;

  @IsString()
  SUPABASE_ANON_KEY!: string;

  @IsString()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  CENTRIFUGO_URL!: string;

  @IsString()
  CENTRIFUGO_API_KEY!: string;

  @IsString()
  CENTRIFUGO_SECRET!: string;

  @IsString()
  LIVEKIT_URL!: string;

  @IsString()
  LIVEKIT_API_KEY!: string;

  @IsString()
  LIVEKIT_SECRET!: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_ENABLED?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_DOMAIN?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_CERT_FILE?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_KEY_FILE?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_TLS_PORT?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_UDP_PORT?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_USERNAME?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_TURN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  LIVEKIT_RTC_STUN_SERVERS?: string;

  @IsString()
  CLOUDFLARE_R2_GATEWAY_URL!: string;

  @IsString()
  CLOUDFLARE_R2_SIGNING_SECRET!: string;

  @IsString()
  CLOUDFLARE_R2_SERVICE_TOKEN!: string;

  @IsString()
  CLOUDFLARE_R2_PUBLIC_URL!: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_R2_SOURCE_HOSTS?: string;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_R2_UPLOAD_TTL_SECONDS?: number;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES?: number;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES?: number;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS?: number;

  @IsString()
  CLOUDFLARE_STREAM_ACCOUNT_ID!: string;

  @IsString()
  CLOUDFLARE_STREAM_API_TOKEN!: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_STREAM_ALLOWED_ORIGINS?: string;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_STREAM_POLL_INTERVAL_MS?: number;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS?: number;

  @IsNumber()
  @IsOptional()
  CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS?: number;

  @IsString()
  DEEPL_API_KEY!: string;

  @IsString()
  AZURE_TRANSLATOR_KEY!: string;

  @IsString()
  @IsOptional()
  AZURE_TRANSLATOR_REGION?: string;

  @IsString()
  @IsOptional()
  AZURE_SPEECH_KEY?: string;

  @IsString()
  @IsOptional()
  AZURE_SPEECH_REGION?: string;

  @IsNumber()
  @IsOptional()
  AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS?: number;

  @IsString()
  STRIPE_SECRET_KEY!: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET!: string;

  @IsString()
  @IsOptional()
  INTERNAL_API_SECRET?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
