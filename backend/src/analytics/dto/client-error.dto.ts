import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ClientErrorStackFrameDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  functionName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  lineNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  columnNumber?: number;
}

export class ClientErrorDto {
  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ClientErrorStackFrameDto)
  stackFrames?: ClientErrorStackFrameDto[];

  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}
