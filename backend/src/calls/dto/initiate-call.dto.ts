import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateCallDto {
  @ApiProperty({
    description: 'User ID of the callee (recipient of the call)',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsString()
  @IsNotEmpty()
  callee_id!: string;

  @ApiPropertyOptional({
    description:
      'Whether the call should be a video call (true) or audio-only (false)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_video?: boolean;
}
