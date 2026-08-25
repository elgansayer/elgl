import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_FRAME_TEXT_LENGTH = 512;

export class ClientErrorStackFrameDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FRAME_TEXT_LENGTH)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_FRAME_TEXT_LENGTH)
  functionName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_FRAME_TEXT_LENGTH)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  lineNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  columnNumber?: number;
}

export class ClientErrorDto {
  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12_000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
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
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ClientErrorStackFrameDto)
  stackFrames?: ClientErrorStackFrameDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  timestamp?: string;
}
