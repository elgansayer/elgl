import { IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitVoteDto {
  @ApiProperty({
    description: 'UUID of the poll to vote on',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  pollId!: string;

  @ApiProperty({
    description: 'Zero-based index of the selected poll option',
    example: 1,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  optionIndex!: number;
}
