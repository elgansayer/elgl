import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreview } from './interfaces/link-preview.interface';
import { LinkPreviewQueryDto, LinkPreviewResponseDto } from './dto';

@ApiTags('Link Preview')
@ApiBearerAuth()
@Controller('link-preview')
@UseGuards(SupabaseAuthGuard)
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Fetch an OpenGraph link preview',
    description:
      'Scrapes OpenGraph metadata (title, description, image, site name) from the supplied URL. Responses are cached in Redis for one hour and the scraper rejects private, loopback and link-local addresses to prevent SSRF.',
  })
  @ApiQuery({
    name: 'url',
    required: true,
    description:
      'The absolute http(s) URL to scrape for link preview metadata.',
    example: 'https://example.com/article',
  })
  @ApiOkResponse({
    description: 'Link preview metadata extracted from the page.',
    type: LinkPreviewResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'The url query parameter is missing, malformed, uses a disallowed protocol or port, or the page could not be fetched.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid Supabase session is required.',
  })
  async getPreview(
    @Query('url') urlParam?: string | LinkPreviewQueryDto,
    @Query() queryDto?: LinkPreviewQueryDto,
  ): Promise<LinkPreview | null> {
    const raw =
      typeof urlParam === 'string' && urlParam.length > 0
        ? urlParam
        : typeof urlParam === 'object' && urlParam !== null && 'url' in urlParam
          ? urlParam.url
          : queryDto?.url;

    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException('Missing url query parameter');
    }
    return this.linkPreviewService.getPreview(raw.trim());
  }
}
