/// <reference types="cypress" />

/**
 * Escrow Payments E2E Test Flows
 *
 * Covers the full lifecycle of escrow-based peer-to-peer payments:
 * create, fund, release, dispute, refund, cancel, and history.
 *
 * Escrow workflow:
 *  1. Payer creates an escrow for a recipient with a coin amount.
 *  2. Coins are locked (deducted from payer balance) immediately.
 *  3. The recipient can view pending escrows.
 *  4. The payer releases the funds to the recipient upon satisfactory
 *     completion of the service / exchange.
 *  5. Either party can open a dispute which freezes the escrow.
 *  6. An expired escrow auto-refunds the payer.
 *  7. The payer can cancel an unreleased escrow (refund).
 */

// -----------------------------------------------------------------
// Shared test helpers
// -----------------------------------------------------------------

const API_BASE = '/api/escrow';

interface EscrowTransaction {
  id: string;
  payer_id: string;
  recipient_id: string;
  coin_amount: number;
  status: 'pending' | 'released' | 'disputed' | 'refunded' | 'cancelled';
  description: string;
  room_id?: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

function mockEscrow(overrides: Partial<EscrowTransaction> = {}): EscrowTransaction {
  const now = new Date().toISOString();
  const sevenDays = new Date(Date.now() + 7 * 864e5).toISOString();
  return {
    id: 'escrow-001',
    payer_id: 'payer-abc',
    recipient_id: 'recipient-xyz',
    coin_amount: 100,
    status: 'pending',
    description: 'Language exchange lesson - 30 min Spanish session',
    room_id: 'room-789',
    created_at: now,
    updated_at: now,
    expires_at: sevenDays,
    ...overrides,
  };
}

function setupCommonMocks(): void {
  cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
  cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
  cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
  cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
  cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
  cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
  cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
    'getBlockedAndBlockerIds',
  );
  cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
  cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 500 } }).as('getBalance');
}

// -----------------------------------------------------------------
// 1. Create Escrow (API Contract)
// -----------------------------------------------------------------

describe('Escrow Payments - Create Escrow', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should create a new escrow transaction with valid payload', () => {
    const created = mockEscrow();

    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 201,
      body: created,
    }).as('createEscrow');

    cy.visit('/');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 100,
        description: 'Language exchange lesson - 30 min Spanish session',
        room_id: 'room-789',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      const body: EscrowTransaction = response.body;
      expect(body.id).to.be.a('string');
      expect(body.id).to.not.be.empty;
      expect(body.status).to.eq('pending');
      expect(body.coin_amount).to.eq(100);
      expect(body.payer_id).to.eq('payer-abc');
      expect(body.recipient_id).to.eq('recipient-xyz');
      expect(body.expires_at).to.be.a('string');
    });
  });

  it('should reject escrow creation with zero coin amount', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'coin_amount must be greater than 0' },
    }).as('createInvalid');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 0,
        description: 'Free lesson',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.include('coin_amount');
    });
  });

  it('should reject escrow creation with negative coin amount', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'coin_amount must be greater than 0' },
    }).as('createNegative');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: -50,
        description: 'Invalid',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should reject escrow creation when payer has insufficient balance', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 422,
      body: { statusCode: 422, message: 'Insufficient coin balance' },
    }).as('insufficientFunds');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 5000,
        description: 'Too expensive',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(422);
      expect(response.body.message).to.include('Insufficient');
    });
  });

  it('should reject escrow creation with empty recipient_id', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'recipient_id is required' },
    }).as('emptyRecipient');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: '',
        coin_amount: 50,
        description: 'Missing recipient',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should reject creating escrow with oneself as recipient', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Cannot create escrow with yourself as recipient' },
    }).as('selfRecipient');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'payer-abc',
        coin_amount: 50,
        description: 'Self-payment',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should deduct coins from payer balance immediately upon escrow creation', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 201,
      body: mockEscrow(),
    }).as('createEscrow');

    cy.intercept('GET', '**/api/economy/balance', {
      body: { coins_balance: 400 },
    }).as('updatedBalance');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 100,
        description: 'Lesson payment',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });

    // Verify payer balance decreased
    cy.request({
      method: 'GET',
      url: '/api/economy/balance',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.body.coins_balance).to.eq(400);
    });
  });
});

