import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetCallLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by call type (e.g., "video", "audio", "group")',
    example: 'video',
  })
  @IsOptional()
  @IsString()
  callType?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of logs to return',
    example: 20,
    minimum: 1,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Offset for pagination (0-indexed)',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
