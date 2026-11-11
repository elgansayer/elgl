import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CACHE_NO_STORE,
  CacheControlInterceptor,
} from '../common/cache.interceptor';
import { ClassReplaysService } from './class-replays.service';
import { CreateClassReplayDto } from './dto/create-class-replay.dto';
import { ListClassReplaysQueryDto } from './dto/list-class-replays-query.dto';
import {
  ClassReplay,
  ClassReplayPlayback,
} from './interfaces/class-replay.interface';

interface AuthUser {
  id: string;
}

@ApiTags('Class Replays')
@ApiBearerAuth()
@Controller('class-replays')
@UseGuards(SupabaseAuthGuard)
@UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
export class ClassReplaysController {
  constructor(private readonly classReplays: ClassReplaysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a classroom recording for adaptive HLS/DASH transcoding',
    description:
      'Only the classroom host or co-host may publish a replay. The source is copied to the media provider once and transcoded into adaptive HLS and DASH renditions.',
  })
  @ApiResponse({ status: 201, description: 'Replay registration accepted.' })
  @ApiResponse({ status: 400, description: 'Invalid source recording.' })
  @ApiResponse({ status: 403, description: 'Host or co-host required.' })
  async create(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreateClassReplayDto,
  ): Promise<ClassReplay> {
    if (!user) throw new UnauthorizedException();
    return this.classReplays.createReplay(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List class replays the authenticated learner can watch',
  })
  @ApiResponse({ status: 200, description: 'Bounded replay listing.' })
  async list(
    @CurrentUser() user: AuthUser | null,
    @Query() query: ListClassReplaysQueryDto,
  ): Promise<ClassReplay[]> {
    if (!user) throw new UnauthorizedException();
    return this.classReplays.listReplays(user.id, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Get one class replay the learner can access' })
  @ApiResponse({ status: 200, description: 'Replay metadata.' })
  @ApiResponse({ status: 404, description: 'Replay not found.' })
  async get(
    @CurrentUser() user: AuthUser | null,
    @Param('id', new ParseUUIDPipe({ version: '4' })) replayId: string,
  ): Promise<ClassReplay> {
    if (!user) throw new UnauthorizedException();
    return this.classReplays.getReplay(user.id, replayId);
  }

  @Get(':id/playback')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Resolve adaptive playback sources for an authorised learner',
    description:
      'Returns HLS and DASH manifests plus the progressive fallback once the replay is ready. Pending or failed replays return 409 rather than an empty player.',
  })
  @ApiResponse({ status: 200, description: 'Playback sources.' })
  @ApiResponse({ status: 409, description: 'Replay is not ready yet.' })
  async playback(
    @CurrentUser() user: AuthUser | null,
    @Param('id', new ParseUUIDPipe({ version: '4' })) replayId: string,
  ): Promise<ClassReplayPlayback> {
    if (!user) throw new UnauthorizedException();
    return this.classReplays.getPlayback(user.id, replayId);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Retry a failed class replay transcode' })
  @ApiResponse({ status: 202, description: 'Retry queued.' })
  async retry(
    @CurrentUser() user: AuthUser | null,
    @Param('id', new ParseUUIDPipe({ version: '4' })) replayId: string,
  ): Promise<{ queued: boolean }> {
    if (!user) throw new UnauthorizedException();
    await this.classReplays.retry(user.id, replayId);
    return { queued: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Delete a class replay and its provider recording' })
  @ApiResponse({ status: 204, description: 'Replay deleted.' })
  async remove(
    @CurrentUser() user: AuthUser | null,
    @Param('id', new ParseUUIDPipe({ version: '4' })) replayId: string,
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    await this.classReplays.deleteReplay(user.id, replayId);
  }
}
