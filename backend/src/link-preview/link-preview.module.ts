import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LinkPreviewService } from './link-preview.service';

@Module({
  imports: [HttpModule],
  providers: [LinkPreviewService],
  exports: [LinkPreviewService],
})
export class LinkPreviewModule {}
