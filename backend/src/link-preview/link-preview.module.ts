import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService],
  exports: [LinkPreviewService],
})
export class LinkPreviewModule {}
