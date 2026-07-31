import { Global, Module } from '@nestjs/common';
import { XpService } from './xp.service';
import { XpController } from './xp.controller';

@Global()
@Module({
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
