import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';
import { StreakResetCron } from './cron/streak-reset.cron';
import { LastActiveInterceptor } from './interceptors/last-active.interceptor';
import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule, NotificationsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    MediaService,
    StreakResetCron,
    {
      provide: APP_INTERCEPTOR,
      useClass: LastActiveInterceptor,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
