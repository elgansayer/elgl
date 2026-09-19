import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CalendarEventsQueryDto } from './dto/calendar-events-query.dto';

interface CalendarEventRecord {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  date_time: string;
  location?: string | null;
  language_pair?: string | null;
  max_participants?: number | null;
  host_id: string;
  is_cancelled?: boolean;
  created_at?: string;
  updated_at?: string;
  host?: unknown;
  [key: string]: unknown;
}

interface CalendarQueryResult {
  data: unknown;
  error: unknown;
}

const DEFAULT_CALENDAR_LIMIT = 100;
const MAX_CALENDAR_LIMIT = 100;

@Injectable()
export class EventsCalendarQueryService {
  private readonly logger = new Logger(EventsCalendarQueryService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getUserCalendarEvents(userId: string, query: CalendarEventsQueryDto) {
    const fromMs = Date.parse(query.from_date);
    const toMs = Date.parse(query.to_date);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      throw new BadRequestException('Invalid calendar date range');
    }

    // The calendar is intentionally upcoming-only. For the current month,
    // clamp the lower bound to now so already-finished events do not reappear.
    const lowerMs = Math.max(fromMs, Date.now());
    if (lowerMs > toMs) return [];

    const fromDate = new Date(lowerMs).toISOString();
    const toDate = new Date(toMs).toISOString();
    const limit = Math.min(
      query.limit ?? DEFAULT_CALENDAR_LIMIT,
      MAX_CALENDAR_LIMIT,
    );
    const client = this.supabaseService.getClient();

    try {
      const [hostedResult, rsvpResult] = (await Promise.all([
        client
          .from('events')
          .select('*, host:host_id(display_name, avatar_url)')
          .eq('host_id', userId)
          .eq('is_cancelled', false)
          .gte('date_time', fromDate)
          .lte('date_time', toDate)
          .order('date_time', { ascending: true })
          .limit(limit),
        client
          .from('event_rsvps')
          .select('event_id')
          .eq('user_id', userId)
          .limit(limit),
      ])) as [CalendarQueryResult, CalendarQueryResult];

      if (hostedResult.error || rsvpResult.error) {
        throw new Error('calendar source unavailable');
      }

      const rsvpIds = this.extractRsvpIds(rsvpResult.data);
      let rsvpEvents: CalendarEventRecord[] = [];
      if (rsvpIds.length > 0) {
        const rsvpEventsResult = (await client
          .from('events')
          .select('*, host:host_id(display_name, avatar_url)')
          .in('id', rsvpIds)
          .eq('is_cancelled', false)
          .gte('date_time', fromDate)
          .lte('date_time', toDate)
          .order('date_time', { ascending: true })
          .limit(limit)) as CalendarQueryResult;

        if (rsvpEventsResult.error) {
          throw new Error('calendar event lookup unavailable');
        }
        rsvpEvents = this.extractEvents(rsvpEventsResult.data);
      }

      const byId = new Map<string, CalendarEventRecord>();
      for (const candidate of this.extractEvents(hostedResult.data)) {
        byId.set(candidate.id, candidate);
      }
      for (const candidate of rsvpEvents) {
        byId.set(candidate.id, candidate);
      }

      return [...byId.values()]
        .filter((event) => event.is_cancelled !== true)
        .sort((a, b) => Date.parse(a.date_time) - Date.parse(b.date_time))
        .slice(0, limit)
        .map((event) => this.toPublicEvent(event));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn('User events calendar query failed');
      throw new ServiceUnavailableException('Calendar unavailable');
    }
  }

  private extractRsvpIds(data: unknown): string[] {
    if (!Array.isArray(data)) return [];
    const ids = new Set<string>();
    for (const row of data) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const id = (row as Record<string, unknown>)['event_id'];
      if (typeof id === 'string' && id.length > 0) ids.add(id);
    }
    return [...ids].slice(0, MAX_CALENDAR_LIMIT);
  }

  private extractEvents(data: unknown): CalendarEventRecord[] {
    if (!Array.isArray(data)) return [];
    return data
      .map((value) => this.asEvent(value))
      .filter((value): value is CalendarEventRecord => value !== null);
  }

  private asEvent(value: unknown): CalendarEventRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const event = value as Record<string, unknown>;
    if (
      typeof event['id'] !== 'string' ||
      !event['id'] ||
      typeof event['title'] !== 'string' ||
      typeof event['date_time'] !== 'string' ||
      !Number.isFinite(Date.parse(event['date_time'])) ||
      typeof event['host_id'] !== 'string'
    ) {
      return null;
    }
    return event as CalendarEventRecord;
  }

  private toPublicEvent(event: CalendarEventRecord) {
    const rawHost = Array.isArray(event.host) ? event.host[0] : event.host;
    const host =
      rawHost && typeof rawHost === 'object' && !Array.isArray(rawHost)
        ? (rawHost as Record<string, unknown>)
        : null;
    const { host: _host, ...rest } = event;
    return {
      ...rest,
      host_name:
        typeof host?.['display_name'] === 'string'
          ? host['display_name']
          : null,
      host_avatar_url:
        typeof host?.['avatar_url'] === 'string' ? host['avatar_url'] : null,
    };
  }
}
