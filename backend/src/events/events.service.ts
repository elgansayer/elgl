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

interface EventReminderClaim {
  reminder_id: string;
  event_id: string;
  user_id: string;
  event_title: string;
  event_date_time: string;
  attempt_count: number;
}

interface ReminderRpcResult {
  data: unknown;
  error: { message?: string } | null;
}

interface ReminderRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<ReminderRpcResult>;
}

const REMINDER_BATCH_SIZE = 200;
const REMINDER_MAX_BATCHES_PER_TICK = 5;
const REMINDER_LEASE_SECONDS = 120;
const REMINDER_SEND_CONCURRENCY = 25;
const REMINDER_RETRY_DELAY_MS = 60_000;
const REMINDER_TITLE_MAX_LENGTH = 80;

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
    // Run once at startup so a restart does not force users to wait for the
    // first interval tick, then continue scanning every minute.
    void this.checkReminders();
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
   * Claims due reminder work atomically in Postgres and dispatches it in
   * bounded batches. The database lease prevents duplicate work across API
   * replicas while still allowing a crashed worker to be retried.
   */
  private async checkReminders(): Promise<void> {
    const startedAt = Date.now();
    let processed = 0;

    try {
      for (
        let batch = 0;
        batch < REMINDER_MAX_BATCHES_PER_TICK;
        batch += 1
      ) {
        const claims = await this.claimDueReminders();
        if (claims.length === 0) break;

        processed += claims.length;
        await this.dispatchReminderClaims(claims);

        if (claims.length < REMINDER_BATCH_SIZE) break;
      }

      if (processed > 0) {
        this.logger.log(
          `Event reminder dispatch completed count=${processed} duration_ms=${Date.now() - startedAt}`,
        );
      }
    } catch {
      // Keep scheduler ticks isolated: a database/provider outage must not
      // terminate the process or stop future retry attempts.
      this.logger.error('Event reminder dispatch tick failed');
    }
  }

  private async claimDueReminders(): Promise<EventReminderClaim[]> {
    const rpcClient =
      this.supabaseService.getClient() as unknown as ReminderRpcClient;
    const { data, error } = await rpcClient.rpc('claim_due_event_reminders', {
      p_now: new Date().toISOString(),
      p_limit: REMINDER_BATCH_SIZE,
      p_lease_seconds: REMINDER_LEASE_SECONDS,
    });

    if (error) {
      this.logger.warn('Could not claim due event reminders');
      throw new Error('Unable to claim due event reminders');
    }

    if (!Array.isArray(data)) return [];

    return data.filter(
      (value): value is EventReminderClaim =>
        this.isValidReminderClaim(value),
    );
  }

  private isValidReminderClaim(value: unknown): value is EventReminderClaim {
    if (!value || typeof value !== 'object') return false;
    const claim = value as Partial<EventReminderClaim>;
    return (
      typeof claim.reminder_id === 'string' &&
      claim.reminder_id.length > 0 &&
      typeof claim.event_id === 'string' &&
      claim.event_id.length > 0 &&
      typeof claim.user_id === 'string' &&
      claim.user_id.length > 0 &&
      typeof claim.event_title === 'string' &&
      typeof claim.event_date_time === 'string' &&
      Number.isFinite(Date.parse(claim.event_date_time)) &&
      typeof claim.attempt_count === 'number' &&
      Number.isInteger(claim.attempt_count) &&
      claim.attempt_count >= 1
    );
  }

  private async dispatchReminderClaims(
    claims: EventReminderClaim[],
  ): Promise<void> {
    for (let offset = 0; offset < claims.length; offset += REMINDER_SEND_CONCURRENCY) {
      const chunk = claims.slice(offset, offset + REMINDER_SEND_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (claim) => {
          const eventTitle = this.formatReminderEventTitle(claim.event_title);
          const minutesUntilStart = Math.max(
            1,
            Math.ceil(
              (Date.parse(claim.event_date_time) - Date.now()) / 60_000,
            ),
          );
          const minuteLabel = minutesUntilStart === 1 ? 'minute' : 'minutes';

          await this.notificationsService.sendPushNotification(claim.user_id, {
            type: 'event_reminder',
            title: `Event Reminder: ${eventTitle}`,
            body: `Your event "${eventTitle}" starts in ${minutesUntilStart} ${minuteLabel}.`,
            category: 'groups',
            data: {
              eventId: claim.event_id,
              route: `/events/${claim.event_id}`,
              startsAt: claim.event_date_time,
            },
          });

          return claim.reminder_id;
        }),
      );

      const sentIds: string[] = [];
      const retryIds: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sentIds.push(result.value);
        } else {
          retryIds.push(chunk[index].reminder_id);
        }
      });

      await Promise.all([
        this.markReminderBatchSent(sentIds),
        this.releaseReminderBatchForRetry(retryIds),
      ]);
    }
  }

  private formatReminderEventTitle(title: string): string {
    const normalized = title.replace(/\s+/g, ' ').trim();
    if (!normalized) return 'Learning event';
    return normalized.slice(0, REMINDER_TITLE_MAX_LENGTH);
  }

  private async markReminderBatchSent(reminderIds: string[]): Promise<void> {
    if (reminderIds.length === 0) return;

    const now = new Date().toISOString();
    const { error } = await this.supabaseService
      .getClient()
      .from('event_reminders_sent')
      .update({
        status: 'sent',
        sent_at: now,
        claimed_at: null,
        next_attempt_at: null,
        updated_at: now,
      })
      .in('id', reminderIds)
      .eq('status', 'pending');

    if (error) {
      // The lease will expire and the reminder will be retried. Avoid logging
      // IDs or event content because this is internal per-user delivery state.
      this.logger.warn('Could not finalize event reminder deliveries');
    }
  }

  private async releaseReminderBatchForRetry(
    reminderIds: string[],
  ): Promise<void> {
    if (reminderIds.length === 0) return;

    const now = new Date();
    const { error } = await this.supabaseService
      .getClient()
      .from('event_reminders_sent')
      .update({
        claimed_at: null,
        next_attempt_at: new Date(
          now.getTime() + REMINDER_RETRY_DELAY_MS,
        ).toISOString(),
        updated_at: now.toISOString(),
      })
      .in('id', reminderIds)
      .eq('status', 'pending');

    if (error) {
      this.logger.warn('Could not release failed event reminders for retry');
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

    // Fetch RSVP counts concurrently
    // ⚡ Bolt Optimization: Grouped sequential database queries into a concurrent Promise.all execution to reduce latency.
    const [attendingRes, interestedRes] = await Promise.all([
      supabase
        .from('event_rsvps')
        .select('id', { head: true, count: 'exact' })
        .eq('event_id', eventId)
        .eq('status', 'attending'),
      supabase
        .from('event_rsvps')
        .select('id', { head: true, count: 'exact' })
        .eq('event_id', eventId)
        .eq('status', 'interested'),
    ]);
    const { count: attendingCount, error: aErr } = attendingRes;
    const { count: interestedCount, error: iErr } = interestedRes;

    if (aErr) {
      this.logger.warn('Failed to fetch attending count', aErr);
    }
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
