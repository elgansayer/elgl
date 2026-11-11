import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListClassReplaysQueryDto {
  @ApiPropertyOptional({
    description: 'Restrict the listing to one classroom',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  roomId?: string;
}
