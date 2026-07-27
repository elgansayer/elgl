import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetLinkPreviewDto } from './dto/get-link-preview.dto';
import { LinkPreview } from './interfaces/link-preview.interface';
import { LinkPreviewService } from './link-preview.service';

@Controller('link-preview')
@UseGuards(SupabaseAuthGuard)
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  async getPreview(@Query() dto: GetLinkPreviewDto): Promise<LinkPreview> {
    return this.linkPreviewService.getPreview(dto.url);
  }
}
