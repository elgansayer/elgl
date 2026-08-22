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

export type EventVenueType = 'audio_room' | 'zoom' | 'in_person';

export interface CreateEventRequest {
  title: string;
  description: string;
  category?: string;
  date_time: string;
  venue_type: EventVenueType;
  location: string;
  timezone: string;
  language_pair?: string;
  max_participants?: number;
}

export interface EventsQuery {
  language_pair?: string;
  category?: 'Audio Rooms' | 'Learning Seminars' | 'In-person Meetups' | 'Cultural Exchanges';
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

  createGroupChat(dto: { name: string; description?: string; members: string[] }) {
    return this.http.post<{ id: string }>(`${environment.apiUrl}/group-chats`, dto);
  }

  getGroupChat(chatId: string) {
    return this.http.get<{ id: string; name: string; description?: string; members: string[] }>(
      `${environment.apiUrl}/group-chats/${chatId}`
    );
  }

  updateGroupChat(chatId: string, dto: { name?: string; description?: string; members?: string[] }) {
    return this.http.patch<void>(`${environment.apiUrl}/group-chats/${chatId}`, dto);
  }

  deleteGroupChat(chatId: string) {
    return this.http.delete<void>(`${environment.apiUrl}/group-chats/${chatId}`);
  }

  addLabelToChat(chatId: string, label: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/chats/${chatId}/labels`, { label });
  }

  removeLabelFromChat(chatId: string, label: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/chats/${chatId}/labels/${label}`);
  }

  getEvent(eventId: string) {
    return this.http.get<Event>(`${environment.apiUrl}/events/${eventId}`);
  }

  createEvent(dto: CreateEventRequest) {
    return this.http.post<Event>(`${environment.apiUrl}/events`, dto);
  }

  shareContact(
    targetUserId: string,
  ): Observable<{ phone_number?: string; email?: string }> {
    return this.http.post<{ phone_number?: string; email?: string }>(
      `${environment.apiUrl}/users/me/contact-sharing`,
      { target_user_id: targetUserId },
    );
  }

  getCategories(): Observable<string[]> {
    const categories = ['Audio Rooms', 'Learning Seminars', 'In-person Meetups', 'Cultural Exchanges'];
    return new Observable((observer) => {
      observer.next(categories);
      observer.complete();
    });
  }

  getMyEvents(status?: string) {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<Event[]>(`${environment.apiUrl}/events/my`, { params });
  }

  getRsvp(eventId: string) {
    return this.http.get<{ id?: string; event_id: string; user_id: string; status: string } | null>(
      `${environment.apiUrl}/events/${eventId}/rsvp`,
    );
  }

  rsvp(eventId: string, status: 'attending' | 'interested') {
    return this.http.post<{ id: string; event_id: string; user_id: string; status: string }>(
      `${environment.apiUrl}/events/${eventId}/rsvp`,
      { status },
    );
  }

  removeRsvp(eventId: string) {
    return this.http.delete<void>(`${environment.apiUrl}/events/${eventId}/rsvp`);
  }
}
