import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UsersController } from './users.controller';
import { DeviceLinkController } from './device-link.controller';
import { ProfileVisitsController } from './profile-visits.controller';
import { UsersService } from './users.service';
import { ProfileVisitsService } from './profile-visits.service';
import { DataExportWorker } from './data-export.worker';
import { MediaModule } from '../media/media.module';
import { AccountDeletionCron } from './cron/account-deletion.cron';
import { LastActiveInterceptor } from './interceptors/last-active.interceptor';
import { ProfileVisitsInterceptor } from './interceptors/profile-visits.interceptor';
import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsModule } from '../notifications/notifications.module';
import { XpModule } from '../xp/xp.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [
    SupabaseModule,
    NotificationsModule,
    MediaModule,
    XpModule,
    TwoFactorModule,
  ],
  controllers: [UsersController, DeviceLinkController, ProfileVisitsController],
  providers: [
    UsersService,
    ProfileVisitsService,
    DataExportWorker,
    AccountDeletionCron,
    {
      provide: APP_INTERCEPTOR,
      useClass: LastActiveInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ProfileVisitsInterceptor,
    },
  ],
  exports: [UsersService, ProfileVisitsService, DataExportWorker],
})
export class UsersModule {}
