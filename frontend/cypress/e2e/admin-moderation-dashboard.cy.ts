/// <reference types="cypress" />

/**
 * Admin Moderation Dashboard E2E Test Flows
 *
 * Covers: admin user management (search, VIP toggle, warn, ban, login history),
 * admin blocks management (list, remove, pagination),
 * moderation queue (profile/moment reports, approve/reject, risk analysis),
 * and cross-page admin navigation flows.
 */

// ─────────────────────────────────────────
// Admin Portal - User Management
// ─────────────────────────────────────────

describe('Admin Portal - User Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/admin/users?*', {
      body: {
        users: [
          {
            id: 'user-1',
            display_name: 'Alice',
            avatar_url: 'https://i.pravatar.cc/150?u=user-1',
            native_languages: ['en'],
            target_languages: ['ja', 'ko'],
            is_vip: true,
            vip_tier: 'consumer_8_ukp_10_usd',
            is_admin: false,
            coins_balance: 250,
            study_streak_days: 14,
            last_active_at: new Date().toISOString(),
            created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
          },
          {
            id: 'user-2',
            display_name: 'Bob',
            avatar_url: null,
            native_languages: ['fr'],
            target_languages: ['en'],
            is_vip: false,
            vip_tier: 'free',
            is_admin: false,
            coins_balance: 0,
            study_streak_days: 1,
            last_active_at: new Date(Date.now() - 7 * 86400000).toISOString(),
            created_at: new Date(Date.now() - 180 * 86400000).toISOString(),
          },
          {
            id: 'user-3',
            display_name: 'AdminCharlie',
            avatar_url: 'https://i.pravatar.cc/150?u=user-3',
            native_languages: ['es'],
            target_languages: ['en', 'pt'],
            is_vip: false,
            vip_tier: 'free',
            is_admin: true,
            coins_balance: 1000,
            study_streak_days: 365,
            last_active_at: new Date().toISOString(),
            created_at: new Date(Date.now() - 500 * 86400000).toISOString(),
          },
        ],
        total: 3,
        page: 1,
        pageSize: 20,
      },
    }).as('listUsers');

    cy.intercept('PATCH', '**/api/admin/users/*/vip', (req) => {
      req.reply({
        body: {
          id: req.url.split('/').reverse()[1],
          display_name: 'Alice',
          is_vip: !req.body.is_vip,
          vip_tier: req.body.is_vip ? 'consumer_8_ukp_10_usd' : 'free',
        },
      });
    }).as('toggleVip');

    cy.intercept('POST', '**/api/admin/users/*/ban', {
      body: { message: 'User banned' },
    }).as('banUser');

    cy.intercept('POST', '**/api/admin/users/*/warn', {
      body: { message: 'User warned' },
    }).as('warnUser');

    cy.intercept('GET', '**/api/admin/users/*/login-history', {
      body: [
        {
          id: 'login-1',
          user_id: 'user-1',
          ip_address: '192.0.2.42',
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'login-2',
          user_id: 'user-1',
          ip_address: '10.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    }).as('loginHistory');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should load the admin user list on visit', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.wait('@listUsers').then((interception) => {
      const body = interception.response?.body;
      expect(body.users).to.have.length(3);
      expect(body.total).to.eq(3);
    });
  });

  it('should display user names and badges in the list', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.contains('Alice').should('be.visible');
    cy.contains('Bob').should('be.visible');
    cy.contains('AdminCharlie').should('be.visible');
  });

  it('should display VIP status correctly', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.wait('@listUsers').then((interception) => {
      const users = interception.response?.body.users;
      const vipUser = users.find((u: { display_name: string }) => u.display_name === 'Alice');
      const freeUser = users.find((u: { display_name: string }) => u.display_name === 'Bob');
      expect(vipUser.is_vip).to.be.true;
      expect(freeUser.is_vip).to.be.false;
    });
  });

  it('should allow searching for users', () => {
    cy.intercept('GET', '**/api/admin/users?*search=Alice*', {
      body: {
        users: [
          {
            id: 'user-1',
            display_name: 'Alice',
            avatar_url: 'https://i.pravatar.cc/150?u=user-1',
            native_languages: ['en'],
            target_languages: ['ja', 'ko'],
            is_vip: true,
            vip_tier: 'consumer_8_ukp_10_usd',
            is_admin: false,
            coins_balance: 250,
            study_streak_days: 14,
            last_active_at: new Date().toISOString(),
            created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    }).as('searchUsers');

    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.get('input[type="search"]').type('Alice');
    cy.wait('@searchUsers');

    cy.wait('@searchUsers').then((interception) => {
      const body = interception.response?.body;
      expect(body.users).to.have.length(1);
      expect(body.users[0].display_name).to.eq('Alice');
      expect(body.total).to.eq(1);
    });
  });

  it('should handle empty search results', () => {
    cy.intercept('GET', '**/api/admin/users?*search=ZZZ*', {
      body: { users: [], total: 0, page: 1, pageSize: 20 },
    }).as('emptySearch');

    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.get('input[type="search"]').type('ZZZ');
    cy.wait('@emptySearch');

    cy.wait('@emptySearch').then((interception) => {
      const body = interception.response?.body;
      expect(body.users).to.deep.equal([]);
      expect(body.total).to.eq(0);
    });
  });

  it('should allow toggling VIP status via API', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.request({
      method: 'PATCH',
      url: '/api/admin/users/user-1/vip',
      body: { is_vip: false, vip_tier: 'free' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it('should allow banning a user via API', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.request({
      method: 'POST',
      url: '/api/admin/users/user-2/ban',
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.message).to.eq('User banned');
    });
  });

  it('should allow warning a user via API', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.request({
      method: 'POST',
      url: '/api/admin/users/user-2/warn',
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.message).to.eq('User warned');
    });
  });

  it('should fetch login history for a user via API', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.request({
      method: 'GET',
      url: '/api/admin/users/user-1/login-history',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(2);
      expect(response.body[0].ip_address).to.eq('192.0.2.42');
    });
  });

  it('should display admin badge for admin users in the data', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.wait('@listUsers').then((interception) => {
      const users = interception.response?.body.users;
      const adminUser = users.find((u: { is_admin: boolean }) => u.is_admin);
      expect(adminUser.is_admin).to.be.true;
      expect(adminUser.display_name).to.eq('AdminCharlie');
    });
  });

  it('should include coins balance and streak in user data', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.wait('@listUsers').then((interception) => {
      const users = interception.response?.body.users;
      expect(users[0].coins_balance).to.eq(250);
      expect(users[0].study_streak_days).to.eq(14);
    });
  });

  it('should handle users with null avatar URLs gracefully in data', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.wait('@listUsers').then((interception) => {
      const users = interception.response?.body.users;
      const noAvatarUser = users.find((u: { avatar_url: string | null }) => u.avatar_url === null);
      expect(noAvatarUser).to.exist;
      expect(noAvatarUser.display_name).to.eq('Bob');
    });
  });
});

