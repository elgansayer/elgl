import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateClassReplayDto {
  @ApiProperty({
    description:
      'Audio or video classroom whose participants may watch this replay',
    format: 'uuid',
  })
  @IsUUID('4')
  roomId!: string;

  @ApiProperty({
    description: 'Human-readable replay title',
    example: 'Japanese travel phrases - Tuesday class',
    maxLength: 200,
    minLength: 3,
  })
  @IsString()
  @Length(3, 200)
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional lesson notes or summary',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description:
      'HTTPS source recording. The backend transcodes it into adaptive HLS and DASH renditions.',
    example: 'https://media.example.com/recordings/class-123.mp4',
    maxLength: 2048,
  })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  sourceUrl!: string;
}
