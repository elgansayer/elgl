import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreviewController } from './link-preview.controller';
import { MessageLinkPreviewStore } from './message-link-preview.store';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [HttpModule, SupabaseModule],
  controllers: [LinkPreviewController],
  providers: [
    LinkPreviewService,
    MessageLinkPreviewStore,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (supabaseService: SupabaseService) =>
        supabaseService.getRedisClient(),
      inject: [SupabaseService],
    },
  ],
  exports: [LinkPreviewService, MessageLinkPreviewStore],
})
export class LinkPreviewModule {}
