import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessCatalogItemDto } from './update-profile.dto';

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  business_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  business_hours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website_url?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessCatalogItemDto)
  catalog?: BusinessCatalogItemDto[];
}
