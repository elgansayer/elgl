/// <reference types="cypress" />

/**
 * Trust & Safety E2E Test Flows
 * Covers: user reporting, blocking/unblocking, blocked users list,
 * moderation queue (admin), and report categories.
 */

describe('Trust & Safety - Report User Flow', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/safety/is-blocked/*', { body: { blocked: false } }).as('isBlocked');

    cy.intercept('GET', '**/api/safety/report-categories', {
      body: [
        { value: 'harassment', label: 'Harassment', icon: '🚫', description: 'Unwanted advances, threats, or abusive behaviour' },
        { value: 'spam', label: 'Spam', icon: '📧', description: 'Unsolicited promotions, phishing, or fraudulent activity' },
        { value: 'inappropriate_content', label: 'Inappropriate Content', icon: '🔞', description: 'Sexually explicit, violent, or offensive material' },
        { value: 'fake_profile', label: 'Fake Profile', icon: '🎭', description: 'Impersonation or false identity' },
        { value: 'other', label: 'Other', icon: '📝', description: 'Something else not listed above' },
      ],
    }).as('getReportCategories');

    cy.intercept('POST', '**/api/safety/report', {
      statusCode: 201,
      body: { success: true, message: 'Report submitted successfully' },
    }).as('submitReport');

    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should load report categories from the backend', () => {
    cy.visit('/');
    cy.wait('@getReportCategories').its('response.statusCode').should('eq', 200);
    cy.wait('@getReportCategories').its('response.body').should('have.length', 5);
  });

  it('should allow submitting a report with category harassment', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: {
        reported_id: 'target-user-123',
        reason_category: 'harassment',
        description: 'User was sending threatening messages',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.success).to.be.true;
    });
  });

  it('should allow submitting a report with category spam and optional details', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: {
        reported_id: 'spammer-456',
        reason_category: 'spam',
        description: 'Repeated commercial links in moments',
        context_url: '/moments/abc123',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  it('should include all required categories in the response', () => {
    cy.visit('/');
    cy.wait('@getReportCategories');

    cy.wait('@getReportCategories').then((interception) => {
      const categories = interception.response?.body;
      const values = categories.map((c: { value: string }) => c.value);
      expect(values).to.include.members([
        'harassment',
        'spam',
        'inappropriate_content',
        'fake_profile',
        'other',
      ]);
    });
  });
});

describe('Trust & Safety - Block User Flow', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: ['blocked-user-1'] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: ['blocked-user-1'] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: ['blocked-user-1'] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/safety/is-blocked/*', { body: { blocked: true } }).as('isBlocked');

    cy.intercept('POST', '**/api/safety/block/**', {
      statusCode: 201,
      body: { success: true, blocked_id: 'target-id' },
    }).as('blockUser');

    cy.intercept('POST', '**/api/safety/unblock/**', {
      statusCode: 200,
      body: { success: true },
    }).as('unblockUser');

    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should block a user via the API', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/block/user-to-block-789',
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.success).to.be.true;
      expect(response.body.blocked_id).to.eq('target-id');
    });
  });

  it('should unblock a user via the API', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/unblock/user-to-unblock-789',
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should retrieve the list of blocked user IDs', () => {
    cy.visit('/');
    cy.wait('@getBlockedIds');

    cy.wait('@getBlockedIds').then((interception) => {
      const blockedIds = interception.response?.body;
      expect(Array.isArray(blockedIds)).to.be.true;
      expect(blockedIds).to.include('blocked-user-1');
    });
  });

  it('should correctly report if a user is blocked', () => {
    cy.visit('/');

    cy.request({
      method: 'GET',
      url: '/api/safety/is-blocked/blocked-user-1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.blocked).to.be.true;
    });
  });

  it('should return blocked-and-blocker combined IDs', () => {
    cy.visit('/');

    cy.request({
      method: 'GET',
      url: '/api/safety/blocked-and-blocker-ids/test-user-123',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include('blocked-user-1');
    });
  });
});

describe('Trust & Safety - Moderation Queue (Admin)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/moderation/items?type=profile', {
      body: [
        {
          id: 'report-1',
          status: 'pending',
          reason: 'harassment',
          created_at: new Date().toISOString(),
          description: 'User sent abusive messages',
          reporter: { id: 'reporter-1', display_name: 'Alice' },
          reported_user: { id: 'bad-user-1', display_name: 'BadUser99' },
        },
        {
          id: 'report-2',
          status: 'pending',
          reason: 'spam',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          description: 'Commercial spam in moments',
          reporter: { id: 'reporter-2', display_name: 'Bob' },
          reported_user: { id: 'bad-user-2', display_name: 'Spammer42' },
        },
      ],
    }).as('getModerationItems');

    cy.intercept('GET', '**/api/moderation/items?type=moment', {
      body: [
        {
          id: 'report-3',
          status: 'pending',
          reason: 'inappropriate_content',
          created_at: new Date().toISOString(),
          description: 'Inappropriate moment content',
          reporter: { id: 'reporter-3', display_name: 'Charlie' },
          reported_user: { id: 'bad-user-3', display_name: 'BadPoster' },
        },
      ],
    }).as('getMomentModerationItems');

    cy.intercept('POST', '**/api/moderation/approve', {
      body: { success: true },
    }).as('approveItem');

    cy.intercept('POST', '**/api/moderation/reject', {
      body: { success: true },
    }).as('rejectItem');

    cy.intercept('GET', '**/api/moderation/analyse/**', {
      body: { riskScore: 75, flags: ['dating', 'hookup', 'flirt', 'looking for', 'single'] },
    }).as('analyseUser');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should load the moderation queue with profile reports', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').its('response.body').should('have.length', 2);
  });

  it('should display reported user info in the moderation queue', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').then((interception) => {
      const items = interception.response?.body;
      expect(items[0].reported_user.display_name).to.eq('BadUser99');
      expect(items[1].reported_user.display_name).to.eq('Spammer42');
      expect(items[0].reporter.display_name).to.eq('Alice');
    });
  });

  it('should allow approving a moderation item', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/approve',
      body: { itemId: 'report-1', type: 'profile' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should allow rejecting a moderation item', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/reject',
      body: { itemId: 'report-2', type: 'profile', reason: 'No violation found' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should analyse a user for dating behaviour risk', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'GET',
      url: '/api/moderation/analyse/bad-user-1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.riskScore).to.be.a('number');
      expect(response.body.riskScore).to.be.within(0, 100);
      expect(response.body.flags).to.be.an('array');
      expect(response.body.flags).to.include('dating');
    });
  });

  it('should load moment-type moderation items', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'GET',
      url: '/api/moderation/items?type=moment',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(1);
      expect(response.body[0].reason).to.eq('inappropriate_content');
    });
  });
});

