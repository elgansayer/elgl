import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const P256_COORDINATE_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;

export class P256PublicJwkDto {
  @Equals('EC')
  kty!: 'EC';

  @Equals('P-256')
  crv!: 'P-256';

  @Matches(P256_COORDINATE_PATTERN)
  x!: string;

  @Matches(P256_COORDINATE_PATTERN)
  y!: string;
}

export class RegisterChatE2eeDeviceDto {
  @IsUUID('4')
  device_id!: string;

  @ValidateNested()
  @Type(() => P256PublicJwkDto)
  public_key!: P256PublicJwkDto;
}

export class ChatE2eeEnvelopeDto {
  @IsUUID('4')
  device_id!: string;

  @ValidateNested()
  @Type(() => P256PublicJwkDto)
  ephemeral_public_key!: P256PublicJwkDto;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(64)
  iv!: string;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(128)
  wrapped_key!: string;
}

export class SendEncryptedChatMessageDto {
  @IsString()
  @MaxLength(128)
  room_id!: string;

  @Equals(1)
  encryption_version!: 1;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(4_500_000)
  ciphertext!: string;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(64)
  iv!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatE2eeEnvelopeDto)
  envelopes!: ChatE2eeEnvelopeDto[];
}
