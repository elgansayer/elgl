import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export const EVENT_CATEGORIES = [
  'audio_room',
  'learning_seminar',
  'in_person_meetup',
  'cultural_exchange',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventProficiency = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  category?: EventCategory | null;
  date_time: string;
  location?: string | null;
  host_id: string;
  language_pair?: string | null;
  proficiency?: EventProficiency | null;
  max_participants?: number | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  host_name?: string | null;
  host_avatar_url?: string | null;
  participants_count?: number;
  attendees_count?: number;
  interested_count?: number;
}

export interface EventsQuery {
  language_pair?: string;
  category?: EventCategory;
  status?: 'upcoming' | 'past';
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  proficiency?: EventProficiency;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);

  listEvents(query?: EventsQuery): Observable<Event[]> {
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
      `${environment.apiUrl}/group-chats/${chatId}`,
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

  getEvent(eventId: string): Observable<Event> {
    return this.http.get<Event>(`${environment.apiUrl}/events/${eventId}`);
  }

  createEvent(dto: {
    title: string;
    description?: string;
    category?: EventCategory;
    date_time: string;
    location?: string;
    language_pair?: string;
    max_participants?: number;
    mentions?: string[];
  }): Observable<Event> {
    return this.http.post<Event>(`${environment.apiUrl}/events`, dto);
  }

  shareContact(targetUserId: string): Observable<{ phone_number?: string; email?: string }> {
    return this.http.post<{ phone_number?: string; email?: string }>(
      `${environment.apiUrl}/users/me/contact-sharing`,
      { target_user_id: targetUserId },
    );
  }

  getCategories(): Observable<EventCategory[]> {
    return this.http.get<EventCategory[]>(`${environment.apiUrl}/events/categories`);
  }

  getMyEvents(status?: string): Observable<Event[]> {
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
