import { Controller, Get, Param } from '@nestjs/common';
import { HostDashboardService } from './host-dashboard.service';
import { HostDashboardStatsDto } from './dto/host-dashboard.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Video Classrooms')
@Controller('host-dashboard')
@ApiBearerAuth()
export class HostDashboardController {
  constructor(private readonly service: HostDashboardService) {}

  @Get(':roomId/stats')
  @ApiOperation({
    summary: 'Get real-time host dashboard statistics for a room',
    description:
      'Returns live viewer count, earned coins, and session start time for a given audio/video room. ' +
      'Used by hosts to monitor room engagement in real time.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'ID of the audio/video room',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Host dashboard statistics.',
    schema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', example: 'room_a1b2c3d4' },
        viewerCount: { type: 'number', example: 42 },
        earnedCoins: { type: 'number', example: 150 },
        startTime: {
          type: 'string',
          format: 'date-time',
          example: '2026-08-07T10:30:00.000Z',
        },
      },
    },
  })
  async getStats(
    @Param('roomId') roomId: string,
  ): Promise<HostDashboardStatsDto> {
    return this.service.getStats(roomId);
  }
}
