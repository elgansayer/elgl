import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ModerationActionDto {
  @ApiProperty({
    description: 'UUID of the report item to act upon',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  itemId!: string;

  @ApiProperty({
    description: 'Type of the reported content',
    enum: ['moment', 'profile'],
    example: 'moment',
  })
  @IsString()
  @IsIn(['moment', 'profile'])
  type!: 'moment' | 'profile';

  @ApiPropertyOptional({
    description: 'Optional reason for rejection (used when rejecting an item)',
    example: 'inappropriate_content',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
