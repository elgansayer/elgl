import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientVersionGuard } from './client-version.guard';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

@Module({
  controllers: [VersionController],
  providers: [
    VersionService,
    ClientVersionGuard,
    {
      provide: APP_GUARD,
      useExisting: ClientVersionGuard,
    },
  ],
  exports: [VersionService],
})
export class VersionModule {}
