import {
  IsArray,
  IsNumber,
  IsString,
  ArrayMinSize,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupCallDto {
  @ApiProperty({
    description: 'Array of participant user IDs to include in the group call',
    type: [String],
    example: [
      'd290f1ee-6c54-4b01-90e6-d701748f0851',
      'e3a0b2c1-7d65-5c12-a1f7-e812859f9602',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participant_ids: string[];

  @ApiPropertyOptional({
    description:
      'Maximum number of participants allowed in the group call room (minimum 2)',
    example: 10,
    minimum: 2,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(2)
  participant_limit?: number;
}
