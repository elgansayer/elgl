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
    return {
      ...data,
      host_name: data.host?.display_name ?? null,
      host_avatar_url: data.host?.avatar_url ?? null,
    };
  }
}