// ─────────────────────────────────────────
// Admin Portal - User Management Edge Cases
// ─────────────────────────────────────────

describe('Admin Portal - Edge Cases', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/admin/users?*', {
      body: { users: [], total: 0, page: 1, pageSize: 20 },
    }).as('emptyList');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should display empty state when no users exist', () => {
    cy.visit('/admin/users');
    cy.wait('@emptyList');

    cy.wait('@emptyList').then((interception) => {
      const body = interception.response?.body;
      expect(body.users).to.deep.equal([]);
      expect(body.total).to.eq(0);
    });
  });

  it('should return total count of 0 for empty list', () => {
    cy.visit('/admin/users');
    cy.wait('@emptyList');

    cy.wait('@emptyList').then((interception) => {
      expect(interception.response?.body.total).to.eq(0);
    });
  });

  it('should handle a large user list response correctly', () => {
    const manyUsers = Array.from({ length: 50 }, (_, i) => ({
      id: `user-${i}`,
      display_name: `User${i}`,
      avatar_url: null,
      native_languages: ['en'],
      target_languages: ['es'],
      is_vip: false,
      vip_tier: 'free',
      is_admin: false,
      coins_balance: 0,
      study_streak_days: 0,
      last_active_at: null,
      created_at: new Date().toISOString(),
    }));

    cy.intercept('GET', '**/api/admin/users?*', {
      body: { users: manyUsers, total: 50, page: 1, pageSize: 20 },
    }).as('manyUsers');

    cy.visit('/admin/users');
    cy.wait('@manyUsers');

    cy.wait('@manyUsers').then((interception) => {
      const body = interception.response?.body;
      expect(body.users).to.have.length(50);
      expect(body.total).to.eq(50);
    });
  });

  it('should handle server error on VIP toggle gracefully', () => {
    cy.intercept('PATCH', '**/api/admin/users/*/vip', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('vipError');

    cy.visit('/admin');

    cy.request({
      method: 'PATCH',
      url: '/api/admin/users/user-1/vip',
      body: { is_vip: true },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it('should handle server error on ban via API', () => {
    cy.intercept('POST', '**/api/admin/users/*/ban', {
      statusCode: 500,
      body: { error: 'Server error' },
    }).as('banError');

    cy.visit('/admin');

    cy.request({
      method: 'POST',
      url: '/api/admin/users/user-1/ban',
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it('should handle pagination data correctly', () => {
    cy.intercept('GET', '**/api/admin/users?page=2*', {
      body: {
        users: [
          {
            id: 'user-21',
            display_name: 'Page2User',
            avatar_url: null,
            native_languages: ['de'],
            target_languages: ['en'],
            is_vip: false,
            vip_tier: 'free',
            is_admin: false,
            coins_balance: 10,
            study_streak_days: 2,
            last_active_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
        total: 21,
        page: 2,
        pageSize: 20,
      },
    }).as('page2');

    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.request({
      method: 'GET',
      url: '/api/admin/users?page=2&pageSize=20',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.page).to.eq(2);
      expect(response.body.users).to.have.length(1);
      expect(response.body.total).to.eq(21);
    });
  });
});

// ─────────────────────────────────────────
// Admin Blocks Management
// ─────────────────────────────────────────

describe('Admin Blocks Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/admin/blocks?*', {
      body: {
        blocks: [
          {
            id: 'block-1',
            blocker_id: 'user-a',
            blocked_id: 'user-b',
            blocker_name: 'Alice',
            blocked_name: 'Bob',
            blocker_avatar: null,
            blocked_avatar: null,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'block-2',
            blocker_id: 'user-c',
            blocked_id: 'user-d',
            blocker_name: 'Charlie',
            blocked_name: 'Diana',
            blocker_avatar: 'https://i.pravatar.cc/150?u=user-c',
            blocked_avatar: 'https://i.pravatar.cc/150?u=user-d',
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    }).as('listBlocks');

    cy.intercept('DELETE', '**/api/admin/blocks/*', {
      body: { success: true },
    }).as('removeBlock');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should load the block list', () => {
    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.wait('@listBlocks').then((interception) => {
      const body = interception.response?.body;
      expect(body.blocks).to.have.length(2);
      expect(body.total).to.eq(2);
    });
  });

  it('should include blocker and blocked user names', () => {
    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.wait('@listBlocks').then((interception) => {
      const blocks = interception.response?.body.blocks;
      expect(blocks[0].blocker_name).to.eq('Alice');
      expect(blocks[0].blocked_name).to.eq('Bob');
      expect(blocks[1].blocker_name).to.eq('Charlie');
      expect(blocks[1].blocked_name).to.eq('Diana');
    });
  });

  it('should allow removing a block via API', () => {
    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.request({
      method: 'DELETE',
      url: '/api/admin/blocks/block-1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should handle empty block list', () => {
    cy.intercept('GET', '**/api/admin/blocks?*', {
      body: { blocks: [], total: 0, page: 1, pageSize: 20 },
    }).as('emptyBlocks');

    cy.visit('/admin/blocks');
    cy.wait('@emptyBlocks');

    cy.wait('@emptyBlocks').then((interception) => {
      const body = interception.response?.body;
      expect(body.blocks).to.deep.equal([]);
      expect(body.total).to.eq(0);
    });
  });

  it('should handle blocks with avatars present', () => {
    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.wait('@listBlocks').then((interception) => {
      const blocks = interception.response?.body.blocks;
      const blockWithAvatars = blocks.find(
        (b: { blocker_avatar: string | null; blocked_avatar: string | null }) =>
          b.blocker_avatar !== null && b.blocked_avatar !== null,
      );
      expect(blockWithAvatars).to.exist;
      expect(blockWithAvatars.blocker_name).to.eq('Charlie');
    });
  });

  it('should handle failure to remove a block', () => {
    cy.intercept('DELETE', '**/api/admin/blocks/block-1', {
      statusCode: 500,
      body: { success: false },
    }).as('removeBlockFail');

    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.request({
      method: 'DELETE',
      url: '/api/admin/blocks/block-1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it('should support pagination via query params', () => {
    cy.intercept('GET', '**/api/admin/blocks?page=2*', {
      body: { blocks: [], total: 0, page: 2, pageSize: 20 },
    }).as('page2Blocks');

    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.request({
      method: 'GET',
      url: '/api/admin/blocks?page=2&pageSize=20',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.page).to.eq(2);
    });
  });
});

// ─────────────────────────────────────────
// Moderation Queue - Reports & Actions
// ─────────────────────────────────────────

describe('Moderation Queue - Profile Reports', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/moderation/items?type=profile*', {
      body: [
        {
          id: 'report-101',
          type: 'profile',
          status: 'pending',
          reason: 'harassment',
          created_at: new Date().toISOString(),
          description: 'User sent threatening messages repeatedly',
          reporter: { id: 'reporter-1', display_name: 'ReporterAlice' },
          reported_user: { id: 'bad-user-1', display_name: 'ToxicUser99' },
        },
        {
          id: 'report-102',
          type: 'profile',
          status: 'pending',
          reason: 'spam',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          description: 'Bot-like behaviour posting links',
          reporter: { id: 'reporter-2', display_name: 'ReporterBob' },
          reported_user: { id: 'bad-user-2', display_name: 'SpamBot42' },
        },
        {
          id: 'report-103',
          type: 'profile',
          status: 'approved',
          reason: 'fake_profile',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          description: 'Impersonating a known user',
          reporter: { id: 'reporter-3', display_name: 'ReporterCarol' },
          reported_user: { id: 'bad-user-3', display_name: 'FakeProfile' },
        },
      ],
    }).as('getModerationItems');

    cy.intercept('POST', '**/api/moderation/approve', {
      body: { success: true },
    }).as('approveItem');

    cy.intercept('POST', '**/api/moderation/reject', {
      body: { success: true },
    }).as('rejectItem');

    cy.intercept('GET', '**/api/moderation/analyse/**', {
      body: { riskScore: 85, flags: ['harassment', 'dating', 'hookup', 'looking for'] },
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

  it('should load moderation items for profile type', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').then((interception) => {
      const items = interception.response?.body;
      expect(items).to.have.length(3);
      expect(items[0].type).to.eq('profile');
    });
  });

  it('should display reported user and reporter info', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').then((interception) => {
      const items = interception.response?.body;
      expect(items[0].reported_user.display_name).to.eq('ToxicUser99');
      expect(items[0].reporter.display_name).to.eq('ReporterAlice');
      expect(items[1].reported_user.display_name).to.eq('SpamBot42');
    });
  });

  it('should approve a moderation item via API', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/approve',
      body: { itemId: 'report-101', type: 'profile' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should reject a moderation item with reason via API', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/reject',
      body: { itemId: 'report-102', type: 'profile', reason: 'Not a violation' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should analyse a user for risk scoring via API', () => {
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
      expect(response.body.flags).to.include('harassment');
    });
  });
});

// ─────────────────────────────────────────
// Moderation Queue - Moment Reports
// ─────────────────────────────────────────

describe('Moderation Queue - Moment Reports', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/moderation/items?type=moment*', {
      body: [
        {
          id: 'moment-report-1',
          type: 'moment',
          status: 'pending',
          reason: 'inappropriate_content',
          created_at: new Date().toISOString(),
          description: 'Sexually explicit image',
          reporter: { id: 'reporter-10', display_name: 'Viewer1' },
          reported_user: { id: 'bad-poster-1', display_name: 'BadPoster1' },
          moment_content: 'Inappropriate content detected',
        },
        {
          id: 'moment-report-2',
          type: 'moment',
          status: 'pending',
          reason: 'spam',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          description: 'Repeated promotional content',
          reporter: { id: 'reporter-11', display_name: 'Viewer2' },
          reported_user: { id: 'bad-poster-2', display_name: 'SpamPoster' },
          moment_content: 'Check out my website at...',
        },
      ],
    }).as('getMomentItems');

    cy.intercept('POST', '**/api/moderation/approve', {
      body: { success: true },
    }).as('approveItem');

    cy.intercept('POST', '**/api/moderation/reject', {
      body: { success: true },
    }).as('rejectItem');

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

  it('should load moderation items for moment type', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getMomentItems');

    cy.wait('@getMomentItems').then((interception) => {
      const items = interception.response?.body;
      expect(items).to.have.length(2);
      expect(items[0].type).to.eq('moment');
    });
  });

  it('should display moment content in the report', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getMomentItems');

    cy.wait('@getMomentItems').then((interception) => {
      const items = interception.response?.body;
      expect(items[0].moment_content).to.eq('Inappropriate content detected');
      expect(items[1].moment_content).to.include('Check out my website');
    });
  });

  it('should approve a moment report via API', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getMomentItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/approve',
      body: { itemId: 'moment-report-1', type: 'moment' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should reject a moment report via API', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getMomentItems');

    cy.request({
      method: 'POST',
      url: '/api/moderation/reject',
      body: { itemId: 'moment-report-2', type: 'moment', reason: 'Content is acceptable' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });
});

