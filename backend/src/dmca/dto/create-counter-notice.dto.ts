import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { trimOptionalString, trimString } from './dmca-dto-transforms';

/** The statutory elements of a counter-notification under 17 U.S.C. 512(g)(3). */
export class CreateCounterNoticeDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @Length(2, 200)
  fullName!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @Length(5, 500)
  address!: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({
    description:
      'Statement, under penalty of perjury, of a good faith belief the material was removed by mistake or misidentification.',
  })
  @Equals(true, { message: 'goodFaithStatement must be accepted' })
  goodFaithStatement!: boolean;

  @ApiProperty({
    description:
      'Consent to the jurisdiction of the federal court for the address given, or of the service provider.',
  })
  @Equals(true, { message: 'jurisdictionConsent must be accepted' })
  jurisdictionConsent!: boolean;

  @ApiProperty({
    description: 'Typed full name acting as the electronic signature.',
  })
  @Transform(trimString)
  @IsString()
  @Length(2, 200)
  electronicSignature!: string;
}
