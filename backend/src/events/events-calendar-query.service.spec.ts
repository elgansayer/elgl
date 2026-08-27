import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsCalendarQueryService } from './events-calendar-query.service';
import { SupabaseService } from '../supabase/supabase.service';

interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
}

function createQueryChain(data: unknown, error: unknown = null): QueryChain {
  const chain = {} as QueryChain;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

describe('EventsCalendarQueryService', () => {
  let service: EventsCalendarQueryService;
  let getClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getClient = vi.fn();
    service = new EventsCalendarQueryService({
      getClient,
    } as unknown as SupabaseService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges hosted and RSVP events, deduplicates them, and sorts chronologically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const host = { display_name: 'Host One', avatar_url: 'https://example.com/avatar.jpg' };
    const hostedEvent = {
      id: 'event-hosted',
      title: 'Hosted Event',
      date_time: '2026-08-29T18:00:00.000Z',
      host_id: 'user-1',
      is_cancelled: false,
      host,
    };
    const sharedEvent = {
      id: 'event-shared',
      title: 'Shared Event',
      date_time: '2026-08-28T18:00:00.000Z',
      host_id: 'user-1',
      is_cancelled: false,
      host,
    };
    const rsvpEvent = {
      id: 'event-rsvp',
      title: 'RSVP Event',
      date_time: '2026-08-28T12:00:00.000Z',
      host_id: 'user-2',
      is_cancelled: false,
      host: { display_name: 'Host Two', avatar_url: null },
    };

    const hosted = createQueryChain([hostedEvent, sharedEvent]);
    const rsvps = createQueryChain([{ event: rsvpEvent }, { event: sharedEvent }]);
    const from = vi.fn((table: string) => (table === 'events' ? hosted : rsvps));
    getClient.mockReturnValue({ from });

    const result = await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
      limit: 100,
    });

    expect(result.map((event) => event.id)).toEqual([
      'event-rsvp',
      'event-shared',
      'event-hosted',
    ]);
    expect(result[0]).toMatchObject({
      host_name: 'Host Two',
      host_avatar_url: null,
    });
    expect(result[1]).toMatchObject({
      host_name: 'Host One',
      host_avatar_url: 'https://example.com/avatar.jpg',
    });
    expect(hosted.limit).toHaveBeenCalledWith(100);
    expect(rsvps.limit).toHaveBeenCalledWith(100);
  });

  it('includes hosted events even when the user has no RSVP for them', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([
      {
        id: 'hosted-only',
        title: 'My seminar',
        date_time: '2026-08-30T12:00:00.000Z',
        host_id: 'user-1',
        is_cancelled: false,
      },
    ]);
    const rsvps = createQueryChain([]);
    getClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'events' ? hosted : rsvps)),
    });

    const result = await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('hosted-only');
    expect(hosted.eq).toHaveBeenCalledWith('host_id', 'user-1');
    expect(rsvps.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('clamps the current-month lower bound to now for an upcoming-only calendar', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([]);
    const rsvps = createQueryChain([]);
    getClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'events' ? hosted : rsvps)),
    });

    await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
    });

    expect(hosted.gte).toHaveBeenCalledWith('date_time', '2026-08-27T10:00:00.000Z');
    expect(rsvps.gte).toHaveBeenCalledWith(
      'event.date_time',
      '2026-08-27T10:00:00.000Z',
    );
  });

  it('returns an empty result without querying storage when the requested range has already ended', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    await expect(
      service.getUserCalendarEvents('user-1', {
        from_date: '2026-07-01T00:00:00.000Z',
        to_date: '2026-07-31T23:59:59.999Z',
      }),
    ).resolves.toEqual([]);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('rejects a reversed date range before querying storage', async () => {
    await expect(
      service.getUserCalendarEvents('user-1', {
        from_date: '2026-09-30T23:59:59.999Z',
        to_date: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('caps programmatic callers to 100 events per source query', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([]);
    const rsvps = createQueryChain([]);
    getClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'events' ? hosted : rsvps)),
    });

    await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-27T10:00:00.000Z',
      to_date: '2026-09-30T23:59:59.999Z',
      limit: 999,
    });

    expect(hosted.limit).toHaveBeenCalledWith(100);
    expect(rsvps.limit).toHaveBeenCalledWith(100);
  });

  it('fails closed with a stable unavailable error when either storage query fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([], { message: 'private provider detail' });
    const rsvps = createQueryChain([]);
    getClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'events' ? hosted : rsvps)),
    });

    await expect(
      service.getUserCalendarEvents('user-1', {
        from_date: '2026-08-27T10:00:00.000Z',
        to_date: '2026-08-31T23:59:59.999Z',
      }),
    ).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: 'Calendar unavailable',
    });
  });

  it('drops malformed and cancelled records returned by storage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([
      null,
      { id: 'missing-fields' },
      {
        id: 'cancelled',
        title: 'Cancelled',
        date_time: '2026-08-29T12:00:00.000Z',
        host_id: 'user-1',
        is_cancelled: true,
      },
      {
        id: 'valid',
        title: 'Valid',
        date_time: '2026-08-29T13:00:00.000Z',
        host_id: 'user-1',
        is_cancelled: false,
      },
    ]);
    const rsvps = createQueryChain([{ event: 'not-an-event' }]);
    getClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'events' ? hosted : rsvps)),
    });

    const result = await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-27T10:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
    });

    expect(result.map((event) => event.id)).toEqual(['valid']);
  });
});
