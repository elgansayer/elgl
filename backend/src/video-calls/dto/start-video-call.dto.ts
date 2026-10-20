import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartVideoCallDto {
  @ApiProperty({
    description: 'User ID of the intended second participant',
    format: 'uuid',
  })
  @IsUUID('4')
  remoteUserId!: string;
}
