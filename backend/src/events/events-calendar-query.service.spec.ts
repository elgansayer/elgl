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
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
}

function createQueryChain(data: unknown, error: unknown = null): QueryChain {
  const chain = {} as QueryChain;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

function createClient(
  hosted: QueryChain,
  rsvpIds: QueryChain,
  rsvpEvents?: QueryChain,
) {
  let eventsCalls = 0;
  const from = vi.fn((table: string) => {
    if (table === 'event_rsvps') return rsvpIds;
    const result = eventsCalls === 0 ? hosted : (rsvpEvents ?? hosted);
    eventsCalls += 1;
    return result;
  });
  return { from };
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

    const host = {
      display_name: 'Host One',
      avatar_url: 'https://example.com/avatar.jpg',
    };
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
    const rsvpIds = createQueryChain([
      { event_id: 'event-rsvp' },
      { event_id: 'event-shared' },
      { event_id: 'event-rsvp' },
    ]);
    const rsvpEvents = createQueryChain([rsvpEvent, sharedEvent]);
    getClient.mockReturnValue(createClient(hosted, rsvpIds, rsvpEvents));

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
    expect(rsvpEvents.in).toHaveBeenCalledWith('id', [
      'event-rsvp',
      'event-shared',
    ]);
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
    const rsvpIds = createQueryChain([]);
    const client = createClient(hosted, rsvpIds);
    getClient.mockReturnValue(client);

    const result = await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('hosted-only');
    expect(hosted.eq).toHaveBeenCalledWith('host_id', 'user-1');
    expect(rsvpIds.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it('clamps the current-month lower bound to now for an upcoming-only calendar', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([]);
    const rsvpIds = createQueryChain([]);
    getClient.mockReturnValue(createClient(hosted, rsvpIds));

    await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
    });

    expect(hosted.gte).toHaveBeenCalledWith(
      'date_time',
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

  it('caps programmatic callers to 100 rows per source query', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([]);
    const rsvpIds = createQueryChain([]);
    getClient.mockReturnValue(createClient(hosted, rsvpIds));

    await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-27T10:00:00.000Z',
      to_date: '2026-09-30T23:59:59.999Z',
      limit: 999,
    });

    expect(hosted.limit).toHaveBeenCalledWith(100);
    expect(rsvpIds.limit).toHaveBeenCalledWith(100);
  });

  it('fails closed with a stable unavailable error when a source query fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([], {
      message: 'private provider detail',
    });
    const rsvpIds = createQueryChain([]);
    getClient.mockReturnValue(createClient(hosted, rsvpIds));

    let error: unknown;
    try {
      await service.getUserCalendarEvents('user-1', {
        from_date: '2026-08-27T10:00:00.000Z',
        to_date: '2026-08-31T23:59:59.999Z',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).toBe('Calendar unavailable');
    expect((error as Error).message).not.toContain('private provider detail');
  });

  it('fails closed when RSVP event lookup fails after IDs were loaded', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'));

    const hosted = createQueryChain([]);
    const rsvpIds = createQueryChain([{ event_id: 'event-rsvp' }]);
    const rsvpEvents = createQueryChain([], { message: 'lookup failed' });
    getClient.mockReturnValue(createClient(hosted, rsvpIds, rsvpEvents));

    await expect(
      service.getUserCalendarEvents('user-1', {
        from_date: '2026-08-27T10:00:00.000Z',
        to_date: '2026-08-31T23:59:59.999Z',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('drops malformed RSVP IDs, malformed events, and cancelled records', async () => {
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
    const rsvpIds = createQueryChain([
      null,
      { event_id: '' },
      { event_id: 42 },
    ]);
    const client = createClient(hosted, rsvpIds);
    getClient.mockReturnValue(client);

    const result = await service.getUserCalendarEvents('user-1', {
      from_date: '2026-08-27T10:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
    });

    expect(result.map((event) => event.id)).toEqual(['valid']);
    expect(client.from).toHaveBeenCalledTimes(2);
  });
});
