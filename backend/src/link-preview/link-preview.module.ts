import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreviewController } from './link-preview.controller';

@Module({
  imports: [HttpModule],
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService],
  exports: [LinkPreviewService],
})
export class LinkPreviewModule {}
