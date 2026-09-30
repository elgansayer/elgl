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
      'The url query parameter is missing, malformed, uses a disallowed protocol or port, or the page could not be fetched.',
  })
  async getPreview(@Query('url') url: string): Promise<LinkPreview | null> {
    if (!url) {
      throw new BadRequestException('Missing url query parameter');
    }
    return this.linkPreviewService.getPreview(url);
  }
}
