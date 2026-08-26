import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MESSAGE_TYPES = [
  'text',
  'voice',
  'correction',
  'doodle',
  'sticker',
  'correction_request',
  'status_reply',
  'view_once_media',
] as const;

export class E2eePublicKeyJwkDto {
  @IsString()
  @IsIn(['EC'])
  kty!: 'EC';

  @IsString()
  @IsIn(['P-256'])
  crv!: 'P-256';

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(128)
  x!: string;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(128)
  y!: string;
}

export class RegisterE2eeDeviceDto {
  @IsUUID('4')
  device_id!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => E2eePublicKeyJwkDto)
  public_key_jwk!: E2eePublicKeyJwkDto;
}

export class E2eeKeyEnvelopeDto {
  @IsUUID('4')
  device_id!: string;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(64)
  nonce!: string;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(256)
  wrapped_key!: string;
}

export class E2eeEncryptedPayloadDto {
  @IsIn([1])
  version!: 1;

  @IsString()
  @IsIn(['ECDH-P256-HKDF-SHA256-AES256-GCM'])
  algorithm!: 'ECDH-P256-HKDF-SHA256-AES256-GCM';

  @IsUUID('4')
  sender_device_id!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => E2eePublicKeyJwkDto)
  sender_public_key!: E2eePublicKeyJwkDto;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(64)
  nonce!: string;

  @IsString()
  @Matches(BASE64URL_PATTERN)
  @MaxLength(4_500_000)
  ciphertext!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => E2eeKeyEnvelopeDto)
  envelopes!: E2eeKeyEnvelopeDto[];
}

export class SendEncryptedMessageDto {
  @IsUUID('4')
  room_id!: string;

  @IsString()
  @IsIn(MESSAGE_TYPES)
  message_type!: (typeof MESSAGE_TYPES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  reply_to_id?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => E2eeEncryptedPayloadDto)
  encrypted_payload!: E2eeEncryptedPayloadDto;
}
