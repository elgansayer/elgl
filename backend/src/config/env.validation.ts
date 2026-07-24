import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  validateSync,
} from 'class-validator';

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
  CLOUDFLARE_R2_ENDPOINT!: string;

  @IsString()
  CLOUDFLARE_R2_ACCESS_KEY_ID!: string;

  @IsString()
  CLOUDFLARE_R2_SECRET_ACCESS_KEY!: string;

  @IsString()
  CLOUDFLARE_R2_BUCKET!: string;

  @IsString()
  @IsOptional()
  CLOUDFLARE_R2_PUBLIC_DOMAIN?: string;

  @IsString()
  DEEPL_API_KEY!: string;

  @IsString()
  AZURE_TRANSLATOR_KEY!: string;

  @IsString()
  @IsOptional()
  AZURE_TRANSLATOR_REGION?: string;

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
