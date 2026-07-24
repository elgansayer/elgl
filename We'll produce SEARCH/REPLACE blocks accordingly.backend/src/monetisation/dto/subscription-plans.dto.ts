import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class SubscriptionPlanDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  price_ukp!: number;

  @IsNumber()
  price_usd!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  interval!: string;

  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @IsOptional()
  @IsBoolean()
  is_popular?: boolean;

  @IsOptional()
  @IsString()
  stripe_price_id?: string;
}

export class SubscriptionPlansResponseDto {
  @IsArray()
  plans!: SubscriptionPlanDto[];

  @IsString()
  @IsNotEmpty()
  currency!: string;
}
