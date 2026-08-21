import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreview } from './interfaces/link-preview.interface';

@ApiTags('Link Preview')
@Controller('link-preview')
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
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
