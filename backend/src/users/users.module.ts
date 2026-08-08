import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UsersController } from './users.controller';
import { DeviceLinkController } from './device-link.controller';
import { UsersService } from './users.service';
import { DataExportWorker } from './data-export.worker';
import { MediaModule } from '../media/media.module';
import { AccountDeletionCron } from './cron/account-deletion.cron';
import { LastActiveInterceptor } from './interceptors/last-active.interceptor';
import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsModule } from '../notifications/notifications.module';
import { XpModule } from '../xp/xp.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { ProfileVisitsModule } from '../profile-visits/profile-visits.module';

@Module({
  imports: [
    SupabaseModule,
    NotificationsModule,
    MediaModule,
    XpModule,
    TwoFactorModule,
    ProfileVisitsModule,
  ],
  controllers: [UsersController, DeviceLinkController],
  providers: [
    UsersService,
    DataExportWorker,
    AccountDeletionCron,
    {
      provide: APP_INTERCEPTOR,
      useClass: LastActiveInterceptor,
    },
  ],
  exports: [UsersService, DataExportWorker],
})
export class UsersModule {}
