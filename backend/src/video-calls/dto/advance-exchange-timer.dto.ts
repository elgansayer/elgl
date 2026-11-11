import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class AdvanceExchangeTimerDto {
  @ApiProperty({
    description:
      'Turn index the client last observed. Used to make turn handovers idempotent and to reject conflicting concurrent advances.',
    minimum: 0,
    example: 0,
  })
  @IsInt()
  @Min(0)
  @Max(100000)
  expectedTurnIndex!: number;
}
