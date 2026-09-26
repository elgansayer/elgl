import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreview } from './interfaces/link-preview.interface';

@ApiTags('Link Preview')
@Controller('link-preview')
@UseGuards(SupabaseAuthGuard)
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Fetch an OpenGraph link preview',
    description:
      'Scrapes OpenGraph metadata (title, description, image, site name) from the supplied URL. Responses are cached in Redis for one hour and failures for five minutes. The scraper rejects private, loopback and link-local addresses, including redirect targets, to prevent SSRF, and bounds every scrape by size and time.',
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
    schema: {
      type: 'object',
      nullable: true,
      properties: {
        url: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        image: { type: 'string' },
        siteName: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'The url query parameter is missing, repeated, malformed, uses a disallowed protocol or port, or the page could not be fetched.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'The server is already running the maximum number of page scrapes. Retry shortly.',
  })
  async getPreview(@Query('url') url: string): Promise<LinkPreview | null> {
    // A repeated ?url=a&url=b parameter arrives as an array, not a string.
    if (typeof url !== 'string' || url.length === 0) {
      throw new BadRequestException('Missing url query parameter');
    }
    return this.linkPreviewService.getPreview(url);
  }
}
