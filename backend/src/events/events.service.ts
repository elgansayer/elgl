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

interface ReminderStateResult {
  error: { message?: string } | null;
}

interface ReminderStateEqBuilder {
  eq(column: 'status', value: 'pending'): PromiseLike<ReminderStateResult>;
}

interface ReminderStateInBuilder {
  in(column: 'id', values: string[]): ReminderStateEqBuilder;
}

interface ReminderStateTable {
  update(values: Record<string, string | null>): ReminderStateInBuilder;
}

interface ReminderStateClient {
  from(table: 'event_reminders_sent'): ReminderStateTable;
}

interface ScheduledLanguagePartyEvent {
  id: string;
  title: string;
  host_id: string;
  language_pair: string;
  date_time: string;
}

interface ScheduledLanguagePartyRoom {
  id: string;
  room_name: string;
  event_id: string | null;
  party_type: string | null;
}

type ScheduledLanguagePartyResult = 'created' | 'recovered';

const REMINDER_BATCH_SIZE = 200;
const REMINDER_MAX_BATCHES_PER_TICK = 5;
const REMINDER_LEASE_SECONDS = 120;
const REMINDER_SEND_CONCURRENCY = 25;
const REMINDER_RETRY_DELAY_MS = 60_000;
const REMINDER_TITLE_MAX_LENGTH = 80;