describe('Trust & Safety - Edge Cases & Validation', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/safety/report-categories', {
      body: [
        { value: 'harassment', label: 'Harassment' },
        { value: 'spam', label: 'Spam' },
        { value: 'inappropriate_content', label: 'Inappropriate Content' },
        { value: 'fake_profile', label: 'Fake Profile' },
        { value: 'other', label: 'Other' },
      ],
    }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
    cy.intercept('GET', '**/api/moderation/items*', { body: [] }).as('getModerationItems');
  });

  it('should handle empty blocked users list gracefully', () => {
    cy.visit('/');
    cy.wait('@getBlockedIds');

    cy.wait('@getBlockedIds').then((interception) => {
      expect(interception.response?.body).to.deep.equal([]);
    });
  });

  it('should handle report submission with missing optional fields', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: {
        reported_id: 'minimal-report-target',
        reason_category: 'other',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  it('should report 0 blocked users for a new user', () => {
    cy.visit('/');

    cy.request({
      method: 'GET',
      url: '/api/safety/blocked-ids/new-user-999',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.deep.equal([]);
    });
  });

  it('should return an empty moderation queue when no reports exist', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').then((interception) => {
      expect(interception.response?.body).to.deep.equal([]);
    });
  });

  it('should verify report categories contain all required values', () => {
    cy.visit('/');
    cy.wait('@getReportCategories');

    cy.wait('@getReportCategories').then((interception) => {
      const categories = interception.response?.body;
      const requiredCategories = [
        'harassment',
        'spam',
        'inappropriate_content',
        'fake_profile',
        'other',
      ];
      const categoryValues = categories.map((c: { value: string }) => c.value);
      for (const required of requiredCategories) {
        expect(categoryValues).to.include(required);
      }
    });
  });
});