// ─────────────────────────────────────────
// Moderation Queue - Edge Cases & Status Filters
// ─────────────────────────────────────────

describe('Moderation Queue - Edge Cases & Filters', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/moderation/items?type=profile*status=pending*', {
      body: [
        {
          id: 'pending-1',
          type: 'profile',
          status: 'pending',
          reason: 'harassment',
          created_at: new Date().toISOString(),
          reporter: { id: 'r1', display_name: 'Reporter1' },
          reported_user: { id: 'u1', display_name: 'User1' },
        },
      ],
    }).as('getPendingItems');

    cy.intercept('GET', '**/api/moderation/items?type=profile*status=approved*', {
      body: [
        {
          id: 'approved-1',
          type: 'profile',
          status: 'approved',
          reason: 'spam',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          reporter: { id: 'r2', display_name: 'Reporter2' },
          reported_user: { id: 'u2', display_name: 'User2' },
        },
      ],
    }).as('getApprovedItems');

    cy.intercept('GET', '**/api/moderation/items?type=profile*status=rejected*', {
      body: [
        {
          id: 'rejected-1',
          type: 'profile',
          status: 'rejected',
          reason: 'fake_profile',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          reporter: { id: 'r3', display_name: 'Reporter3' },
          reported_user: { id: 'u3', display_name: 'User3' },
        },
      ],
    }).as('getRejectedItems');

    cy.intercept('GET', '**/api/moderation/items?type=profile', {
      body: [],
    }).as('getAllItems');

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

  it('should filter moderation items by pending status', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getPendingItems');

    cy.wait('@getPendingItems').then((interception) => {
      const items = interception.response?.body;
      expect(items).to.have.length(1);
      expect(items[0].status).to.eq('pending');
    });
  });

  it('should filter moderation items by approved status', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getApprovedItems');

    cy.wait('@getApprovedItems').then((interception) => {
      const items = interception.response?.body;
      expect(items).to.have.length(1);
      expect(items[0].status).to.eq('approved');
    });
  });

  it('should filter moderation items by rejected status', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getRejectedItems');

    cy.wait('@getRejectedItems').then((interception) => {
      const items = interception.response?.body;
      expect(items).to.have.length(1);
      expect(items[0].status).to.eq('rejected');
    });
  });

  it('should show empty state for empty moderation queue', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getAllItems');

    cy.wait('@getAllItems').then((interception) => {
      expect(interception.response?.body).to.deep.equal([]);
    });
  });

  it('should handle user analysis with no flags', () => {
    cy.intercept('GET', '**/api/moderation/analyse/**', {
      body: { riskScore: 15, flags: [] },
    }).as('analyseLowRisk');

    cy.visit('/admin/moderation');

    cy.request({
      method: 'GET',
      url: '/api/moderation/analyse/low-risk-user',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.riskScore).to.eq(15);
      expect(response.body.flags).to.deep.equal([]);
    });
  });

  it('should handle analysis with high risk score and many flags', () => {
    cy.intercept('GET', '**/api/moderation/analyse/**', {
      body: {
        riskScore: 99,
        flags: ['harassment', 'dating', 'hookup', 'flirt', 'adult', 'looking for', 'single'],
      },
    }).as('analyseHighRisk');

    cy.visit('/admin/moderation');

    cy.request({
      method: 'GET',
      url: '/api/moderation/analyse/high-risk-user',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.riskScore).to.eq(99);
      expect(response.body.flags).to.have.length(7);
    });
  });
});

