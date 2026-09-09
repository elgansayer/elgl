import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { EscrowService } from './escrow.service';
import { NetworkStatusService } from './network-status.service';
import { AuthService } from './auth.service';
import { EscrowOfflineService, EscrowRow } from './escrow-offline.service';

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

describe('EscrowService', () => {
  let service: EscrowService;
  let httpMock: HttpTestingController;
  let mockNetwork: { isOnline: () => boolean };
  let mockAuth: { getAccessToken: () => string | null };
  let mockOfflineStore: {
    cacheEscrows: ReturnType<typeof vi.fn>;
    getCachedEscrow: ReturnType<typeof vi.fn>;
    getCachedEscrows: ReturnType<typeof vi.fn>;
    enqueueOperation: ReturnType<typeof vi.fn>;
    getPendingOperations: ReturnType<typeof vi.fn>;
    removeOperation: ReturnType<typeof vi.fn>;
    pendingOperationCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockNetwork = { isOnline: () => true as unknown as boolean };
    mockAuth = { getAccessToken: () => 'test-token' as string | null };
    mockOfflineStore = {
      cacheEscrows: vi.fn().mockResolvedValue(undefined),
      getCachedEscrow: vi.fn().mockResolvedValue(undefined),
      getCachedEscrows: vi.fn().mockResolvedValue([]),
      enqueueOperation: vi.fn().mockResolvedValue(undefined),
      getPendingOperations: vi.fn().mockResolvedValue([]),
      removeOperation: vi.fn().mockResolvedValue(undefined),
      pendingOperationCount: vi.fn().mockReturnValue(0),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EscrowService,
        { provide: NetworkStatusService, useValue: mockNetwork },
        { provide: AuthService, useValue: mockAuth },
        { provide: EscrowOfflineService, useValue: mockOfflineStore },
      ],
    });

    service = TestBed.inject(EscrowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── listUserEscrows ───────────────────────────────────────

  it('should fetch escrows and cache them when online', async () => {
    const escrows = [createMockEscrow()];

    const promise = service.listUserEscrows();
    const req = httpMock.expectOne('http://127.0.0.1:3000/api/escrow');
    expect(req.request.method).toBe('GET');
    req.flush(escrows);

    await promise;
    expect(mockOfflineStore.cacheEscrows).toHaveBeenCalledWith(escrows);
    expect(service.escrows()).toEqual(escrows);
  });

  it('should fall back to cached escrows when offline', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(false as unknown as boolean);
    const cached = [createMockEscrow()];
    mockOfflineStore.getCachedEscrows.mockResolvedValue(cached);

    const result = await service.listUserEscrows();
    expect(result).toEqual(cached);
    expect(mockOfflineStore.getCachedEscrows).toHaveBeenCalled();
  });

    // ── createEscrow ─────────────────────────────────────────
  it('should create escrow via API when online', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(true as unknown as boolean);
    const dto = { partner_id: 'partner-1', amount: 100, description: 'Test' };

    const promise = service.createEscrow(dto);
    const req = httpMock.expectOne('http://127.0.0.1:3000/api/escrow/create');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'esc-1', status: 'pending', amount_held: 100, coins_remaining: 400 });

    const result = await promise;
    expect(result.id).toBe('esc-1');
  });

  it('should queue create when offline', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(false as unknown as boolean);
    const dto = { partner_id: 'partner-1', amount: 100, description: 'Test' };

    const result = await service.createEscrow(dto);
    expect(mockOfflineStore.enqueueOperation).toHaveBeenCalled();
    expect(result.status).toBe('pending');
    expect(result.coins_remaining).toBe(-1);
  });

  // ── releaseEscrow ─────────────────────────────────────────

  it('should release escrow via API when online', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(true as unknown as boolean);

    const promise = service.releaseEscrow('escrow-1');
    const req = httpMock.expectOne('http://127.0.0.1:3000/api/escrow/release');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'escrow-1', status: 'released', amount_released: 100, receiver_new_balance: 600 });

    const result = await promise;
    expect(result.status).toBe('released');
  });

  it('should queue release when offline', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(false as unknown as boolean);

    const result = await service.releaseEscrow('escrow-1');
    expect(mockOfflineStore.enqueueOperation).toHaveBeenCalled();
    expect(result.status).toBe('released');
  });

  // ── refundEscrow ──────────────────────────────────────────

  it('should refund escrow via API when online', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(true as unknown as boolean);

    const promise = service.refundEscrow('escrow-1', 'Changed mind');
    const req = httpMock.expectOne('http://127.0.0.1:3000/api/escrow/refund');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'escrow-1', status: 'refunded', amount_refunded: 100, sender_new_balance: 500 });

    const result = await promise;
    expect(result.status).toBe('refunded');
  });

  it('should queue refund when offline', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(false as unknown as boolean);

    const result = await service.refundEscrow('escrow-1');
    expect(mockOfflineStore.enqueueOperation).toHaveBeenCalled();
    expect(result.status).toBe('refunded');
  });

  // ── disputeEscrow ─────────────────────────────────────────

  it('should dispute escrow via API when online', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(true as unknown as boolean);
    const disputeResult = createMockEscrow({ status: 'disputed', dispute_reason: 'Issue' });

    const promise = service.disputeEscrow('escrow-1', 'Issue');
    const req = httpMock.expectOne('http://127.0.0.1:3000/api/escrow/dispute');
    expect(req.request.method).toBe('POST');
    req.flush(disputeResult);

    const result = await promise;
    expect(result.status).toBe('disputed');
  });

  it('should queue dispute when offline', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(false as unknown as boolean);

    const result = await service.disputeEscrow('escrow-1', 'Issue');
    expect(mockOfflineStore.enqueueOperation).toHaveBeenCalled();
    expect(result.status).toBe('disputed');
  });

  // ── getEscrow ─────────────────────────────────────────────

  it('should fetch single escrow via API', async () => {
    const escrow = createMockEscrow();

    const promise = service.getEscrow('escrow-1');
    const req = httpMock.expectOne('http://127.0.0.1:3000/api/escrow/escrow-1');
    expect(req.request.method).toBe('GET');
    req.flush(escrow);

    const result = await promise;
    expect(result).toBeDefined();
    expect(result?.id).toBe('escrow-1');
  });

  it('should return cached escrow when offline', async () => {
    vi.spyOn(mockNetwork, 'isOnline').mockReturnValue(false as unknown as boolean);
    const cached = createMockEscrow();
    mockOfflineStore.getCachedEscrow.mockResolvedValue(cached);

    const result = await service.getEscrow('escrow-1');
    expect(result).toEqual(cached);
  });

  // ── syncOfflineOperations ─────────────────────────────────

  it('should return zero when no pending operations', async () => {
    mockOfflineStore.getPendingOperations.mockResolvedValue([]);

    const result = await service.syncOfflineOperations();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });
});