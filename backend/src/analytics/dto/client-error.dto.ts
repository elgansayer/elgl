import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ClientErrorStackFrameDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  functionName?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  lineNumber?: number;

  @IsOptional()
  columnNumber?: number;
}

export class ClientErrorDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  componentStack?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientErrorStackFrameDto)
  stackFrames?: ClientErrorStackFrameDto[];

  @IsOptional()
  @IsString()
  timestamp?: string;
}
