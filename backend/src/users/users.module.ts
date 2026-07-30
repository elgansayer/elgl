import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaModule } from '../media/media.module';
import { AccountDeletionCron } from './cron/account-deletion.cron';
import { LastActiveInterceptor } from './interceptors/last-active.interceptor';
import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SupabaseModule,
    NotificationsModule,
    MediaModule,
  ],
  controllers: [UsersController, DeviceLinkController],
  providers: [
    UsersService,
    AccountDeletionCron,
    {
      provide: APP_INTERCEPTOR,
      useClass: LastActiveInterceptor,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