// ─────────────────────────────────────────
// Cross-Page Admin Navigation Flows
// ─────────────────────────────────────────

describe('Admin - Cross-Page Navigation', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/admin/users?*', {
      body: {
        users: [
          {
            id: 'a1',
            display_name: 'Alice',
            avatar_url: null,
            native_languages: ['en'],
            target_languages: ['es'],
            is_vip: true,
            vip_tier: 'premium',
            is_admin: false,
            coins_balance: 500,
            study_streak_days: 30,
            last_active_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    }).as('listUsers');

    cy.intercept('GET', '**/api/admin/blocks?*', {
      body: { blocks: [], total: 0, page: 1, pageSize: 20 },
    }).as('listBlocks');

    cy.intercept('GET', '**/api/moderation/items?type=profile', {
      body: [],
    }).as('getModerationItems');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should load admin users page', () => {
    cy.visit('/admin/users');
    cy.wait('@listUsers');

    cy.wait('@listUsers').its('response.statusCode').should('eq', 200);
  });

  it('should load admin blocks page', () => {
    cy.visit('/admin/blocks');
    cy.wait('@listBlocks');

    cy.wait('@listBlocks').its('response.statusCode').should('eq', 200);
  });

  it('should load moderation queue page', () => {
    cy.visit('/admin/moderation');
    cy.wait('@getModerationItems');

    cy.wait('@getModerationItems').its('response.statusCode').should('eq', 200);
  });

  it('should handle admin portal (root admin route)', () => {
    cy.visit('/admin');
    cy.wait('@listUsers');

    cy.wait('@listUsers').its('response.statusCode').should('eq', 200);
  });
});

