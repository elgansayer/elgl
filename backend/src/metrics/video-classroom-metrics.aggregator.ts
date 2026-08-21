import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';
import { MetricsService } from './metrics.service';

/**
 * Aggregates video classroom (LiveKit room) stats from the LiveKit server
 * and pushes them to Prometheus gauges on a regular schedule, enabling
 * Datadog monitors and Grafana dashboards to track video call health
 * without direct LiveKit API queries on each scrape.
 *
 * Issue #2230: Datadog monitoring alerts for Video Classrooms.
 */
@Injectable()
export class VideoClassroomMetricsAggregator {
  private roomService: RoomServiceClient;

  constructor(
    @InjectPinoLogger(VideoClassroomMetricsAggregator.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async collectVideoRoomStats(): Promise<void> {
    try {
      const rooms = await this.roomService.listRooms();

      const activeRooms = rooms.filter((r) => r.numParticipants > 0);
      this.metricsService.setVideoRoomActive(activeRooms.length);

      const totalParticipants = activeRooms.reduce(
        (sum, r) => sum + r.numParticipants,
        0,
      );
      this.metricsService.setVideoRoomParticipants(totalParticipants);
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate video classroom metrics',
      );
    }
  }
}