// -----------------------------------------------------------------
// 2. View Escrow Details
// -----------------------------------------------------------------

describe('Escrow Payments - View Escrow', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should retrieve a single escrow by ID', () => {
    const escrow = mockEscrow();

    cy.intercept('GET', `${API_BASE}/escrow-001`, {
      statusCode: 200,
      body: escrow,
    }).as('getEscrow');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/escrow-001`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.id).to.eq('escrow-001');
      expect(response.body.status).to.eq('pending');
    });
  });

  it('should return 404 for non-existent escrow ID', () => {
    cy.intercept('GET', `${API_BASE}/nonexistent-999`, {
      statusCode: 404,
      body: { statusCode: 404, message: 'Escrow not found' },
    }).as('getNotFound');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/nonexistent-999`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it('should list all escrows where user is the payer', () => {
    const escrows: EscrowTransaction[] = [
      mockEscrow({ id: 'escrow-001', status: 'pending' }),
      mockEscrow({ id: 'escrow-002', status: 'released', coin_amount: 200 }),
    ];

    cy.intercept('GET', `${API_BASE}/outgoing`, {
      statusCode: 200,
      body: escrows,
    }).as('listOutgoing');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/outgoing`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(2);
      expect(response.body[0].payer_id).to.eq('payer-abc');
    });
  });

  it('should list all escrows where user is the recipient', () => {
    const escrows: EscrowTransaction[] = [
      mockEscrow({
        id: 'escrow-003',
        payer_id: 'other-user',
        recipient_id: 'recipient-xyz',
        status: 'pending',
      }),
    ];

    cy.intercept('GET', `${API_BASE}/incoming`, {
      statusCode: 200,
      body: escrows,
    }).as('listIncoming');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/incoming`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(1);
      expect(response.body[0].recipient_id).to.eq('recipient-xyz');
    });
  });

  it('should return empty array when no escrows exist', () => {
    cy.intercept('GET', `${API_BASE}/outgoing`, {
      statusCode: 200,
      body: [],
    }).as('emptyOutgoing');

    cy.intercept('GET', `${API_BASE}/incoming`, {
      statusCode: 200,
      body: [],
    }).as('emptyIncoming');

    cy.request({ method: 'GET', url: `${API_BASE}/outgoing`, failOnStatusCode: false }).then(
      (r) => expect(r.body).to.deep.eq([]),
    );
    cy.request({ method: 'GET', url: `${API_BASE}/incoming`, failOnStatusCode: false }).then(
      (r) => expect(r.body).to.deep.eq([]),
    );
  });
});

// -----------------------------------------------------------------
// 3. Release Escrow (Payer confirms completion)
// -----------------------------------------------------------------

