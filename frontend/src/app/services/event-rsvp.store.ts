import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  EventRsvpStatus,
  EventRsvpSummary,
  EventsService,
} from './events.service';

export type EventRsvpError = 'full' | 'unavailable' | null;

export interface EventRsvpState {
  status: EventRsvpStatus | null;
  attendingCount: number;
  interestedCount: number;
  loaded: boolean;
  loading: boolean;
  pending: boolean;
  error: EventRsvpError;
}

const EMPTY_STATE: EventRsvpState = {
  status: null,
  attendingCount: 0,
  interestedCount: 0,
  loaded: false,
  loading: false,
  pending: false,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class EventRsvpStore {
  private readonly eventsService = inject(EventsService);
  private readonly states = signal<Record<string, EventRsvpState>>({});
  private readonly queuedEventIds = new Set<string>();
  private readonly operationIds = new Map<string, number>();
  private flushScheduled = false;
  private operationSequence = 0;

  readonly snapshot = this.states.asReadonly();

  state(eventId: string): EventRsvpState {
    return this.states()[eventId] ?? EMPTY_STATE;
  }

  ensureLoaded(eventId: string): void {
    const current = this.state(eventId);
    if (current.loaded || current.loading || this.queuedEventIds.has(eventId)) return;

    this.patch(eventId, { loading: true, error: null });
    this.queuedEventIds.add(eventId);
    this.scheduleFlush();
  }

  async setStatus(eventId: string, status: EventRsvpStatus): Promise<void> {
    const current = this.state(eventId);
    if (!current.loaded || current.loading || current.pending || current.status === status) return;

    const operationId = this.beginOperation(eventId);
    const previous = { ...current };
    this.states.update((states) => ({
      ...states,
      [eventId]: {
        ...this.applyStatusTransition(current, status),
        pending: true,
        error: null,
      },
    }));

    try {
      await firstValueFrom(this.eventsService.rsvp(eventId, status));
      if (!this.isCurrentOperation(eventId, operationId)) return;
      await this.reconcile(eventId, operationId);
    } catch (error) {
      if (!this.isCurrentOperation(eventId, operationId)) return;
      this.states.update((states) => ({
        ...states,
        [eventId]: {
          ...previous,
          pending: false,
          error: this.classifyMutationError(error),
        },
      }));
    }
  }

  async clear(eventId: string): Promise<void> {
    const current = this.state(eventId);
    if (!current.loaded || current.loading || current.pending || current.status === null) return;

    const operationId = this.beginOperation(eventId);
    const previous = { ...current };
    this.states.update((states) => ({
      ...states,
      [eventId]: {
        ...this.applyStatusTransition(current, null),
        pending: true,
        error: null,
      },
    }));

    try {
      await firstValueFrom(this.eventsService.removeRsvp(eventId));
      if (!this.isCurrentOperation(eventId, operationId)) return;
      await this.reconcile(eventId, operationId);
    } catch (error) {
      if (!this.isCurrentOperation(eventId, operationId)) return;
      this.states.update((states) => ({
        ...states,
        [eventId]: {
          ...previous,
          pending: false,
          error: this.classifyMutationError(error),
        },
      }));
    }
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    void Promise.resolve().then(() => this.flushLoadQueue());
  }

  private async flushLoadQueue(): Promise<void> {
    this.flushScheduled = false;
    const eventIds = [...this.queuedEventIds].slice(0, 50);
    eventIds.forEach((eventId) => this.queuedEventIds.delete(eventId));
    if (eventIds.length === 0) return;

    try {
      const summaries = await firstValueFrom(this.eventsService.getRsvpSummaries(eventIds));
      const byEventId = new Map(summaries.map((summary) => [summary.event_id, summary]));

      this.states.update((states) => {
        const next = { ...states };
        for (const eventId of eventIds) {
          const current = next[eventId] ?? EMPTY_STATE;
          if (current.pending) continue;
          next[eventId] = this.fromSummary(byEventId.get(eventId), current);
        }
        return next;
      });
    } catch {
      this.states.update((states) => {
        const next = { ...states };
        for (const eventId of eventIds) {
          const current = next[eventId] ?? EMPTY_STATE;
          if (current.pending) continue;
          next[eventId] = {
            ...current,
            loading: false,
            loaded: false,
            error: 'unavailable',
          };
        }
        return next;
      });
    } finally {
      if (this.queuedEventIds.size > 0) this.scheduleFlush();
    }
  }

  private fromSummary(
    summary: EventRsvpSummary | undefined,
    current: EventRsvpState,
  ): EventRsvpState {
    return {
      status: summary?.viewer_status ?? null,
      attendingCount: summary?.attending_count ?? 0,
      interestedCount: summary?.interested_count ?? 0,
      loaded: true,
      loading: false,
      pending: current.pending,
      error: null,
    };
  }

  private async reconcile(eventId: string, operationId: number): Promise<void> {
    try {
      const summaries = await firstValueFrom(this.eventsService.getRsvpSummaries([eventId]));
      if (!this.isCurrentOperation(eventId, operationId)) return;
      const summary = summaries.find((item) => item.event_id === eventId);
      const current = this.state(eventId);
      this.states.update((states) => ({
        ...states,
        [eventId]: summary
          ? this.fromSummary(summary, { ...current, pending: false })
          : { ...current, pending: false, error: null },
      }));
    } catch {
      if (!this.isCurrentOperation(eventId, operationId)) return;
      this.patch(eventId, { pending: false, error: null });
    }
  }

  private applyStatusTransition(
    current: EventRsvpState,
    nextStatus: EventRsvpStatus | null,
  ): EventRsvpState {
    let attendingCount = current.attendingCount;
    let interestedCount = current.interestedCount;

    if (current.status === 'attending') attendingCount = Math.max(0, attendingCount - 1);
    if (current.status === 'interested') interestedCount = Math.max(0, interestedCount - 1);
    if (nextStatus === 'attending') attendingCount += 1;
    if (nextStatus === 'interested') interestedCount += 1;

    return {
      ...current,
      status: nextStatus,
      attendingCount,
      interestedCount,
      loaded: true,
      loading: false,
    };
  }

  private classifyMutationError(error: unknown): EventRsvpError {
    return error instanceof HttpErrorResponse && error.status === 409 ? 'full' : 'unavailable';
  }

  private beginOperation(eventId: string): number {
    const operationId = ++this.operationSequence;
    this.operationIds.set(eventId, operationId);
    return operationId;
  }

  private isCurrentOperation(eventId: string, operationId: number): boolean {
    return this.operationIds.get(eventId) === operationId;
  }

  private patch(eventId: string, patch: Partial<EventRsvpState>): void {
    this.states.update((states) => ({
      ...states,
      [eventId]: { ...(states[eventId] ?? EMPTY_STATE), ...patch },
    }));
  }
}
