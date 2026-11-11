import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { DMCA_MAX_REFERENCES_PER_SUBMISSION } from '../dmca.constants';
import {
  trimEachString,
  trimOptionalString,
  trimString,
} from './dmca-dto-transforms';

/** The statutory elements of a notification under 17 U.S.C. 512(c)(3)(A). */
export class CreateDmcaNoticeDto {
  @ApiProperty({
    description:
      'Full legal name of the complaining party or authorised agent.',
  })
  @Transform(trimString)
  @IsString()
  @Length(2, 200)
  claimantName!: string;

  @ApiProperty({
    description:
      'Mailbox the claimant controls. A confirmation link is sent here.',
  })
  @Transform(trimString)
  @IsEmail()
  @MaxLength(254)
  claimantEmail!: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  claimantOrganisation?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  claimantAddress?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  claimantPhone?: string;

  @ApiProperty({
    description:
      'Identification of the copyrighted work claimed to be infringed.',
  })
  @Transform(trimString)
  @IsString()
  @Length(10, 2000)
  copyrightedWork!: string;

  @ApiProperty({
    description:
      'Content identifiers, links containing one, or public file URLs of the allegedly infringing material. One notice is created per entry.',
    maxItems: DMCA_MAX_REFERENCES_PER_SUBMISSION,
  })
  @Transform(trimEachString)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(DMCA_MAX_REFERENCES_PER_SUBMISSION)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 2048, { each: true })
  materialReferences!: string[];

  @ApiProperty({
    description:
      'Statement that the complaining party has a good faith belief the use is not authorised by the owner, its agent, or the law.',
  })
  @Equals(true, { message: 'goodFaithStatement must be accepted' })
  goodFaithStatement!: boolean;

  @ApiProperty({
    description:
      'Statement that the information is accurate and, under penalty of perjury, that the complaining party is authorised to act for the owner.',
  })
  @Equals(true, { message: 'accuracyStatement must be accepted' })
  accuracyStatement!: boolean;

  @ApiProperty({
    description: 'Typed full name acting as the electronic signature.',
  })
  @Transform(trimString)
  @IsString()
  @Length(2, 200)
  electronicSignature!: string;
}
