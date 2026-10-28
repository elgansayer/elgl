import {
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReadReceiptsService } from './read-receipts.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { CentrifugoService } from './centrifugo.service';
import type { ChatSettingsService } from './chat-settings.service';

type Row = Record<string, unknown>;
type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

/**
 * Minimal in-memory stand-in for the four tables the receipts service touches.
 * It implements just the PostgREST builder calls the service uses, so tests
 * assert outcomes (rows, publications) instead of query call order.
 */
class FakeDatabase {
  readonly tables: Record<string, Row[]> = {
    chat_messages: [],
    chat_room_members: [],
    chat_rooms: [],
    message_receipts: [],
    users: [],
  };
  readonly queries: { table: string; op: string }[] = [];
  private failures = new Map<string, { remaining: number; message: string }>();

  failNext(table: string, op: string, message = 'database unavailable'): void {
    this.failAfter(table, op, 0, message);
  }

  failAfter(
    table: string,
    op: string,
    successfulCallsBefore: number,
    message = 'database unavailable',
  ): void {
    this.failures.set(`${table}:${op}`, {
      remaining: successfulCallsBefore,
      message,
    });
  }

  takeFailure(table: string, op: string): string | undefined {
    const key = `${table}:${op}`;
    const failure = this.failures.get(key);
    if (!failure) return undefined;
    if (failure.remaining > 0) {
      failure.remaining -= 1;
      return undefined;
    }
    this.failures.delete(key);
    return failure.message;
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private op: 'select' | 'update' | 'upsert' = 'select';
  private filters: ((row: Row) => boolean)[] = [];
  private patch: Row = {};
  private upsertRows: Row[] = [];
  private ignoreDuplicates = false;
  private returning = false;
  private expectSingle = false;
  private maybe = false;
  private head = false;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.op === 'update') this.returning = true;
    if (options?.head) this.head = true;
    return this;
  }
  update(patch: Row) {
    this.op = 'update';
    this.patch = patch;
    return this;
  }
  upsert(rows: Row[], options?: { ignoreDuplicates?: boolean }) {
    this.op = 'upsert';
    this.upsertRows = rows;
    this.ignoreDuplicates = options?.ignoreDuplicates === true;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    // SQL semantics: NULL never satisfies <>.
    this.filters.push((row) => row[column] != null && row[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }
  limit(count: number) {
    this.max = count;
    return this;
  }
  single() {
    this.expectSingle = true;
    return this;
  }
  maybeSingle() {
    this.maybe = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    this.db.queries.push({ table: this.table, op: this.op });
    const failure = this.db.takeFailure(this.table, this.op);
    if (failure) return { data: null, error: { message: failure } };

    const rows = this.db.tables[this.table] ?? [];
    const matching = rows.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );

    if (this.op === 'upsert') {
      for (const incoming of this.upsertRows) {
        const exists = rows.some(
          (row) =>
            row['message_id'] === incoming['message_id'] &&
            row['user_id'] === incoming['user_id'],
        );
        if (exists && this.ignoreDuplicates) continue;
        rows.push({ ...incoming });
      }
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      for (const row of matching) Object.assign(row, this.patch);
      return {
        data: this.returning ? matching.map((row) => ({ ...row })) : null,
        error: null,
      };
    }

    let result = matching.map((row) => ({ ...row }));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      result.sort((a, b) => {
        const left = String(a[column]);
        const right = String(b[column]);
        return ascending
          ? left.localeCompare(right)
          : right.localeCompare(left);
      });
    }
    if (this.max !== null) result = result.slice(0, this.max);
    if (this.head) return { data: null, error: null, count: matching.length };
    if (this.expectSingle) {
      return result.length === 1
        ? { data: result[0], error: null }
        : { data: null, error: { message: 'no rows' } };
    }
    if (this.maybe) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
}

