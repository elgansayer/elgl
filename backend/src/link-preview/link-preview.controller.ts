import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';

@Controller('link-preview')
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  async getPreview(@Query('url') url: string) {
    if (!url) {
      throw new HttpException(
        'Missing url query parameter',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.linkPreviewService.getPreview(url);
  }
}
