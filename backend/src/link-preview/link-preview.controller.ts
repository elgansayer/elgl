import { Controller, Get, Query } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreview } from './interfaces/link-preview.interface';

@Controller('link-preview')
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  getPreview(@Query('url') url: string): Promise<LinkPreview | null> {
    return this.linkPreviewService.fetchPreview(url);
  }
}
