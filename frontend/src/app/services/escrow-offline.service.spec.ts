import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { EscrowOfflineService, EscrowRow, EscrowOperation } from './escrow-offline.service';
import { NetworkStatusService } from './network-status.service';

function createMockEscrow(overrides: Partial<EscrowRow> = {}): EscrowRow {
  return {
    id: 'escrow-1',
    sender_id: 'sender-1',
    receiver_id: 'receiver-1',
    amount: 100,
    status: 'pending',
    description: 'Test escrow',
    service_type: 'lesson',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockOperation(overrides: Partial<EscrowOperation> = {}): EscrowOperation {
  return {
    key: 'op-1',
    endpoint: '/api/escrow/create',
    method: 'POST',
    payload: { partner_id: 'user-1', amount: 100, description: 'Test' },
    queued_at: new Date().toISOString(),
    retry_count: 0,
    ...overrides,
  };
}

describe.skip('EscrowOfflineService', () => {
  let service: EscrowOfflineService;
  let escrowStore: Map<string, EscrowRow>;
  let operationStore: Map<string, EscrowOperation>;

  function createSyncRequest(result?: unknown) {
    const req: { result: unknown; error: DOMException | null; _onsuccess: (() => void) | null } = {
      result: result ?? null,
      error: null,
      _onsuccess: null,
    };
    Object.defineProperty(req, 'onsuccess', {
      get() { return this._onsuccess; },
      set(fn: () => void) {
        this._onsuccess = fn;
        fn();
      },
    });
    return req;
  }

  beforeEach(() => {
    escrowStore = new Map<string, EscrowRow>();
    operationStore = new Map<string, EscrowOperation>();

    vi.stubGlobal('navigator', { onLine: true });

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req = createSyncRequest();
        req.result = {
          objectStoreNames: {
            contains: (name: string) =>
              name === 'escrows' || name === 'operations',
          },
          transaction: () => {
            const tx = {
              _oncomplete: null as (() => void) | null,
              get oncomplete(): (() => void) | null { return this._oncomplete; },
              set oncomplete(fn: (() => void) | null) {
                this._oncomplete = fn;
                // Fire oncomplete after a microtick so put/get operations complete
                Promise.resolve().then(() => fn?.());
              },
              _onerror: null as (() => void) | null,
              get onerror(): (() => void) | null { return this._onerror; },
              set onerror(fn: (() => void) | null) {
                this._onerror = fn;
              },
              objectStore: (name: string) => ({
                put: (item: EscrowRow | EscrowOperation) => {
                  if (name === 'escrows') escrowStore.set((item as EscrowRow).id, item as EscrowRow);
                  if (name === 'operations') operationStore.set((item as EscrowOperation).key, item as EscrowOperation);
                  return createSyncRequest();
                },
                get: (key: string) => {
                  const r = createSyncRequest();
                  r.result = name === 'escrows' ? escrowStore.get(key) : operationStore.get(key);
                  return r;
                },
                getAll: () => {
                  const r = createSyncRequest();
                  r.result = name === 'escrows'
                    ? Array.from(escrowStore.values())
                    : Array.from(operationStore.values());
                  return r;
                },
                delete: (key: string) => {
                  if (name === 'escrows') escrowStore.delete(key);
                  if (name === 'operations') operationStore.delete(key);
                  return createSyncRequest();
                },
                clear: () => {
                  if (name === 'escrows') escrowStore.clear();
                  if (name === 'operations') operationStore.clear();
                  return createSyncRequest();
                },
              }),
            };
            return tx;
          },
        };
        return req;
      },
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: NetworkStatusService,
          useValue: { isOnline: () => true },
        },
      ],
    });
    service = TestBed.inject(EscrowOfflineService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with zero pending operations', () => {
    expect(service.pendingOperationCount()).toBe(0);
  });

  // ── Escrow caching ────────────────────────────────────────

  it('should cache escrows and retrieve a single escrow', async () => {
    const e = createMockEscrow();
    await service.cacheEscrows([e]);
    const cached = await service.getCachedEscrow('escrow-1');
    expect(cached).toBeDefined();
    expect(cached?.id).toBe('escrow-1');
    expect(cached?.amount).toBe(100);
  });

  it('should cache and retrieve multiple escrows', async () => {
    await service.cacheEscrows([
      createMockEscrow({ id: 'e1', status: 'pending' }),
      createMockEscrow({ id: 'e2', status: 'released' }),
    ]);
    const all = await service.getCachedEscrows();
    expect(all).toHaveLength(2);
  });

  it('should filter cached escrows by status', async () => {
    await service.cacheEscrows([
      createMockEscrow({ id: 'e1', status: 'pending' }),
      createMockEscrow({ id: 'e2', status: 'released' }),
      createMockEscrow({ id: 'e3', status: 'pending' }),
    ]);
    const pending = await service.getCachedEscrows('pending');
    expect(pending).toHaveLength(2);
    expect(pending.every((e) => e.status === 'pending')).toBe(true);
  });

  it('should return undefined for non-existent escrow', async () => {
    const cached = await service.getCachedEscrow('nonexistent');
    expect(cached).toBeUndefined();
  });

  it('should clear escrow cache', async () => {
    await service.cacheEscrows([createMockEscrow()]);
    await service.clearEscrowCache();
    const all = await service.getCachedEscrows();
    expect(all).toHaveLength(0);
  });

  // ── Operation queue ───────────────────────────────────────

  it('should enqueue and retrieve operations', async () => {
    const op = createMockOperation();
    await service.enqueueOperation(op);
    expect(service.pendingOperationCount()).toBe(1);

    const ops = await service.getPendingOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0].key).toBe('op-1');
  });

  it('should remove individual operations', async () => {
    await service.enqueueOperation(createMockOperation({ key: 'op-1' }));
    await service.enqueueOperation(createMockOperation({ key: 'op-2' }));
    expect(service.pendingOperationCount()).toBe(2);

    await service.removeOperation('op-1');
    expect(service.pendingOperationCount()).toBe(1);
    const ops = await service.getPendingOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0].key).toBe('op-2');
  });

  it('should clear the operation queue', async () => {
    await service.enqueueOperation(createMockOperation({ key: 'op-1' }));
    await service.enqueueOperation(createMockOperation({ key: 'op-2' }));
    await service.clearOperationQueue();
    expect(service.pendingOperationCount()).toBe(0);
    const ops = await service.getPendingOperations();
    expect(ops).toHaveLength(0);
  });

  // ── IndexedDB unavailable ─────────────────────────────────

  it('should return empty array when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NetworkStatusService,
          useValue: { isOnline: () => true },
        },
      ],
    });
    const noDBService = TestBed.inject(EscrowOfflineService);
    const all = await noDBService.getCachedEscrows();
    expect(all).toEqual([]);
    const ops = await noDBService.getPendingOperations();
    expect(ops).toEqual([]);
  });

  it('should not throw when enqueuing without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NetworkStatusService,
          useValue: { isOnline: () => true },
        },
      ],
    });
    const noDBService = TestBed.inject(EscrowOfflineService);
    await expect(
      noDBService.enqueueOperation(createMockOperation()),
    ).resolves.toBeUndefined();
    expect(noDBService.pendingOperationCount()).toBe(0);
  });
});