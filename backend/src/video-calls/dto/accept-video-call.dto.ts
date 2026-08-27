import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class AcceptVideoCallDto {
  @ApiProperty({
    description: 'Generated LiveKit room identifier',
    example: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
  })
  @Matches(
    /^video_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    {
      message: 'roomName must be a generated video call room identifier',
    },
  )
  roomName!: string;
}
