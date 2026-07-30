import {
  IsOptional,
  IsBoolean,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class UpdateGroupSettingsDto {
  @IsOptional()
  @IsBoolean()
  can_send_messages?: boolean;

  @IsOptional()
  @IsBoolean()
  can_edit_info?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsUUID()
  interest_id?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(19)
  max_members?: number;
}
