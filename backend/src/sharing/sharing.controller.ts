import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SharingService } from './sharing.service';
import { ShareEntityParamsDto } from './dto/share-entity-params.dto';
import type { ShareLink, SharePreview } from './sharing.types';

/**
 * Universal sharing and deep-linking surface.
 *
 * The preview and OpenGraph routes are public so crawlers and logged-out
 * visitors can render a safe card. They only expose the small, non-sensitive
 * subset returned by {@link SharePreview}. The link route requires an
 * authenticated session because it is used by the in-app share sheet.
 */
@ApiTags('Sharing')
@Controller('sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get('preview/:entityType/:entityId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Resolve a shareable entity into a rich preview',
    description:
      'Returns the safe public metadata used by in-app share cards and the OpenGraph landing page.',
  })
  @ApiParam({
    name: 'entityType',
    enum: ['tutor', 'group', 'room', 'moment', 'event'],
  })
  @ApiParam({ name: 'entityId' })
  @ApiOkResponse({ description: 'Resolved share preview.' })
  @ApiBadRequestResponse({ description: 'Unsupported entity type or id.' })
  async getPreview(
    @Param() params: ShareEntityParamsDto,
  ): Promise<SharePreview> {
    return this.sharingService.getPreview(params.entityType, params.entityId);
  }

  @Get('og/:entityType/:entityId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Render an OpenGraph HTML preview for a shareable entity',
    description:
      'Serves social crawlers a small HTML document with OpenGraph and Twitter Card metadata, then sends the visitor to the in-app route.',
  })
  @ApiParam({
    name: 'entityType',
    enum: ['tutor', 'group', 'room', 'moment', 'event'],
  })
  @ApiParam({ name: 'entityId' })
  @ApiOkResponse({ description: 'OpenGraph HTML document.' })
  @ApiBadRequestResponse({ description: 'Unsupported entity type or id.' })
  async getOpenGraph(@Param() params: ShareEntityParamsDto): Promise<string> {
    const preview = await this.sharingService.getPreview(
      params.entityType,
      params.entityId,
    );
    return this.sharingService.renderOpenGraphHtml(preview);
  }

  @Get('link/:entityType/:entityId')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a share link and deep link for an entity',
  })
  @ApiParam({
    name: 'entityType',
    enum: ['tutor', 'group', 'room', 'moment', 'event'],
  })
  @ApiParam({ name: 'entityId' })
  @ApiOkResponse({ description: 'Share link, web route and deep link.' })
  @ApiUnauthorizedResponse({ description: 'A valid session is required.' })
  async getShareLink(
    @Param() params: ShareEntityParamsDto,
  ): Promise<ShareLink> {
    return this.sharingService.getShareLink(params.entityType, params.entityId);
  }
}
