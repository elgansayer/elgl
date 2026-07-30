import { IsOptional, IsString } from 'class-validator';

export class ArchiveRequestDto {
  @IsOptional()
  @IsString()
  receipt_id?: string;

  @IsOptional()
  @IsString()
  app_store?: string;
}
