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
  attendees_count?: number;
  interested_count?: number;
  proficiency?: string;
  my_rsvp?: 'attending' | 'interested' | null;
}

export interface EventsQuery {
  language_pair?: string;
  category?: 'audio_room' | 'learning_seminar' | 'in_person_meetup' | 'cultural_exchange';
  status?: 'upcoming' | 'past';
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  proficiency?: 'Beginner' | 'Intermediate' | 'Advanced';
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
    if (query?.proficiency) params['proficiency'] = query.proficiency;
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
    proficiency?: 'Beginner' | 'Intermediate' | 'Advanced';
    mentions?: string[];
  }) {
    return this.http.post<Event>(`${environment.apiUrl}/events`, dto);
  }

  rsvpToEvent(eventId: string, status: 'attending' | 'interested') {
    return this.http.post(`${environment.apiUrl}/events/${eventId}/rsvp`, { status });
  }

  removeRsvp(eventId: string) {
    return this.http.delete(`${environment.apiUrl}/events/${eventId}/rsvp`);
  }

  getUserRsvp(eventId: string) {
    return this.http.get(`${environment.apiUrl}/events/${eventId}/rsvp`);
  }

  getMyEvents(status?: string) {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<Event[]>(`${environment.apiUrl}/events/my`, { params });
  }

  getCategories(): Observable<string[]> {
    const categories = ['audio_room', 'learning_seminar', 'in_person_meetup', 'cultural_exchange'];
    return new Observable((observer) => {
      observer.next(categories);
      observer.complete();
    });
  }
}
