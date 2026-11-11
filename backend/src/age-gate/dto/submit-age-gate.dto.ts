import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SubmitAgeGateDto {
  @ApiProperty({
    description:
      'Date of birth as an ISO calendar date (YYYY-MM-DD). Evaluated against the server UTC date; never stored for under-age declarations.',
    example: '1999-04-23',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be a calendar date in YYYY-MM-DD format',
  })
  dateOfBirth!: string;
}
