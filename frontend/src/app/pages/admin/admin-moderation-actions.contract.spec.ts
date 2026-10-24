import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = process.cwd();
const component = readFileSync(
  resolve(frontendRoot, 'src/app/pages/admin/admin-users.component.ts'),
  'utf8',
);
const template = readFileSync(
  resolve(frontendRoot, 'src/app/pages/admin/admin-users.component.html'),
  'utf8',
);
const adminClient = readFileSync(
  resolve(frontendRoot, 'src/app/services/admin.service.ts'),
  'utf8',
);
const adminController = readFileSync(
  resolve(frontendRoot, '../backend/src/admin/admin.controller.ts'),
  'utf8',
);
const adminService = readFileSync(
  resolve(frontendRoot, '../backend/src/admin/admin.service.ts'),
  'utf8',
);

function between(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe('admin one-click moderation actions contract', () => {
  it('renders warning and ban actions that are disabled offline or while the same action is pending', () => {
    expect(template).toContain('(click)="warnUser(user)"');
    expect(template).toContain('(click)="banUser(user)"');
    expect(template).toContain("[disabled]=\"isWarning() !== null || !isOnline()\"");
    expect(template).toContain("[disabled]=\"isBanning() !== null || !isOnline()\"");
    expect(template).toContain("{{ 'admin.users.warn' | t }}");
    expect(template).toContain("{{ 'admin.users.ban' | t }}");
  });

  it('serializes duplicate actions and always releases pending state after success or failure', () => {
    const banAction = between(component, 'async banUser(', 'async warnUser(');
    const warnAction = between(component, 'async warnUser(', 'private reportCrash(');

    expect(banAction).toContain('if (this.isBanning())');
    expect(banAction).toContain('await this.adminService.banUser(user.id);');
    expect(banAction).toContain("this.reportCrash(err, 'banUser');");
    expect(banAction).toContain('this.isBanning.set(null);');

    expect(warnAction).toContain('if (this.isWarning())');
    expect(warnAction).toContain('await this.adminService.warnUser(user.id);');
    expect(warnAction).toContain("this.reportCrash(err, 'warnUser');");
    expect(warnAction).toContain('this.isWarning.set(null);');
  });

  it('uses authenticated backend mutations without mock-success fallbacks', () => {
    const banClient = between(adminClient, 'async banUser(', 'async warnUser(');
    const warnClient = between(adminClient, 'async warnUser(', 'async listAllBlocks(');

    expect(banClient).toContain("`${this.baseUrl}/users/${userId}/ban`");
    expect(banClient).toContain('{ headers: this.getHeaders() }');
    expect(warnClient).toContain("`${this.baseUrl}/users/${userId}/warn`");
    expect(warnClient).toContain('{ headers: this.getHeaders() }');

    expect(banClient).not.toMatch(/mock|fallback|Promise\.resolve/i);
    expect(warnClient).not.toMatch(/mock|fallback|Promise\.resolve/i);
  });

  it('keeps both HTTP mutations behind admin authorization, capability checks, no-store caching, and throttling', () => {
    expect(adminController).toContain('@UseGuards(SupabaseAuthGuard, AdminGuard)');

    const banEndpoint = between(
      adminController,
      "@Post('users/:id/ban')",
      "@Post('users/:id/warn')",
    );
    const warnEndpoint = between(
      adminController,
      "@Post('users/:id/warn')",
      "@Get('blocks')",
    );

    for (const endpoint of [banEndpoint, warnEndpoint]) {
      expect(endpoint).toContain('@UseGuards(AdminCapabilityGuard)');
      expect(endpoint).toContain("@RequireAdminCapabilities('moderation.cases.manage')");
      expect(endpoint).toContain('CACHE_PRIVATE_NO_STORE');
      expect(endpoint).toContain('@Throttle({ default: { limit: 5, ttl: 60000 } })');
    }
  });

  it('persists authoritative moderation records and invalidates affected caches', () => {
    const banMutation = between(adminService, 'async banUser(', 'async warnUser(');
    const warnMutation = between(adminService, 'async warnUser(', 'async listAllBlocks(');

    expect(banMutation).toContain("from('blocks').insert({");
    expect(banMutation).toContain('blocker_id: adminUserId');
    expect(banMutation).toContain('blocked_id: targetUserId');
    expect(banMutation).toContain('await this.invalidateUserListCaches();');
    expect(banMutation).toContain('await this.invalidateBlocksListCaches();');

    expect(warnMutation).toContain("from('reports').insert({");
    expect(warnMutation).toContain('reporter_id: adminUserId');
    expect(warnMutation).toContain('reported_user_id: targetUserId');
    expect(warnMutation).toContain("reason_category: 'admin_warning'");
    expect(warnMutation).toContain("status: 'open'");
    expect(warnMutation).toContain('await this.invalidateUserListCaches();');
    expect(warnMutation).toContain('await this.invalidateReportsListCaches();');
  });
});