const SCHEDULED_PARTY_POLL_INTERVAL_MS = 10_000;
const SCHEDULED_PARTY_CATCHUP_MS = 30 * 60_000;
const SCHEDULED_PARTY_BATCH_SIZE = 50;
const SCHEDULED_PARTY_CONCURRENCY = 10;

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

    // Scheduled Language Parties use the same catch-up-on-startup pattern. The
    // bounded catch-up window prevents a short deployment/provider outage from
    // permanently missing an event whose exact start second elapsed.
    void this.checkStartEvents();
    this.intervalId2 = setInterval(
      () => void this.checkStartEvents(),
      SCHEDULED_PARTY_POLL_INTERVAL_MS,
    );
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
      for (let batch = 0; batch < REMINDER_MAX_BATCHES_PER_TICK; batch += 1) {
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

    return data.filter((value): value is EventReminderClaim =>
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
    for (
      let offset = 0;
      offset < claims.length;
      offset += REMINDER_SEND_CONCURRENCY
    ) {
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

          const dispatchResult =
            await this.notificationsService.sendPushNotification(
              claim.user_id,
              {
                type: 'event_reminder',
                title: `Event Reminder: ${eventTitle}`,
                body: `Your event "${eventTitle}" starts in ${minutesUntilStart} ${minuteLabel}.`,
                category: 'groups',
                data: {
                  eventId: claim.event_id,
                  route: `/events/${claim.event_id}`,
                  startsAt: claim.event_date_time,
                },
              },
            );

          if (dispatchResult === 'retry') {
            throw new Error('Push dispatch requested retry');
          }

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

  private getReminderStateClient(): ReminderStateClient {
    const client: unknown = this.supabaseService.getClient();
    return client as ReminderStateClient;
  }

  private async markReminderBatchSent(reminderIds: string[]): Promise<void> {
    if (reminderIds.length === 0) return;

    const now = new Date().toISOString();
    const { error } = await this.getReminderStateClient()
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
    const { error } = await this.getReminderStateClient()
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

  /**
   * Converts due audio-room events into discoverable Language Parties.
   *
   * The deterministic room name plus the database uniqueness constraints make
   * this retry-safe across API replicas. A short catch-up window is deliberate:
   * deployments and temporary provider outages may delay room creation, but an
   * old event must not unexpectedly create a room hours or days later.
   */
  private async checkStartEvents(): Promise<void> {
    const startedAt = Date.now();
    const now = new Date();
    const supabase = this.supabaseService.getClient();

    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, host_id, language_pair, date_time')
        .eq('is_cancelled', false)
        .eq('category', 'audio_room')
        .not('language_pair', 'is', null)
        .gte(
          'date_time',
          new Date(now.getTime() - SCHEDULED_PARTY_CATCHUP_MS).toISOString(),
        )
        .lte('date_time', now.toISOString())
        .order('date_time', { ascending: true })
        .limit(SCHEDULED_PARTY_BATCH_SIZE);

      if (error) {
        this.logger.warn('Scheduled Language Party event scan failed');
        return;
      }

      const dueEvents = (Array.isArray(events) ? events : []).filter(
        (event): event is ScheduledLanguagePartyEvent =>
          this.isValidScheduledLanguagePartyEvent(event),
      );
      if (dueEvents.length === 0) return;

      const roomNames = dueEvents.map((event) => this.roomNameForEvent(event.id));
      const { data: existingRooms, error: roomsError } = await supabase
        .from('audio_rooms')
        .select('id, room_name, event_id, party_type')
        .in('room_name', roomNames);

      if (roomsError) {
        this.logger.warn('Scheduled Language Party room lookup failed');
        return;
      }

      const existingByName = new Map<string, ScheduledLanguagePartyRoom>();
      for (const value of Array.isArray(existingRooms) ? existingRooms : []) {
        if (this.isValidScheduledLanguagePartyRoom(value)) {
          existingByName.set(value.room_name, value);
        }
      }

      let createdCount = 0;
      let recoveredCount = 0;
      let failedCount = 0;

      for (
        let offset = 0;
        offset < dueEvents.length;
        offset += SCHEDULED_PARTY_CONCURRENCY
      ) {
        const chunk = dueEvents.slice(
          offset,
          offset + SCHEDULED_PARTY_CONCURRENCY,
        );
        const results = await Promise.allSettled(
          chunk.map((event) =>
            this.ensureScheduledLanguageParty(event, existingByName),
          ),
        );

        for (const result of results) {
          if (result.status === 'rejected') {
            failedCount += 1;
          } else if (result.value === 'created') {
            createdCount += 1;
          } else {
            recoveredCount += 1;
          }
        }
      }

      if (createdCount + recoveredCount + failedCount > 0) {
        this.logger.log(
          `Scheduled Language Party tick created=${createdCount} recovered=${recoveredCount} failed=${failedCount} duration_ms=${Date.now() - startedAt}`,
        );
      }
    } catch {
      // Never let one scheduler tick terminate the process. The next tick can
      // retry while the event remains inside the bounded catch-up window.
      this.logger.error('Scheduled Language Party tick failed');
    }
  }

  private isValidScheduledLanguagePartyEvent(
    value: unknown,
  ): value is ScheduledLanguagePartyEvent {
    if (!value || typeof value !== 'object') return false;
    const event = value as Partial<ScheduledLanguagePartyEvent>;
    return (
      typeof event.id === 'string' &&
      event.id.length > 0 &&
      typeof event.title === 'string' &&
      event.title.trim().length > 0 &&
      typeof event.host_id === 'string' &&
      event.host_id.length > 0 &&
      typeof event.language_pair === 'string' &&
      event.language_pair.trim().length > 0 &&
      typeof event.date_time === 'string' &&
      Number.isFinite(Date.parse(event.date_time))
    );
  }

  private isValidScheduledLanguagePartyRoom(
    value: unknown,
  ): value is ScheduledLanguagePartyRoom {
    if (!value || typeof value !== 'object') return false;
    const room = value as Partial<ScheduledLanguagePartyRoom>;
    return (
      typeof room.id === 'string' &&
      room.id.length > 0 &&
      typeof room.room_name === 'string' &&
      room.room_name.length > 0 &&
      (room.event_id === null || typeof room.event_id === 'string') &&
      (room.party_type === null || typeof room.party_type === 'string')
    );
  }

  private roomNameForEvent(eventId: string): string {
    return `language_party-${eventId}`;
  }

  private async ensureScheduledLanguageParty(
    event: ScheduledLanguagePartyEvent,
    existingByName: Map<string, ScheduledLanguagePartyRoom>,
  ): Promise<ScheduledLanguagePartyResult> {
    const roomName = this.roomNameForEvent(event.id);
    const existing = existingByName.get(roomName);

    if (existing) {
      await this.reconcileScheduledLanguageParty(existing, event.id);
      return 'recovered';
    }

    try {
      const room = await this.audioRoomsService.createLanguageParty(
        event.host_id,
        {
          title: event.title,
          language_pair: event.language_pair,
          topic_tag: event.language_pair,
          is_video_stream: false,
        },
        roomName,
      );

      await this.linkRoomToEvent(room.id, event.id);
      existingByName.set(roomName, {
        id: room.id,
        room_name: roomName,
        event_id: event.id,
        party_type: 'language_party',
      });
      return 'created';
    } catch {
      // Another API replica may have won the deterministic room-name race, or
      // creation may have succeeded just before a transient response failure.
      // Recover only a room with the exact event-derived name.
      const recovered = await this.findRoomByName(roomName);
      if (!recovered) {
        throw new Error('Scheduled Language Party creation failed');
      }

      await this.reconcileScheduledLanguageParty(recovered, event.id);
      existingByName.set(roomName, {
        ...recovered,
        event_id: event.id,
        party_type: 'language_party',
      });
      return 'recovered';
    }
  }

  private async reconcileScheduledLanguageParty(
    room: ScheduledLanguagePartyRoom,
    eventId: string,
  ): Promise<void> {
    // A deterministic room name linked to a different event is corrupted state.
    // Never silently transfer it between events.
    if (room.event_id && room.event_id !== eventId) {
      throw new Error('Scheduled Language Party room ownership conflict');
    }

    if (room.event_id === eventId && room.party_type === 'language_party') {
      return;
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('audio_rooms')
      .update({ event_id: eventId, party_type: 'language_party' })
      .eq('id', room.id);

    if (error) {
      throw new Error('Scheduled Language Party reconciliation failed');
    }
  }

  private async linkRoomToEvent(roomId: string, eventId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('audio_rooms')
      .update({ event_id: eventId, party_type: 'language_party' })
      .eq('id', roomId);

    if (error) {
      throw new Error('Scheduled Language Party link failed');
    }
  }

  private async findRoomByName(
    roomName: string,
  ): Promise<ScheduledLanguagePartyRoom | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('audio_rooms')
      .select('id, room_name, event_id, party_type')
      .eq('room_name', roomName)
      .maybeSingle();

    if (error || !this.isValidScheduledLanguagePartyRoom(data)) {
      return null;
    }
    return data;
  }
}
