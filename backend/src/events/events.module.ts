import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventCreationPolicyService } from './event-creation-policy.service';
import { EventsService } from './events.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AudioRoomsModule } from '../audio-rooms/audio-rooms.module';

@Module({
  imports: [SupabaseModule, NotificationsModule, AudioRoomsModule],
  controllers: [EventsController],
  providers: [EventsService, EventCreationPolicyService],
  exports: [EventsService],
})
export class EventsModule {}
