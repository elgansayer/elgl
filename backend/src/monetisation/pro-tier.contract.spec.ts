import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function repositoryRoot(): string {
  const cwd = process.cwd();
  return existsSync(resolve(cwd, 'frontend')) ? cwd : resolve(cwd, '..');
}

const root = repositoryRoot();

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('Pro Tier product contract', () => {
  it('exposes the four core Tandem Pro benefits in subscription plans', () => {
    const backendPlans = readRepositoryFile(
      'backend/src/monetisation/services/subscription-plans.service.ts',
    );

    expect(backendPlans).toContain("id: 'pro_12_ukp_15_usd'");
    expect(backendPlans).toContain("name: 'Pro'");
    expect(backendPlans).toContain('Unlimited AI translations');
    expect(backendPlans).toContain(
      'Advanced visitor logs (who viewed your profile)',
    );
    expect(backendPlans).toContain('Nearby members visibility boost');
    expect(backendPlans).toContain('Ad-free experience');
  });

  it('resolves provider product identifiers to canonical pro tier', () => {
    const plansService = readRepositoryFile(
      'backend/src/monetisation/services/subscription-plans.service.ts',
    );

    expect(plansService).toContain('STRIPE_PRO_MONTHLY_PRICE_ID');
    expect(plansService).toContain('STRIPE_PRO_YEARLY_PRICE_ID');
    expect(plansService).toContain("'com.hellotalk.pro.monthly': 'pro'");
    expect(plansService).toContain("'com.hellotalk.pro.yearly': 'pro'");
    expect(plansService).toContain(
      "if (planId.startsWith('pro_')) return 'pro'",
    );
  });

  it('keeps Pro tier within VIP guard authorization', () => {
    const vipGuard = readRepositoryFile(
      'backend/src/monetisation/guards/vip.guard.ts',
    );

    expect(vipGuard).toContain(
      "export type VipRequirement = 'consumer' | 'pro' | 'developer' | 'any';",
    );
    expect(vipGuard).toContain("requiredTier === 'pro'");
    expect(vipGuard).toContain("tier.startsWith('pro')");
  });

  it('keeps unlimited translations and higher target language allowances', () => {
    const nlpService = readRepositoryFile('backend/src/nlp/nlp.service.ts');
    const usersService = readRepositoryFile(
      'backend/src/users/users.service.ts',
    );

    expect(nlpService).toContain('if (isVip) return;');
    expect(usersService).toContain(
      "tier === 'pro' || tier === 'developer' ? 5 : 3",
    );
  });

  it('keeps advanced visitor logs unmasked for Pro VIP members', () => {
    const profileVisitsService = readRepositoryFile(
      'backend/src/profile-visits/profile-visits.service.ts',
    );

    expect(profileVisitsService).toContain(
      'const identityVisible = Boolean(ownerPrivacy.is_vip);',
    );
    expect(profileVisitsService).toContain("id: 'hidden-vip-only'");
    expect(profileVisitsService).toContain('is_blurred: true');
  });

  it('applies visibility boost for Pro members in discovery', () => {
    const discoveryService = readRepositoryFile(
      'backend/src/discovery/discovery.service.ts',
    );

    expect(discoveryService).toContain("tier.startsWith('pro')");
    expect(discoveryService).toContain('pro_visibility_boost');
  });
});