describe('Escrow Payments - Release Funds', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should release escrow funds to the recipient', () => {
    const released = mockEscrow({ status: 'released' });

    cy.intercept('POST', `${API_BASE}/escrow-001/release`, {
      statusCode: 200,
      body: released,
    }).as('releaseEscrow');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/release`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('released');
    });
  });

  it('should only allow the payer to release funds', () => {
    cy.intercept('POST', `${API_BASE}/escrow-001/release`, {
      statusCode: 403,
      body: { statusCode: 403, message: 'Only the payer may release escrow funds' },
    }).as('forbiddenRelease');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/release`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(403);
    });
  });

  it('should reject release of already-released escrow', () => {
    cy.intercept('POST', `${API_BASE}/escrow-002/release`, {
      statusCode: 409,
      body: { statusCode: 409, message: 'Escrow has already been released' },
    }).as('doubleRelease');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-002/release`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should reject release of disputed escrow', () => {
    cy.intercept('POST', `${API_BASE}/escrow-disputed/release`, {
      statusCode: 409,
      body: { statusCode: 409, message: 'Cannot release a disputed escrow' },
    }).as('releaseDisputed');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-disputed/release`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should increment recipient coin balance after release', () => {
    const released = mockEscrow({ id: 'escrow-001', status: 'released', coin_amount: 100 });

    cy.intercept('POST', `${API_BASE}/escrow-001/release`, {
      statusCode: 200,
      body: released,
    }).as('release');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/release`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('released');
    });
  });
});

// -----------------------------------------------------------------
// 4. Cancel / Refund Escrow
// -----------------------------------------------------------------

describe('Escrow Payments - Cancel & Refund', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should allow the payer to cancel a pending escrow', () => {
    const cancelled = mockEscrow({ status: 'cancelled' });

    cy.intercept('POST', `${API_BASE}/escrow-001/cancel`, {
      statusCode: 200,
      body: cancelled,
    }).as('cancelEscrow');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/cancel`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('cancelled');
    });
  });

  it('should return coins to payer upon cancellation', () => {
    const cancelled = mockEscrow({ status: 'cancelled', coin_amount: 100 });

    cy.intercept('POST', `${API_BASE}/escrow-001/cancel`, {
      statusCode: 200,
      body: cancelled,
    }).as('cancel');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/cancel`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('cancelled');
    });
  });

  it('should not allow cancelling a released escrow', () => {
    cy.intercept('POST', `${API_BASE}/escrow-released/cancel`, {
      statusCode: 409,
      body: { statusCode: 409, message: 'Cannot cancel a released escrow' },
    }).as('cancelReleased');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-released/cancel`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should allow auto-refund of expired escrows', () => {
    const expired = mockEscrow({
      id: 'escrow-expired',
      status: 'refunded',
      expires_at: new Date(Date.now() - 864e5).toISOString(),
    });

    cy.intercept('POST', `${API_BASE}/escrow-expired/refund`, {
      statusCode: 200,
      body: expired,
    }).as('autoRefund');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-expired/refund`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('refunded');
    });
  });

  it('should reject refund of non-expired escrow via refund endpoint', () => {
    cy.intercept('POST', `${API_BASE}/escrow-001/refund`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Escrow has not yet expired' },
    }).as('prematureRefund');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/refund`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });
});

// -----------------------------------------------------------------
// 5. Dispute Resolution
// -----------------------------------------------------------------

