import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportUserDto {
  @ApiProperty({
    description: 'UUID of the user being reported',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  reportedUserId!: string;

  @ApiProperty({
    description:
      'Reason category for the report (e.g., "spam", "harassment", "inappropriate_content")',
    example: 'harassment',
  })
  @IsString()
  @IsNotEmpty()
  reasonCategory!: string;

  @ApiPropertyOptional({
    description: 'Optional detailed description of the report',
    example: 'User sent unsolicited messages with offensive content.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
