import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RegisterE2eeKeyDto {
  @IsObject()
  @IsNotEmpty()
  public_key!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  device_id?: string;
}

export class StoreRoomE2eeKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  encrypted_key!: string;

  @IsOptional()
  @IsUUID()
  target_user_id?: string;
}
