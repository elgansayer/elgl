import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderStageDto {
  @ApiProperty({
    description:
      'Ordered list of speaker user IDs representing the new stage order',
    type: [String],
    example: ['user_abc123', 'user_def456', 'user_ghi789'],
  })
  @IsArray()
  @IsString({ each: true })
  speaker_order!: string[];
}
