import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsQueryDto } from './dto/events-query.dto';

export interface EventWithHost {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  date_time: string;
  location: string | null;
  language_pair: string | null;
  max_participants: number | null;
  host_id: string;
  host?: { display_name: string | null; avatar_url: string | null };
}

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalId2: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly audioRoomsService: AudioRoomsService,
  ) {}

  onModuleInit() {
    // Start background job that checks for upcoming event reminders every 60 seconds
    this.intervalId = setInterval(() => void this.checkReminders(), 60_000);

    // Start background job that checks for events whose start time is happening now
    // and spins up a LiveKit audio room for them.
    this.intervalId2 = setInterval(() => void this.checkStartEvents(), 10_000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.intervalId2) {
      clearInterval(this.intervalId2);
      this.intervalId2 = null;
    }
  }

  /**
   * Scans events whose start time is between 14.5 and 15.5 minutes from now
   * and sends a push reminder to each user who RSVPed as 'attending'.
   */
  private async checkReminders(): Promise<void> {
    try {
      const now = Date.now();
      const minMillis = now + 14.5 * 60 * 1000; // 14.5 minutes ahead
      const maxMillis = now + 15.5 * 60 * 1000; // 15.5 minutes ahead

      const supabase = this.supabaseService.getClient();

      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, host_id, language_pair')
        .gte('date_time', new Date(minMillis).toISOString())
        .lte('date_time', new Date(maxMillis).toISOString());

      if (error) {
        this.logger.error(
          'Failed to fetch upcoming events for reminders',
          error,
        );
        return;
      }

      if (!events || events.length === 0) return;

      const typedEvents: Array<{
        id: string;
        title: string;
        host_id: string;
        language_pair: string | null;
      }> = events ?? [];

      if (typedEvents.length === 0) return;

      const eventIds = typedEvents.map((e) => e.id);

      const { data: allRsvps, error: rsvpError } = await supabase
        .from('event_rsvps')
        .select('event_id, user_id')
        .in('event_id', eventIds)
        .eq('status', 'attending');

      if (rsvpError) {
        this.logger.warn(
          'Could not fetch RSVPs for upcoming events',
          rsvpError,
        );
        return;
      }

      if (!allRsvps) return;

      const rsvpsByEventId = new Map<string, string[]>();
      for (const rsvp of allRsvps) {
        const users = rsvpsByEventId.get(rsvp.event_id) ?? [];
        users.push(rsvp.user_id);
        rsvpsByEventId.set(rsvp.event_id, users);
      }

      // ⚡ Bolt: Replaced sequential `for...of` loop with concurrent `Promise.allSettled`.
      // Executing `sendRemindersBatch` concurrently mitigates N+1 database/network latency overheads.
      const reminderResults = await Promise.allSettled(
        typedEvents.map((event) => {
          const userIds = rsvpsByEventId.get(event.id);
          if (!userIds) return Promise.resolve();
          return this.sendRemindersBatch(event.id, event.title, userIds);
        }),
      );

      const failedReminders = reminderResults.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (failedReminders.length > 0) {
        throw failedReminders[0].reason;
      }
    } catch (err) {
      this.logger.error('Unexpected error in checkReminders', err);
    }
  }

  /**
   * Sends an actual push notification via Firebase or a similar service to a batch of users.
   */
  private async sendRemindersBatch(
    eventId: string,
    eventTitle: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;

    const supabase = this.supabaseService.getClient();

    // Deduplicate: check if we already sent a reminder for this event to these users
    const { data: existing, error: fetchErr } = await supabase
      .from('event_reminders_sent')
      .select('user_id')
      .eq('event_id', eventId)
      .in('user_id', userIds);

    if (fetchErr) {
      this.logger.warn('Could not check existing reminders', fetchErr);
      return;
    }

    const existingUserIds = new Set(existing?.map((r) => r.user_id) ?? []);
    const usersToNotify = userIds.filter((id) => !existingUserIds.has(id));

    if (usersToNotify.length === 0) {
      // All users already notified
      return;
    }

    // Send push notification using the existing NotificationsService
    const title = `Event Reminder: ${eventTitle}`;
    const body = `Your event "${eventTitle}" starts in 15 minutes.`;

    await Promise.allSettled(
      usersToNotify.map((userId) =>
        this.notificationsService.sendPushNotification(userId, {
          type: 'event_reminder',
          title,
          body,
          category: 'groups',
        }),
      ),
    );

    // Record that we sent the reminder to avoid duplicates
    const recordsToInsert = usersToNotify.map((userId) => ({
      event_id: eventId,
      user_id: userId,
    }));

    const { error: insertErr } = await supabase
      .from('event_reminders_sent')
      .insert<{ event_id: string; user_id: string }>(recordsToInsert);

    if (insertErr) {
      this.logger.warn('Failed to record sent reminders', insertErr);
    }
  }

  async createEvent(userId: string, dto: CreateEventDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('events')
      .insert<{
        title: string;
        description: string | null;
        category: string | null;
        date_time: string;
        location: string | null;
        language_pair: string | null;
        max_participants: number | null;
        host_id: string;
      }>({
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? null,
        date_time: dto.date_time,
        location: dto.location ?? null,
        language_pair: dto.language_pair ?? null,
        max_participants: dto.max_participants ?? null,
        host_id: userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create event', error);
      throw error;
    }
    return data;
  }

  async listEvents(userId: string, query: EventsQueryDto) {
    const supabase = this.supabaseService.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let q = supabase
      .from('events')
      .select('*, host:host_id(display_name, avatar_url)');

    if (query.status === 'past') {
      q = q.lt('date_time', new Date().toISOString());
    } else {
      // upcoming by default
      q = q.gte('date_time', new Date().toISOString());
    }

    if (query.language_pair) {
      q = q.eq('language_pair', query.language_pair);
    }
    if (query.category) {
      q = q.eq('category', query.category);
    }
    if (query.from_date) {
      q = q.gte('date_time', query.from_date);
    }
    if (query.proficiency) {
      q = q.eq('proficiency', query.proficiency);
    }
    if (query.to_date) {
      q = q.lte('date_time', query.to_date);
    }

    q = q
      .order('date_time', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error } = await q;
    if (error) {
      this.logger.error('Failed to list events', error);
      throw error;
    }
    return ((data ?? []) as EventWithHost[]).map((ev: EventWithHost) => ({
      ...ev,
      host_name: ev.host?.display_name ?? null,
      host_avatar_url: ev.host?.avatar_url ?? null,
    }));
  }

  async getUserEvents(
    userId: string,
    status?: 'upcoming' | 'past',
  ): Promise<EventWithHost[]> {
    const supabase = this.supabaseService.getClient();
    const { data: rsvps, error: rsvpErr } = await supabase
      .from('event_rsvps')
      .select('event_id')
      .eq('user_id', userId);
    if (rsvpErr) {
      this.logger.error('Failed to fetch user RSVPs', rsvpErr);
      throw rsvpErr;
    }
    if (!rsvps || rsvps.length === 0) return [];

    const eventIds = rsvps.map((r: { event_id: string }) => r.event_id);
    let q = supabase
      .from('events')
      .select('*, host:host_id(display_name, avatar_url)')
      .in('id', eventIds)
      .order('date_time', { ascending: true });

    const now = new Date().toISOString();
    if (status === 'past') {
      q = q.lt('date_time', now);
    } else {
      q = q.gte('date_time', now);
    }

    const { data, error } = await q;
    if (error) {
      this.logger.error('Failed to fetch user events', error);
      throw error;
    }
    return ((data ?? []) as EventWithHost[]).map((ev: EventWithHost) => ({
      ...ev,
      host_name: ev.host?.display_name ?? null,
      host_avatar_url: ev.host?.avatar_url ?? null,
    }));
  }

  async getEvent(eventId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('events')
      .select('*, host:host_id(display_name, avatar_url)')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Event not found');
    }

    // Fetch RSVP counts
    const { count: attendingCount, error: aErr } = await supabase
      .from('event_rsvps')
      .select('id', { head: true, count: 'exact' })
      .eq('event_id', eventId)
      .eq('status', 'attending');
    if (aErr) {
      this.logger.warn('Failed to fetch attending count', aErr);
    }
    const { count: interestedCount, error: iErr } = await supabase
      .from('event_rsvps')
      .select('id', { head: true, count: 'exact' })
      .eq('event_id', eventId)
      .eq('status', 'interested');
    if (iErr) {
      this.logger.warn('Failed to fetch interested count', iErr);
    }

    const eventRow = data as unknown as EventWithHost;
    return {
      ...eventRow,
      host_name: eventRow.host?.display_name ?? null,
      host_avatar_url: eventRow.host?.avatar_url ?? null,
      attendees_count: attendingCount ?? 0,
      interested_count: interestedCount ?? 0,
    };
  }

  getCategories(): string[] {
    return [
      'audio_room',
      'learning_seminar',
      'in_person_meetup',
      'cultural_exchange',
    ];
  }

  async getUserRsvp(userId: string, eventId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error('Failed to get user RSVP', error);
      throw error;
    }
    return data ?? null;
  }

  async createRsvp(
    userId: string,
    eventId: string,
    status: 'attending' | 'interested',
  ) {
    const supabase = this.supabaseService.getClient();
    // Delete existing RSVP for this user+event, then insert new one
    const { error: deleteError } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (deleteError) {
      this.logger.error('Failed to remove existing RSVP', deleteError);
      throw deleteError;
    }
    const { data, error } = await supabase
      .from('event_rsvps')
      .insert({ event_id: eventId, user_id: userId, status })
      .select()
      .single();
    if (error) {
      this.logger.error('Failed to create RSVP', error);
      throw error;
    }
    return data;
  }

  async removeRsvp(userId: string, eventId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (error) {
      this.logger.error('Failed to remove RSVP', error);
      throw error;
    }
    return { success: true };
  }

  private async checkStartEvents(): Promise<void> {
    try {
      const now = Date.now();
      const tolerance = 5_000; // 5 seconds
      const supabase = this.supabaseService.getClient();

      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, host_id, language_pair, category')
        .eq('is_cancelled', false)
        .not('language_pair', 'is', null)
        .gte('date_time', new Date(now - tolerance).toISOString())
        .lte('date_time', new Date(now + tolerance).toISOString());

      if (error) {
        this.logger.error('Failed to fetch events for room creation', error);
        return;
      }

      if (!events || events.length === 0) return;

      const typedEvents = (events ?? []) as unknown as Array<{
        id: string;
        title: string;
        host_id: string;
        language_pair: string;
        category: string | null;
      }>;

      const roomNames = typedEvents.map(
        (event) => `language_party-${event.id}`,
      );

      const { data: existingRooms, error: roomsCheckErr } = await supabase
        .from('audio_rooms')
        .select('room_name')
        .in('room_name', roomNames);

      if (roomsCheckErr) {
        this.logger.warn('Could not check existing rooms', roomsCheckErr);
        return;
      }

      const existingRoomNames = new Set(
        existingRooms?.map((r) => r.room_name) ?? [],
      );

      const eventsToCreateRoomsFor = typedEvents.filter(
        (event) => !existingRoomNames.has(`language_party-${event.id}`),
      );

      await Promise.allSettled(
        eventsToCreateRoomsFor.map(async (event) => {
          try {
            const roomName = `language_party-${event.id}`;

            // Create the LiveKit audio room via the dedicated service
            const room = await this.audioRoomsService.createRoom(
              event.host_id,
              {
                title: event.title,
                target_language:
                  event.language_pair.split('-')[1] ?? event.language_pair,
                language_pair: event.language_pair,
                topic_tag: event.category ?? event.language_pair,
                is_video_stream: false,
              },
              roomName,
            );

            // Mark the room as a Language Party and link it to the event
            await supabase
              .from('audio_rooms')
              .update({ party_type: 'language_party', event_id: event.id })
              .eq('id', room.id);

            this.logger.log(
              `Audio room created for event ${event.id} (${event.title})`,
            );
          } catch (err) {
            this.logger.error(
              `Failed to create audio room for event ${event.id}`,
              err,
            );
          }
        }),
      );
    } catch (err) {
      this.logger.error('Unexpected error in checkStartEvents', err);
    }
  }
}
