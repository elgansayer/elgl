import { Module, Global } from '@nestjs/common';
import { RetryService } from './retry.service';
import { SharedLoggerModule } from '../logger/logger.module';

@Global()
@Module({
  imports: [SharedLoggerModule],
  providers: [RetryService],
  exports: [RetryService],
})
export class RetryModule {}
