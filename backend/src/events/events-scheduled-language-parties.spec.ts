import { EventsService } from './events.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';

interface EventRow {
  id: string;
  title: string;
  host_id: string;
  language_pair: string | null;
  date_time: string;
}

interface RoomRow {
  id: string;
  room_name: string;
  event_id: string | null;
  party_type: string | null;
}

interface ClientOptions {
  events?: EventRow[];
  existingRooms?: RoomRow[];
  recoveredRoom?: RoomRow | null;
  eventScanError?: { message: string } | null;
  roomLookupError?: { message: string } | null;
  updateError?: { message: string } | null;
}

function buildClient(options: ClientOptions = {}) {
  const eventQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  const eventEq = vi.fn(() => eventQuery);
  const eventNot = vi.fn(() => eventQuery);
  const eventGte = vi.fn(() => eventQuery);
  const eventLte = vi.fn(() => eventQuery);
  const eventOrder = vi.fn(() => eventQuery);
  const eventLimit = vi.fn().mockResolvedValue({
    data: options.events ?? [],
    error: options.eventScanError ?? null,
  });

  Object.assign(eventQuery, {
    eq: eventEq,
    not: eventNot,
    gte: eventGte,
    lte: eventLte,
    order: eventOrder,
    limit: eventLimit,
  });

  const roomIn = vi.fn().mockResolvedValue({
    data: options.existingRooms ?? [],
    error: options.roomLookupError ?? null,
  });
  const recoverMaybeSingle = vi.fn().mockResolvedValue({
    data: options.recoveredRoom ?? null,
    error: null,
  });
  const recoverEq = vi.fn(() => ({ maybeSingle: recoverMaybeSingle }));
  const roomSelect = vi.fn(() => ({
    in: roomIn,
    eq: recoverEq,
  }));

  const updates: Array<{ values: unknown; id: string }> = [];
  const roomUpdate = vi.fn((values: unknown) => ({
    eq: vi.fn(async (_column: string, id: string) => {
      updates.push({ values, id });
      return { error: options.updateError ?? null };
    }),
  }));

  const from = vi.fn((table: string) => {
    if (table === 'events') {
      return { select: vi.fn(() => eventQuery) };
    }
    if (table === 'audio_rooms') {
      return {
        select: roomSelect,
        update: roomUpdate,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from },
    eventEq,
    eventGte,
    eventLte,
    eventLimit,
    roomIn,
    recoverMaybeSingle,
    updates,
  };
}

function makeService(
  client: ReturnType<typeof buildClient>['client'],
  createLanguageParty = vi.fn(),
) {
  return new EventsService(
    { getClient: vi.fn(() => client) } as unknown as SupabaseService,
    { sendPushNotification: vi.fn() } as unknown as NotificationsService,
    { createLanguageParty } as unknown as AudioRoomsService,
  );
}

function scheduledWorker(service: EventsService) {
  return service as unknown as {
    checkStartEvents(): Promise<void>;
    checkReminders(): Promise<void>;
  };
}

describe('EventsService scheduled Language Parties (#1331)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a due audio event as a deterministic Language Party and links it', async () => {
    const event: EventRow = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'French conversation',
      host_id: '22222222-2222-4222-8222-222222222222',
      language_pair: 'en-fr',
      date_time: '2026-08-24T12:00:00.000Z',
    };
    const fake = buildClient({ events: [event] });
    const createLanguageParty = vi.fn().mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
    });
    const service = makeService(fake.client, createLanguageParty);

    await scheduledWorker(service).checkStartEvents();

    expect(fake.eventEq).toHaveBeenCalledWith('is_cancelled', false);
    expect(fake.eventEq).toHaveBeenCalledWith('category', 'audio_room');
    expect(fake.eventLimit).toHaveBeenCalledWith(50);
    expect(createLanguageParty).toHaveBeenCalledWith(
      event.host_id,
      {
        title: event.title,
        language_pair: 'en-fr',
        topic_tag: 'en-fr',
        is_video_stream: false,
      },
      `language_party-${event.id}`,
    );
    expect(fake.updates).toContainEqual({
      values: {
        event_id: event.id,
        party_type: 'language_party',
      },
      id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('uses a bounded 30-minute catch-up window ending at the current time', async () => {
    const fake = buildClient();
    const service = makeService(fake.client);

    await scheduledWorker(service).checkStartEvents();

    expect(fake.eventGte).toHaveBeenCalledWith(
      'date_time',
      '2026-08-24T11:30:00.000Z',
    );
    expect(fake.eventLte).toHaveBeenCalledWith(
      'date_time',
      '2026-08-24T12:00:00.000Z',
    );
  });

  it('repairs a partially linked deterministic room instead of creating a duplicate', async () => {
    const event: EventRow = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'French conversation',
      host_id: '22222222-2222-4222-8222-222222222222',
      language_pair: 'en-fr',
      date_time: '2026-08-24T11:59:00.000Z',
    };
    const existingRoom: RoomRow = {
      id: '33333333-3333-4333-8333-333333333333',
      room_name: `language_party-${event.id}`,
      event_id: null,
      party_type: null,
    };
    const fake = buildClient({ events: [event], existingRooms: [existingRoom] });
    const createLanguageParty = vi.fn();
    const service = makeService(fake.client, createLanguageParty);

    await scheduledWorker(service).checkStartEvents();

    expect(createLanguageParty).not.toHaveBeenCalled();
    expect(fake.updates).toContainEqual({
      values: {
        event_id: event.id,
        party_type: 'language_party',
      },
      id: existingRoom.id,
    });
  });

  it('recovers when another replica wins the deterministic room-name race', async () => {
    const event: EventRow = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'French conversation',
      host_id: '22222222-2222-4222-8222-222222222222',
      language_pair: 'en-fr',
      date_time: '2026-08-24T11:59:30.000Z',
    };
    const recoveredRoom: RoomRow = {
      id: '33333333-3333-4333-8333-333333333333',
      room_name: `language_party-${event.id}`,
      event_id: null,
      party_type: 'language_party',
    };
    const fake = buildClient({ events: [event], recoveredRoom });
    const createLanguageParty = vi
      .fn()
      .mockRejectedValue(new Error('duplicate room_name'));
    const service = makeService(fake.client, createLanguageParty);

    await scheduledWorker(service).checkStartEvents();

    expect(fake.recoverMaybeSingle).toHaveBeenCalled();
    expect(fake.updates).toContainEqual({
      values: {
        event_id: event.id,
        party_type: 'language_party',
      },
      id: recoveredRoom.id,
    });
  });

  it('never transfers a deterministic room that is already linked to another event', async () => {
    const event: EventRow = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'French conversation',
      host_id: '22222222-2222-4222-8222-222222222222',
      language_pair: 'en-fr',
      date_time: '2026-08-24T11:59:00.000Z',
    };
    const fake = buildClient({
      events: [event],
      existingRooms: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          room_name: `language_party-${event.id}`,
          event_id: '44444444-4444-4444-8444-444444444444',
          party_type: 'language_party',
        },
      ],
    });
    const createLanguageParty = vi.fn();
    const service = makeService(fake.client, createLanguageParty);

    await expect(
      scheduledWorker(service).checkStartEvents(),
    ).resolves.toBeUndefined();

    expect(createLanguageParty).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(0);
  });

  it('fails the scheduler tick closed when the event scan is unavailable', async () => {
    const fake = buildClient({
      eventScanError: { message: 'database unavailable' },
    });
    const createLanguageParty = vi.fn();
    const service = makeService(fake.client, createLanguageParty);

    await expect(
      scheduledWorker(service).checkStartEvents(),
    ).resolves.toBeUndefined();

    expect(createLanguageParty).not.toHaveBeenCalled();
    expect(fake.roomIn).not.toHaveBeenCalled();
  });

  it('starts the scheduled-room scan immediately at module startup', () => {
    const fake = buildClient();
    const service = makeService(fake.client);
    const worker = scheduledWorker(service);
    const reminderSpy = vi
      .spyOn(worker, 'checkReminders')
      .mockResolvedValue(undefined);
    const scheduledSpy = vi
      .spyOn(worker, 'checkStartEvents')
      .mockResolvedValue(undefined);

    service.onModuleInit();

    expect(reminderSpy).toHaveBeenCalledTimes(1);
    expect(scheduledSpy).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });
});
