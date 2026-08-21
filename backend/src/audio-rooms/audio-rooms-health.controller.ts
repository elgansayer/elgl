import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AudioRoomsHealthService,
  DegradationState,
} from './audio-rooms-health.service';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';

@ApiTags('Video Classrooms')
@Controller('audio-rooms')
export class AudioRoomsHealthController {
  constructor(private readonly healthService: AudioRoomsHealthService) {}

  /**
   * Health check endpoint for audio rooms infrastructure.
   * Returns degradation state for LiveKit, Supabase, and Centrifugo.
   * This endpoint is intentionally unauthenticated so the frontend can poll it reliably.
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Get audio rooms infrastructure health status',
    description:
      'Returns the current health/degradation state of LiveKit, Supabase, and Centrifugo ' +
      'services. Used by the frontend to show degraded-mode indicators when services are unavailable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Degradation state for all audio room services.',
  })
  async getHealth(): Promise<DegradationState> {
    return this.healthService.getDegradationState();
  }
}
