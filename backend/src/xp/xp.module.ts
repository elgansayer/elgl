import { Module } from '@nestjs/common';
import { XpService } from './xp.service';
import { XpController } from './xp.controller';

@Module({
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
