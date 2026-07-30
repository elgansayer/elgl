import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface Event {
  id: string;
  title: string;
  description?: string;
  category?: string;
  date_time: string;
  location?: string;
  host_id: string;
  language_pair?: string;
  max_participants?: number;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  host_name?: string;
  host_avatar_url?: string;
  participants_count?: number;
}

export interface EventsQuery {
  language_pair?: string;
  category?: string;
  status?: 'upcoming' | 'past';
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private http = inject(HttpClient);

  listEvents(query?: EventsQuery) {
    const params: Record<string, string | number> = {};
    if (query?.language_pair) params['language_pair'] = query.language_pair;
    if (query?.category) params['category'] = query.category;
    if (query?.status) params['status'] = query.status;
    if (query?.from_date) params['from_date'] = query.from_date;
    if (query?.to_date) params['to_date'] = query.to_date;
    if (query?.page) params['page'] = query.page;
    if (query?.limit) params['limit'] = query.limit;
    return this.http.get<Event[]>(`${environment.apiUrl}/events`, { params });
  }

  getEvent(eventId: string) {
    return this.http.get<Event>(`${environment.apiUrl}/events/${eventId}`);
  }

  createEvent(dto: {
    title: string;
    description?: string;
    category?: string;
    date_time: string;
    location?: string;
    language_pair?: string;
    max_participants?: number;
  }) {
    return this.http.post<Event>(`${environment.apiUrl}/events`, dto);
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${environment.apiUrl}/events/categories`);
  }
}
