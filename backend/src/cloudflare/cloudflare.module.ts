import { Module, Global } from '@nestjs/common';
import { CloudflareCacheService } from './cache.service';

@Global()
@Module({
  providers: [CloudflareCacheService],
  exports: [CloudflareCacheService],
})
export class CloudflareModule {}