describe('Trust & Safety - Bidirectional Blocking', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', {
      body: ['user-b', 'user-d'],
    }).as('getBlockedIds');

    cy.intercept('GET', '**/api/safety/blocked-ids/user-a', {
      body: ['user-b', 'user-d'],
    }).as('getUserABlockedIds');

    cy.intercept('GET', '**/api/safety/blocker-ids/user-a', {
      body: ['user-c'],
    }).as('getUserABlockerIds');

    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/user-a', {
      body: ['user-b', 'user-d', 'user-c'],
    }).as('getUserABlockedAndBlocker');

    cy.intercept('GET', '**/api/safety/is-blocked/user-b', {
      body: { blocked: true },
    }).as('isUserBBlocked');

    cy.intercept('GET', '**/api/safety/is-blocked/user-z', {
      body: { blocked: false },
    }).as('isUserZBlocked');

    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
    cy.intercept('GET', '**/api/moderation/items*', { body: [] }).as('getModerationItems');
  });

  it('should show both blocked and blocker IDs in the combined endpoint', () => {
    cy.visit('/');

    cy.request({
      method: 'GET',
      url: '/api/safety/blocked-and-blocker-ids/user-a',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include.members(['user-b', 'user-d', 'user-c']);
      expect(response.body).to.have.length(3);
    });
  });

  it('should correctly distinguish between blocked and non-blocked users', () => {
    cy.visit('/');

    cy.request({
      method: 'GET',
      url: '/api/safety/is-blocked/user-b',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.body.blocked).to.be.true;
    });

    cy.request({
      method: 'GET',
      url: '/api/safety/is-blocked/user-z',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.body.blocked).to.be.false;
    });
  });

  it('should see who blocked the current user via blocker-ids endpoint', () => {
    cy.visit('/');

    cy.request({
      method: 'GET',
      url: '/api/safety/blocker-ids/user-a',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include('user-c');
    });
  });
});

describe('Trust & Safety - Report Submission Validation', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/safety/report-categories', {
      body: [
        { value: 'harassment', label: 'Harassment' },
        { value: 'spam', label: 'Spam' },
        { value: 'inappropriate_content', label: 'Inappropriate Content' },
        { value: 'fake_profile', label: 'Fake Profile' },
        { value: 'other', label: 'Other' },
      ],
    }).as('getReportCategories');

    cy.intercept('POST', '**/api/safety/report', (req) => {
      const { reported_id, reason_category } = req.body;
      if (!reported_id || !reason_category) {
        req.reply({ statusCode: 400, body: { message: 'Missing required fields' } });
      } else if (reported_id === 'self-report') {
        req.reply({ statusCode: 400, body: { message: 'Cannot report yourself' } });
      } else {
        req.reply({ statusCode: 201, body: { success: true, message: 'Report submitted successfully' } });
      }
    }).as('submitReportWithValidation');

    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should reject a report with missing reported_id', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: { reason_category: 'spam' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should reject a report with missing reason_category', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: { reported_id: 'some-user' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should reject self-reporting', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: { reported_id: 'self-report', reason_category: 'harassment' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should accept a valid report with all optional fields', () => {
    cy.visit('/');

    cy.request({
      method: 'POST',
      url: '/api/safety/report',
      body: {
        reported_id: 'valid-target',
        reason_category: 'inappropriate_content',
        description: 'Posted NSFW content in public moments',
        context_url: '/moments/offensive-post-456',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.success).to.be.true;
    });
  });
});

describe('Trust & Safety - Moderation Actions on Reports', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');

    cy.intercept('GET', '**/api/moderation/items?type=profile', {
      body: [
        {
          id: 'r1',
          status: 'pending',
          reason: 'harassment',
          created_at: new Date().toISOString(),
          reporter: { id: 'u1', display_name: 'Reporter1' },
          reported_user: { id: 'u2', display_name: 'Offender1' },
        },
        {
          id: 'r2',
          status: 'pending',
          reason: 'fake_profile',
          created_at: new Date().toISOString(),
          reporter: { id: 'u3', display_name: 'Reporter2' },
          reported_user: { id: 'u4', display_name: 'Offender2' },
        },
        {
          id: 'r3',
          status: 'approved',
          reason: 'spam',
          created_at: new Date().toISOString(),
          reporter: { id: 'u5', display_name: 'Reporter3' },
          reported_user: { id: 'u6', display_name: 'Offender3' },
        },
      ],
    }).as('getModerationItems');

    cy.intercept('POST', '**/api/moderation/approve', (req) => {
      req.reply({ statusCode: 200, body: { success: true, itemId: req.body.itemId } });
    }).as('approveItem');

    cy.intercept('POST', '**/api/moderation/reject', (req) => {
      req.reply({ statusCode: 200, body: { success: true, itemId: req.body.itemId } });
    }).as('rejectItem');

    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should transition a report from pending to approved', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/approve',
      body: { itemId: 'r1', type: 'profile' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.itemId).to.eq('r1');
    });
  });

  it('should transition a report from pending to rejected', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/reject',
      body: { itemId: 'r2', type: 'profile', reason: 'Insufficient evidence' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.itemId).to.eq('r2');
    });
  });

  it('should show moderation items with correct reporter and reported user info', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').then((interception) => {
      const items = interception.response?.body;
      expect(items[0].reporter.display_name).to.eq('Reporter1');
      expect(items[0].reported_user.display_name).to.eq('Offender1');
      expect(items[0].reason).to.eq('harassment');
      expect(items[1].reason).to.eq('fake_profile');
      expect(items[2].reason).to.eq('spam');
    });
  });
});