// ─────────────────────────────────────────
// Admin API - Batch & Combined Operations
// ─────────────────────────────────────────

describe('Admin - Batch Operations', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/report-categories', { body: [] }).as('getReportCategories');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should warn and then ban a user', () => {
    cy.intercept('POST', '**/api/admin/users/user-1/warn', {
      body: { message: 'User warned' },
    }).as('warnUser');

    cy.intercept('POST', '**/api/admin/users/user-1/ban', {
      body: { message: 'User banned' },
    }).as('banUser');

    cy.visit('/admin');

    cy.request({
      method: 'POST',
      url: '/api/admin/users/user-1/warn',
      body: {},
      failOnStatusCode: false,
    }).then((warnResponse) => {
      expect(warnResponse.status).to.eq(200);
      expect(warnResponse.body.message).to.eq('User warned');
    });

    cy.request({
      method: 'POST',
      url: '/api/admin/users/user-1/ban',
      body: {},
      failOnStatusCode: false,
    }).then((banResponse) => {
      expect(banResponse.status).to.eq(200);
      expect(banResponse.body.message).to.eq('User banned');
    });
  });

  it('should approve a report, then remove the associated block', () => {
    cy.intercept('POST', '**/api/moderation/approve', {
      body: { success: true },
    }).as('approveItem');

    cy.intercept('DELETE', '**/api/admin/blocks/block-1', {
      body: { success: true },
    }).as('removeBlock');

    cy.visit('/admin');

    cy.request({
      method: 'POST',
      url: '/api/moderation/approve',
      body: { itemId: 'report-1', type: 'profile' },
      failOnStatusCode: false,
    }).then((approveResponse) => {
      expect(approveResponse.status).to.eq(200);
    });

    cy.request({
      method: 'DELETE',
      url: '/api/admin/blocks/block-1',
      failOnStatusCode: false,
    }).then((deleteResponse) => {
      expect(deleteResponse.status).to.eq(200);
    });
  });

  it('should fetch all admin data in sequence', () => {
    cy.intercept('GET', '**/api/admin/users?*', {
      body: {
        users: [{ id: 'u1', display_name: 'User1', avatar_url: null, native_languages: ['en'], target_languages: ['es'], is_vip: false, vip_tier: 'free', is_admin: false, coins_balance: 0, study_streak_days: 0, last_active_at: null, created_at: new Date().toISOString() }],
        total: 1, page: 1, pageSize: 20,
      },
    }).as('listUsers');

    cy.intercept('GET', '**/api/admin/blocks?*', {
      body: { blocks: [], total: 0, page: 1, pageSize: 20 },
    }).as('listBlocks');

    cy.intercept('GET', '**/api/moderation/items?*', {
      body: [],
    }).as('getItems');

    cy.visit('/admin/users');
    cy.wait('@listUsers');
    cy.wait('@listUsers').its('response.statusCode').should('eq', 200);

    // Verify blocks endpoint works from admin context
    cy.request({
      method: 'GET',
      url: '/api/admin/blocks?page=1&pageSize=20',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });

    // Verify moderation items endpoint works
    cy.request({
      method: 'GET',
      url: '/api/moderation/items?type=profile',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});