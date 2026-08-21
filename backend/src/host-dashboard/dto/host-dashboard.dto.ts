import { ApiProperty } from '@nestjs/swagger';

export class HostDashboardStatsDto {
  @ApiProperty({
    description: 'ID of the audio/video room',
    example: 'room_a1b2c3d4',
  })
  roomId: string;

  @ApiProperty({
    description: 'Current number of viewers/participants',
    example: 42,
  })
  viewerCount: number;

  @ApiProperty({
    description: 'Total coins earned during this session',
    example: 150,
  })
  earnedCoins: number;

  @ApiProperty({
    description: 'Timestamp when the room was started',
    example: '2026-08-07T10:30:00.000Z',
  })
  startTime: Date;
}
