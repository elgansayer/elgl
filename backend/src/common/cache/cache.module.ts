import { Module } from '@nestjs/common';
import { CacheControlInterceptor } from './cache.interceptor';

@Module({
  providers: [CacheControlInterceptor],
  exports: [CacheControlInterceptor],
})
export class CacheModule {}