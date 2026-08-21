import { Module } from '@nestjs/common';
import { R2ObjectService } from './r2-object.service';
import { R2Service } from './r2.service';

@Module({
  providers: [R2Service, R2ObjectService],
  exports: [R2Service, R2ObjectService],
})
export class CloudflareR2Module {}