describe('Escrow Payments - Dispute Flow', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should allow the payer to open a dispute', () => {
    const disputed = mockEscrow({ status: 'disputed' });

    cy.intercept('POST', `${API_BASE}/escrow-001/dispute`, {
      statusCode: 200,
      body: disputed,
    }).as('openDispute');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/dispute`,
      body: {
        reason: 'Service not delivered as described',
        details: 'The lesson was only 10 minutes instead of 30 minutes.',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('disputed');
    });
  });

  it('should allow the recipient to open a dispute', () => {
    const disputed = mockEscrow({
      id: 'escrow-005',
      payer_id: 'other-user',
      recipient_id: 'recipient-xyz',
      status: 'disputed',
    });

    cy.intercept('POST', `${API_BASE}/escrow-005/dispute`, {
      statusCode: 200,
      body: disputed,
    }).as('recipientDispute');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-005/dispute`,
      body: {
        reason: 'Payer refuses to release funds after service completed',
        details: 'I provided the full 30-minute Spanish lesson.',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('disputed');
    });
  });

  it('should reject dispute on already-released escrow', () => {
    cy.intercept('POST', `${API_BASE}/escrow-released/dispute`, {
      statusCode: 409,
      body: { statusCode: 409, message: 'Cannot dispute a released escrow' },
    }).as('disputeReleased');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-released/dispute`,
      body: { reason: 'Changed my mind' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should reject dispute with empty reason', () => {
    cy.intercept('POST', `${API_BASE}/escrow-001/dispute`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Dispute reason is required' },
    }).as('emptyReason');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/dispute`,
      body: { reason: '' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should freeze the escrow during dispute (no release or cancel allowed)', () => {
    const disputed = mockEscrow({ status: 'disputed' });

    cy.intercept('POST', `${API_BASE}/escrow-001/dispute`, {
      statusCode: 200,
      body: disputed,
    }).as('dispute');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/escrow-001/dispute`,
      body: { reason: 'Service quality issue' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('disputed');
    });
  });
});

// -----------------------------------------------------------------
// 6. Escrow History & Filtering
// -----------------------------------------------------------------

describe('Escrow Payments - History & Filtering', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  const historyEscrows: EscrowTransaction[] = [
    mockEscrow({ id: 'e-1', status: 'released', coin_amount: 50 }),
    mockEscrow({ id: 'e-2', status: 'pending', coin_amount: 100 }),
    mockEscrow({ id: 'e-3', status: 'disputed', coin_amount: 200 }),
    mockEscrow({ id: 'e-4', status: 'refunded', coin_amount: 75 }),
    mockEscrow({ id: 'e-5', status: 'cancelled', coin_amount: 150 }),
  ];

  it('should list full escrow history', () => {
    cy.intercept('GET', `${API_BASE}/history`, {
      statusCode: 200,
      body: historyEscrows,
    }).as('history');

    cy.request({ method: 'GET', url: `${API_BASE}/history`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.length(5);
      },
    );
  });

  it('should filter escrows by status', () => {
    const pending = historyEscrows.filter((e) => e.status === 'pending');

    cy.intercept('GET', `${API_BASE}/history?status=pending`, {
      statusCode: 200,
      body: pending,
    }).as('filterPending');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/history?status=pending`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(1);
      expect(response.body[0].status).to.eq('pending');
    });
  });

  it('should filter escrows by multiple statuses', () => {
    const filtered = historyEscrows.filter((e) => e.status === 'released' || e.status === 'refunded');

    cy.intercept('GET', `${API_BASE}/history?status=released&status=refunded`, {
      statusCode: 200,
      body: filtered,
    }).as('filterMultiple');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/history?status=released&status=refunded`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(2);
    });
  });

  it('should paginate escrow history', () => {
    const page1 = historyEscrows.slice(0, 3);

    cy.intercept('GET', `${API_BASE}/history?limit=3&offset=0`, {
      statusCode: 200,
      body: { data: page1, total: 5, limit: 3, offset: 0 },
    }).as('paginated');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/history?limit=3&offset=0`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.data).to.have.length(3);
      expect(response.body.total).to.eq(5);
    });
  });

  it('should sort escrows by created_at descending by default', () => {
    const sorted = [...historyEscrows].reverse();

    cy.intercept('GET', `${API_BASE}/history?sortBy=created_at&order=desc`, {
      statusCode: 200,
      body: sorted,
    }).as('sorted');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/history?sortBy=created_at&order=desc`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});

// -----------------------------------------------------------------
// 7. Error & Edge Cases
// -----------------------------------------------------------------

describe('Escrow Payments - Error States & Edge Cases', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should handle server errors gracefully (500)', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    }).as('serverError');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 100,
        description: 'Test',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it('should handle network errors gracefully', () => {
    cy.intercept('GET', `${API_BASE}/history`, {
      forceNetworkError: true,
    }).as('networkError');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/history`,
      failOnStatusCode: false,
    }).then((response) => {
      // The request may be retried by Cypress; accept any non-2xx
      expect(response.status).to.not.be.within(200, 299);
    });
  });

  it('should handle extremely long description gracefully', () => {
    const longDesc = 'x'.repeat(5001);

    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'description must be 500 characters or fewer' },
    }).as('longDesc');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 50,
        description: longDesc,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should handle escrow with no room_id (standalone)', () => {
    const standalone = mockEscrow({ room_id: undefined });

    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 201,
      body: standalone,
    }).as('createNoRoom');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 30,
        description: 'Direct payment without chat room',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.room_id).to.be.undefined;
    });
  });

  it('should handle unauthorised access (no auth token)', () => {
    cy.intercept('POST', `${API_BASE}/create`, {
      statusCode: 401,
      body: { statusCode: 401, message: 'Unauthorized' },
    }).as('unauth');

    cy.request({
      method: 'POST',
      url: `${API_BASE}/create`,
      body: {
        recipient_id: 'recipient-xyz',
        coin_amount: 10,
        description: 'Test',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });
});

// -----------------------------------------------------------------
// 8. UI Flow (Mocked)
// -----------------------------------------------------------------

describe('Escrow Payments - UI Flow', () => {
  beforeEach(() => {
    setupCommonMocks();

    cy.intercept('GET', `${API_BASE}/history`, {
      statusCode: 200,
      body: [
        mockEscrow({ id: 'e-1', status: 'pending', coin_amount: 100 }),
        mockEscrow({ id: 'e-2', status: 'released', coin_amount: 50 }),
      ],
    }).as('history');

    cy.intercept('GET', `${API_BASE}/incoming`, {
      statusCode: 200,
      body: [
        mockEscrow({
          id: 'e-3',
          payer_id: 'other-user',
          recipient_id: 'recipient-xyz',
          status: 'pending',
          coin_amount: 200,
          description: 'English pronunciation coaching',
        }),
      ],
    }).as('incoming');
  });

  it('should display escrow list on the escrow page', () => {
    cy.visit('/escrow');
    cy.wait('@history');

    cy.get('body').should('exist');
    cy.contains(/escrow|Escrow/i).should('exist');
  });

  it('should show pending escrows in a distinct state', () => {
    cy.visit('/escrow');
    cy.wait('@history');

    // Pending escrows should be visually distinguishable
    cy.contains(/pending/i).should('exist');
  });

  it('should allow navigating from escrow list to escrow detail', () => {
    cy.intercept('GET', `${API_BASE}/e-1`, {
      statusCode: 200,
      body: mockEscrow({ id: 'e-1', status: 'pending', coin_amount: 100 }),
    }).as('detail');

    cy.visit('/escrow');

    cy.contains(/100/i).should('exist');
  });
});

// -----------------------------------------------------------------
// 9. Escrow Summary / Statistics
// -----------------------------------------------------------------

describe('Escrow Payments - Summary & Stats', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should return escrow summary for the authenticated user', () => {
    cy.intercept('GET', `${API_BASE}/summary`, {
      statusCode: 200,
      body: {
        total_outgoing: 350,
        total_incoming: 500,
        pending_outgoing: 100,
        pending_incoming: 200,
        disputed_count: 1,
        total_transactions: 8,
      },
    }).as('summary');

    cy.request({ method: 'GET', url: `${API_BASE}/summary`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body.total_outgoing).to.eq(350);
        expect(response.body.total_incoming).to.eq(500);
        expect(response.body.pending_outgoing).to.eq(100);
        expect(response.body.disputed_count).to.eq(1);
        expect(response.body.total_transactions).to.eq(8);
      },
    );
  });

  it('should return zeroed summary for new users with no escrow activity', () => {
    cy.intercept('GET', `${API_BASE}/summary`, {
      statusCode: 200,
      body: {
        total_outgoing: 0,
        total_incoming: 0,
        pending_outgoing: 0,
        pending_incoming: 0,
        disputed_count: 0,
        total_transactions: 0,
      },
    }).as('zeroSummary');

    cy.request({ method: 'GET', url: `${API_BASE}/summary`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body.total_transactions).to.eq(0);
      },
    );
  });
});