const ROOM = '11111111-1111-4111-8111-111111111111';
const OTHER_ROOM = '22222222-2222-4222-8222-222222222222';
const SENDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const READER_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const READER_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const M1 = '00000000-0000-4000-8000-000000000001';
const M2 = '00000000-0000-4000-8000-000000000002';
const M3 = '00000000-0000-4000-8000-000000000003';

describe('ReadReceiptsService', () => {
  let db: FakeDatabase;
  let publish: ReturnType<typeof vi.fn>;
  let optedIn: Set<string>;
  let service: ReadReceiptsService;

  function seedRoom(memberIds: string[], roomId = ROOM): void {
    if (!db.tables['chat_rooms'].some((room) => room['id'] === roomId)) {
      db.tables['chat_rooms'].push({ id: roomId });
    }
    for (const userId of memberIds) {
      db.tables['chat_room_members'].push({ room_id: roomId, user_id: userId });
    }
  }

  function seedMessage(id: string, overrides: Row = {}): Row {
    const row: Row = {
      id,
      room_id: ROOM,
      sender_id: SENDER,
      delivery_status: 'sent',
      ...overrides,
    };
    db.tables['chat_messages'].push(row);
    return row;
  }

  function messageStatus(id: string): unknown {
    return db.tables['chat_messages'].find((row) => row['id'] === id)?.[
      'delivery_status'
    ];
  }

  function receiptsFor(messageId: string): string[] {
    return db.tables['message_receipts']
      .filter((row) => row['message_id'] === messageId)
      .map((row) => String(row['user_id']));
  }

  function statusPublications(): unknown[] {
    return publish.mock.calls.map(([channel, payload]) => ({
      channel,
      payload,
    }));
  }

  beforeEach(() => {
    db = new FakeDatabase();
    publish = vi.fn().mockResolvedValue(true);
    optedIn = new Set();
    const chatSettings = {
      getSettings: vi.fn((userId: string) =>
        Promise.resolve({
          autoTranslate: false,
          readReceipts: optedIn.has(userId),
          enterToSend: false,
        }),
      ),
    };

    service = new ReadReceiptsService(
      {
        getClient: () => ({ from: (table: string) => db.from(table) }),
      } as unknown as SupabaseService,
      { publish } as unknown as CentrifugoService,
      chatSettings as unknown as ChatSettingsService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateStatus', () => {
    it('reports an unknown message as not found', async () => {
      await expect(
        service.updateStatus(READER_1, M1, 'read'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reports a message lookup outage as unavailable', async () => {
      db.failNext('chat_messages', 'select', 'lookup failed');

      await expect(
        service.updateStatus(READER_1, M1, 'read'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('rejects a caller outside the room before changing anything', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      optedIn.add(OUTSIDER);

      await expect(
        service.updateStatus(OUTSIDER, M1, 'read'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(messageStatus(M1)).toBe('sent');
      expect(db.tables['message_receipts']).toHaveLength(0);
      expect(publish).not.toHaveBeenCalled();
    });

    it('ignores a sender acknowledging their own message', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      optedIn.add(SENDER);

      await service.updateStatus(SENDER, M1, 'read');
      await service.updateStatus(SENDER, M1, 'delivered');

      expect(messageStatus(M1)).toBe('sent');
      expect(db.tables['message_receipts']).toHaveLength(0);
      expect(publish).not.toHaveBeenCalled();
    });

    it('records the read and publishes it when the only recipient opted in', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      optedIn.add(READER_1);

      await service.updateStatus(READER_1, M1, 'read');

      expect(receiptsFor(M1)).toEqual([READER_1]);
      expect(db.tables['message_receipts'][0]).toMatchObject({
        status: 'read',
        read_at: expect.any(String),
      });
      expect(messageStatus(M1)).toBe('read');
      expect(statusPublications()).toEqual([
        {
          channel: `chat:${ROOM}`,
          payload: {
            status_update: { message_id: M1, delivery_status: 'read' },
          },
        },
      ]);
    });

    it('never discloses a read when the reader has read receipts disabled', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1, { delivery_status: 'delivered' });

      await service.updateStatus(READER_1, M1, 'read');

      expect(db.tables['message_receipts']).toHaveLength(0);
      expect(messageStatus(M1)).toBe('delivered');
      expect(publish).not.toHaveBeenCalled();
    });

    it('promotes a group message only after every other member has read it', async () => {
      seedRoom([SENDER, READER_1, READER_2]);
      seedMessage(M1, { delivery_status: 'delivered' });
      optedIn.add(READER_1).add(READER_2);

      await service.updateStatus(READER_1, M1, 'read');
      expect(receiptsFor(M1)).toEqual([READER_1]);
      expect(messageStatus(M1)).toBe('delivered');
      expect(publish).not.toHaveBeenCalled();

      await service.updateStatus(READER_2, M1, 'read');
      expect(receiptsFor(M1).sort()).toEqual([READER_1, READER_2].sort());
      expect(messageStatus(M1)).toBe('read');
      expect(publish).toHaveBeenCalledTimes(1);
    });

    it('keeps a group message delivered while a member has not opted in', async () => {
      seedRoom([SENDER, READER_1, READER_2]);
      seedMessage(M1, { delivery_status: 'delivered' });
      optedIn.add(READER_1);

      await service.updateStatus(READER_1, M1, 'read');
      await service.updateStatus(READER_2, M1, 'read');

      expect(receiptsFor(M1)).toEqual([READER_1]);
      expect(messageStatus(M1)).toBe('delivered');
      expect(publish).not.toHaveBeenCalled();
    });

    it('is idempotent: a retried acknowledgement neither duplicates receipts nor republishes', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      optedIn.add(READER_1);

      await service.updateStatus(READER_1, M1, 'read');
      const firstReadAt = db.tables['message_receipts'][0]['read_at'];
      await service.updateStatus(READER_1, M1, 'read');

      expect(receiptsFor(M1)).toEqual([READER_1]);
      expect(db.tables['message_receipts'][0]['read_at']).toBe(firstReadAt);
      expect(publish).toHaveBeenCalledTimes(1);
    });

    it('never downgrades a read message to delivered', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1, { delivery_status: 'read' });

      await service.updateStatus(READER_1, M1, 'delivered');

      expect(messageStatus(M1)).toBe('read');
      expect(publish).not.toHaveBeenCalled();
    });

    it('moves a sent message to delivered exactly once', async () => {
      seedRoom([SENDER, READER_1, READER_2]);
      seedMessage(M1);

      await Promise.all([
        service.updateStatus(READER_1, M1, 'delivered'),
        service.updateStatus(READER_2, M1, 'delivered'),
      ]);

      expect(messageStatus(M1)).toBe('delivered');
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(`chat:${ROOM}`, {
        status_update: { message_id: M1, delivery_status: 'delivered' },
      });
    });

    it('surfaces persistence failures instead of reporting a receipt', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      optedIn.add(READER_1);
      db.failNext('message_receipts', 'upsert', 'write failed');

      await expect(service.updateStatus(READER_1, M1, 'read')).rejects.toThrow(
        'Failed to record read receipts: write failed',
      );
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('acknowledges many messages with one aggregate publication per promoted message', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      seedMessage(M2);
      optedIn.add(READER_1);

      await expect(service.markRead(READER_1, ROOM, [M1, M2])).resolves.toEqual(
        { marked: 2 },
      );

      expect(messageStatus(M1)).toBe('read');
      expect(messageStatus(M2)).toBe('read');
      expect(publish).toHaveBeenCalledTimes(2);
    });

    it('reports a message query outage as unavailable', async () => {
      seedRoom([SENDER, READER_1]);
      db.failNext('chat_messages', 'select', 'lookup failed');

      await expect(
        service.markRead(READER_1, ROOM, [M1]),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('rejects non-members', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await expect(
        service.markRead(OUTSIDER, ROOM, [M1]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reports a missing room separately from a membership refusal', async () => {
      await expect(
        service.markRead(READER_1, OTHER_ROOM, [M1]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reports an access lookup outage as unavailable instead of forbidden', async () => {
      seedRoom([SENDER, READER_1]);
      db.failNext('chat_room_members', 'select', 'lookup failed');

      await expect(
        service.markRead(READER_1, ROOM, [M1]),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('silently ignores unknown ids, other rooms and the caller own messages', async () => {
      seedRoom([SENDER, READER_1]);
      seedRoom([SENDER, READER_1], OTHER_ROOM);
      seedMessage(M1);
      seedMessage(M2, { room_id: OTHER_ROOM });
      seedMessage(M3, { sender_id: READER_1 });
      optedIn.add(READER_1);

      const result = await service.markRead(READER_1, ROOM, [
        M1,
        M2,
        M3,
        'not-a-uuid',
        '00000000-0000-4000-8000-0000000000ff',
      ]);

      expect(result).toEqual({ marked: 1 });
      expect(receiptsFor(M1)).toEqual([READER_1]);
      expect(receiptsFor(M2)).toEqual([]);
      expect(receiptsFor(M3)).toEqual([]);
      expect(messageStatus(M2)).toBe('sent');
    });

    it('does nothing when the reader has not enabled read receipts', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await expect(service.markRead(READER_1, ROOM, [M1])).resolves.toEqual({
        marked: 0,
      });
      expect(db.tables['message_receipts']).toHaveLength(0);
      expect(publish).not.toHaveBeenCalled();
    });

    it('bounds the batch and skips work for an empty acknowledgement', async () => {
      seedRoom([SENDER, READER_1]);
      optedIn.add(READER_1);

      await expect(service.markRead(READER_1, ROOM, [])).resolves.toEqual({
        marked: 0,
      });
      expect(
        db.queries.filter((query) => query.table === 'chat_messages'),
      ).toHaveLength(0);
    });

    it('queries receipts in chunks that stay below the PostgREST row cap in large rooms', async () => {
      const members = Array.from(
        { length: 500 },
        (_, index) => `member-${index}`,
      );
      seedRoom([SENDER, READER_1, ...members]);
      const ids = Array.from(
        { length: 5 },
        (_, index) => `00000000-0000-4000-8000-00000000010${index}`,
      );
      ids.forEach((id) => seedMessage(id));
      optedIn.add(READER_1);

      await service.markRead(READER_1, ROOM, ids);

      const receiptReads = db.queries.filter(
        (query) => query.table === 'message_receipts' && query.op === 'select',
      );
      // floor(900 / 502 members) = 1 message per query.
      expect(receiptReads).toHaveLength(5);
      // Only one of 500 recipients has read, so nothing is promoted.
      expect(publish).not.toHaveBeenCalled();
    });

    it('logs and continues when the live publication fails', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      optedIn.add(READER_1);
      publish.mockResolvedValue(false);

      await expect(service.markRead(READER_1, ROOM, [M1])).resolves.toEqual({
        marked: 1,
      });

      expect(messageStatus(M1)).toBe('read');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`message=${M1}`),
      );
      expect(warn).toHaveBeenCalledWith(
        expect.not.stringContaining('text_content'),
      );
    });
  });

  describe('getReceiptStatus', () => {
    beforeEach(() => {
      db.tables['users'].push(
        {
          id: READER_1,
          display_name: 'Aiko',
          avatar_url: 'https://cdn/aiko.png',
        },
        { id: READER_2, display_name: 'Ben', avatar_url: null },
      );
    });

    it('lists readers, oldest read first, with the recipient count', async () => {
      seedRoom([SENDER, READER_1, READER_2]);
      seedMessage(M1, { delivery_status: 'delivered' });
      db.tables['message_receipts'].push(
        {
          message_id: M1,
          user_id: READER_2,
          status: 'read',
          read_at: '2026-09-26T10:05:00.000Z',
        },
        {
          message_id: M1,
          user_id: READER_1,
          status: 'read',
          read_at: '2026-09-26T10:01:00.000Z',
        },
        {
          message_id: M1,
          user_id: OUTSIDER,
          status: 'delivered',
          read_at: null,
        },
      );

      await expect(service.getReceiptStatus(SENDER, M1)).resolves.toEqual({
        messageId: M1,
        deliveryStatus: 'delivered',
        totalMembers: 2,
        readBy: [
          {
            userId: READER_1,
            displayName: 'Aiko',
            avatarUrl: 'https://cdn/aiko.png',
            readAt: '2026-09-26T10:01:00.000Z',
          },
          {
            userId: READER_2,
            displayName: 'Ben',
            avatarUrl: null,
            readAt: '2026-09-26T10:05:00.000Z',
          },
        ],
      });
    });

    it('returns an empty reader list when nobody has disclosed a read', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await expect(service.getReceiptStatus(SENDER, M1)).resolves.toMatchObject(
        {
          readBy: [],
          totalMembers: 1,
          deliveryStatus: 'sent',
        },
      );
    });

    it('shows readers to the sender only', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await expect(
        service.getReceiptStatus(READER_1, M1),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects callers outside the room and unknown messages', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await expect(
        service.getReceiptStatus(OUTSIDER, M1),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.getReceiptStatus(SENDER, M2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not fabricate a zero recipient count when the count query fails', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      // The membership check is the first select on this table; fail the count.
      db.failAfter('chat_room_members', 'select', 1, 'count failed');

      await expect(service.getReceiptStatus(SENDER, M1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('does not fabricate blank reader profiles when the profile query fails', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      db.tables['message_receipts'].push({
        message_id: M1,
        user_id: READER_1,
        status: 'read',
        read_at: '2026-09-26T10:01:00.000Z',
      });
      db.failNext('users', 'select', 'profile lookup failed');

      await expect(service.getReceiptStatus(SENDER, M1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('reports a message lookup outage as unavailable', async () => {
      db.failNext('chat_messages', 'select', 'lookup failed');

      await expect(service.getReceiptStatus(SENDER, M1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('does not fabricate an empty receipt list when its query fails', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);
      db.failNext('message_receipts', 'select', 'receipt lookup failed');

      await expect(service.getReceiptStatus(SENDER, M1)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('markAsDelivered', () => {
    it('moves a sent message to delivered and publishes on the live room channel', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await service.markAsDelivered(M1, ROOM, READER_1);

      expect(messageStatus(M1)).toBe('delivered');
      expect(publish).toHaveBeenCalledWith(`chat:${ROOM}`, {
        status_update: { message_id: M1, delivery_status: 'delivered' },
      });
    });

    it('never publishes on the unused per-room receipts channel', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await service.markAsDelivered(M1, ROOM, READER_1);

      expect(
        publish.mock.calls.some(([channel]) =>
          String(channel).endsWith(':receipts'),
        ),
      ).toBe(false);
    });

    it('ignores missing messages and the sender own message', async () => {
      seedRoom([SENDER, READER_1]);
      seedMessage(M1);

      await service.markAsDelivered(M2, ROOM, READER_1);
      await service.markAsDelivered(M1, ROOM, SENDER);

      expect(messageStatus(M1)).toBe('sent');
      expect(publish).not.toHaveBeenCalled();
    });

    it.each(['delivered', 'read'])(
      'does not touch a %s message',
      async (status) => {
        seedRoom([SENDER, READER_1]);
        seedMessage(M1, { delivery_status: status });

        await service.markAsDelivered(M1, ROOM, READER_1);

        expect(messageStatus(M1)).toBe(status);
        expect(publish).not.toHaveBeenCalled();
      },
    );
  });
});
