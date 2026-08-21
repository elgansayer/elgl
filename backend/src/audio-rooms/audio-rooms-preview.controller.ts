import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AudioRoomsService } from './audio-rooms.service';
import { RoomPreviewDto } from './dto/room-preview.dto';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_SHORT,
  CACHE_TAG_AUDIO_ROOM_STAGE,
} from '../common/cache.interceptor';

/**
 * Public audio room endpoints used by the SSR-rendered Voiceroom preview page.
 *
 * Unlike {@link AudioRoomsController}, this controller is intentionally
 * unauthenticated: search engine crawlers and social media link previews must
 * be able to fetch a safe subset of room metadata without a Bearer token.
 * Only non-sensitive fields are returned via {@link RoomPreviewDto}.
 */
@ApiTags('Video Classrooms')
@Controller('audio-rooms')
export class AudioRoomsPreviewController {
  constructor(private readonly audioRoomsService: AudioRoomsService) {}

  /**
   * Public room preview for SSR rendering and social sharing.
   * Private or missing rooms return 404 so their existence is not leaked.
   */
  @Get('preview/:id')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_PUBLIC_SHORT, [
      CACHE_TAG_AUDIO_ROOM_STAGE,
    ]),
  )
  @ApiOperation({
    summary: 'Get a public preview of an audio room',
    description:
      'Returns a safe, public subset of audio room metadata for the SSR-rendered ' +
      'Voiceroom preview page and social sharing. This endpoint does not require ' +
      'authentication and never exposes participant lists, raised hands, private ' +
      'metadata or host identifiers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Public room preview.',
    type: RoomPreviewDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found or not publicly visible.',
  })
  async getRoomPreview(@Param('id') id: string): Promise<RoomPreviewDto> {
    return this.audioRoomsService.getRoomPreview(id);
  }
}
