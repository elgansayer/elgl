/**
 * Test-only helpers: a chainable, awaitable stand-in for the Supabase query
 * builder whose results are queued per table and operation. It lives under
 * test/ so it is never compiled into the production build.
 */

export type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface RecordedQuery {
  table: string;
  operation: string;
  calls: RecordedCall[];
}

const MUTATIONS = ['insert', 'update', 'upsert', 'delete'];
const CHAIN = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'in',
  'is',
  'gt',
  'gte',
  'lt',
  'lte',
  'not',
  'contains',
  'or',
  'order',
  'range',
  'limit',
];

export function createSupabaseDouble() {
  const queues = new Map<string, QueryResult[]>();
  const recorded: RecordedQuery[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const getUserById = vi.fn();

  const push = (key: string, results: QueryResult[]) => {
    queues.set(key, [...(queues.get(key) ?? []), ...results]);
  };
  const pop = (key: string): QueryResult =>
    queues.get(key)?.shift() ?? { data: null, error: null };

  function createQuery(table: string) {
    const record: RecordedQuery = { table, operation: 'select', calls: [] };
    recorded.push(record);
    let resolved = false;
    const settle = (): QueryResult => {
      resolved = true;
      return pop(`${table}:${record.operation}`);
    };

    const query: Record<string, unknown> = {};
    for (const method of CHAIN) {
      query[method] = vi.fn((...args: unknown[]) => {
        record.calls.push({ method, args });
        if (MUTATIONS.includes(method) && !resolved) record.operation = method;
        return query;
      });
    }
    query.maybeSingle = vi.fn(() => {
      record.calls.push({ method: 'maybeSingle', args: [] });
      return Promise.resolve(settle());
    });
    query.then = (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(settle()).then(resolve, reject);
    return query;
  }

  const client = {
    from: vi.fn((table: string) => createQuery(table)),
    rpc: vi.fn((name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(pop(`rpc:${name}`));
    }),
    auth: { admin: { getUserById } },
  };

  return {
    client,
    getUserById,
    /** Queue results for `table` + `operation` (select, insert, update, delete, upsert). */
    on(table: string, operation: string, ...results: QueryResult[]) {
      push(`${table}:${operation}`, results);
    },
    onRpc(name: string, ...results: QueryResult[]) {
      push(`rpc:${name}`, results);
    },
    queries(table: string, operation?: string): RecordedQuery[] {
      return recorded.filter(
        (entry) =>
          entry.table === table &&
          (!operation || entry.operation === operation),
      );
    },
    rpcCalls: (name: string) => rpcCalls.filter((call) => call.name === name),
    payload(entry: RecordedQuery | undefined, method: string): unknown {
      return entry?.calls.find((call) => call.method === method)?.args[0];
    },
    hasCall(
      entry: RecordedQuery | undefined,
      method: string,
      ...args: unknown[]
    ) {
      return (
        entry?.calls.some(
          (call) =>
            call.method === method &&
            JSON.stringify(call.args) === JSON.stringify(args),
        ) ?? false
      );
    },
    everything: () => JSON.stringify({ recorded, rpcCalls }),
  };
}
