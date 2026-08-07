import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';

@Module({
  imports: [UsersModule, LlmProxyModule],
  controllers: [NlpController],
  providers: [NlpService],
  exports: [NlpService],
})
export class NlpModule {}
