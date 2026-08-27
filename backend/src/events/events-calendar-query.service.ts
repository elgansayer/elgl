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

    const hostedRequest = client
      .from('events')
      .select('*, host:host_id(display_name, avatar_url)')
      .eq('host_id', userId)
      .eq('is_cancelled', false)
      .gte('date_time', fromDate)
      .lte('date_time', toDate)
      .order('date_time', { ascending: true })
      .limit(limit);

    const rsvpRequest = client
      .from('event_rsvps')
      .select('event:events!inner(*, host:host_id(display_name, avatar_url))')
      .eq('user_id', userId)
      .eq('event.is_cancelled', false)
      .gte('event.date_time', fromDate)
      .lte('event.date_time', toDate)
      .limit(limit);

    let hostedResult: CalendarQueryResult;
    let rsvpResult: CalendarQueryResult;
    try {
      [hostedResult, rsvpResult] = (await Promise.all([
        hostedRequest,
        rsvpRequest,
      ])) as [CalendarQueryResult, CalendarQueryResult];
    } catch {
      this.logger.warn('User events calendar query failed');
      throw new ServiceUnavailableException('Calendar unavailable');
    }

    if (hostedResult.error || rsvpResult.error) {
      this.logger.warn('User events calendar query failed');
      throw new ServiceUnavailableException('Calendar unavailable');
    }

    const byId = new Map<string, CalendarEventRecord>();
    for (const candidate of this.extractHostedEvents(hostedResult.data)) {
      byId.set(candidate.id, candidate);
    }
    for (const candidate of this.extractRsvpEvents(rsvpResult.data)) {
      byId.set(candidate.id, candidate);
    }

    return [...byId.values()]
      .filter((event) => event.is_cancelled !== true)
      .sort((a, b) => Date.parse(a.date_time) - Date.parse(b.date_time))
      .slice(0, limit)
      .map((event) => this.toPublicEvent(event));
  }

  private extractHostedEvents(data: unknown): CalendarEventRecord[] {
    if (!Array.isArray(data)) return [];
    return data
      .map((value) => this.asEvent(value))
      .filter((value): value is CalendarEventRecord => value !== null);
  }

  private extractRsvpEvents(data: unknown): CalendarEventRecord[] {
    if (!Array.isArray(data)) return [];
    const events: CalendarEventRecord[] = [];
    for (const row of data) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const rawEvent = (row as Record<string, unknown>)['event'];
      const candidate = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
      const event = this.asEvent(candidate);
      if (event) events.push(event);
    }
    return events;
  }

  private asEvent(value: unknown): CalendarEventRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
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
      host_name: typeof host?.['display_name'] === 'string' ? host['display_name'] : null,
      host_avatar_url: typeof host?.['avatar_url'] === 'string' ? host['avatar_url'] : null,
    };
  }
}
