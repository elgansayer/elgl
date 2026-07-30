import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsQueryDto } from './dto/events-query.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createEvent(userId: string, dto: CreateEventDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('events')
      .insert({
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
      .select('*, host:host_id(display_name, avatar_url)')
      .order('date_time', { ascending: true })
      .range(offset, offset + limit - 1);

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
    if (query.to_date) {
      q = q.lte('date_time', query.to_date);
    }

    const { data, error } = await q;
    if (error) {
      this.logger.error('Failed to list events', error);
      throw error;
    }
    return (data ?? []).map((ev: any) => ({
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

    return {
      ...data,
      host_name: data.host?.display_name ?? null,
      host_avatar_url: data.host?.avatar_url ?? null,
      attendees_count: attendingCount ?? 0,
      interested_count: interestedCount ?? 0,
    };
  }

  async getCategories(): Promise<string[]> {
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
}
