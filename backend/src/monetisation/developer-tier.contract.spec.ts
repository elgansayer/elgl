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

describe('Developer Tier product contract', () => {
  it('keeps the lazy Developer dashboard and typed client endpoints wired', () => {
    const routes = readRepositoryFile('frontend/src/app/routes/admin.routes.ts');
    const client = readRepositoryFile('frontend/src/app/services/monetisation.service.ts');

    expect(routes).toMatch(/path:\s*'developer'/);
    expect(routes).toContain('developer-dashboard/developer-dashboard.component');
    expect(routes).toContain('DeveloperDashboardComponent');

    expect(client).toContain("private readonly baseUrl = '/api/monetisation'");
    expect(client).toContain('`${this.baseUrl}/generate-api-key`');
    expect(client).toContain('`${this.baseUrl}/analytics`');
    expect(client).toContain('rate_limit_rpm: number');
  });

  it('keeps API-key issuance and analytics behind Developer-tier authorization', () => {
    const controller = readRepositoryFile(
      'backend/src/monetisation/monetisation.controller.ts',
    );

    expect(controller).toMatch(
      /@Post\('generate-api-key'\)\s+@UseGuards\(SupabaseAuthGuard, VipGuard\)\s+@RequireVip\('developer'\)/,
    );
    expect(controller).toMatch(
      /@Get\('analytics'\)\s+@UseGuards\(SupabaseAuthGuard, VipGuard\)\s+@RequireVip\('developer'\)/,
    );
  });

  it('keeps the paid Developer tier, cryptographic key generation, and 600 RPM contract', () => {
    const service = readRepositoryFile('backend/src/monetisation/monetisation.service.ts');

    expect(service).toContain("developer_20_ukp_26_usd: 'developer'");
    expect(service).toContain('crypto.randomBytes(16)');
    expect(service).toContain('`ht_dev_${');
    expect(service).toContain("user.vip_tier?.startsWith('developer') ? 600 : 60");
    expect(service).toContain('Developer Tier: 20 UKP / $26 USD per month');
  });

  it('keeps persisted Developer credentials one-way and browser-managed writes blocked', () => {
    const migration = readRepositoryFile(
      'supabase/migrations/20260822000500_harden_developer_api_key_storage.sql',
    );

    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    expect(migration).toContain('developer_api_key_hash TEXT NULL');
    expect(migration).toContain("digest(developer_api_key, 'sha256')");
    expect(migration).toContain('users_developer_api_key_hash_uidx');
    expect(migration).toContain("request_role IN ('anon', 'authenticated')");
    expect(migration).toContain('protect_developer_api_key_trigger');
    expect(migration).toContain(
      "NEW.developer_api_key_prefix || '…' || NEW.developer_api_key_last_four",
    );
  });

  it('keeps the dashboard retry-safe and prevents raw issued keys from entering diagnostics', () => {
    const dashboard = readRepositoryFile(
      'frontend/src/app/components/developer-dashboard/developer-dashboard.component.ts',
    );
    const template = readRepositoryFile(
      'frontend/src/app/components/developer-dashboard/developer-dashboard.component.html',
    );

    expect(dashboard).toContain('if (this.isGeneratingApiKey()) return;');
    expect(dashboard).toContain('const issuedKey = await this.store.generateApiKey();');
    expect(dashboard).toContain(
      "'Generated new production API key (600 RPM).'",
    );
    expect(dashboard).not.toContain('Generated new production API key: ${issuedKey}');

    expect(template).toContain("'developer.generateBtn' | t");
    expect(template).toContain('store.developerStats()?.total_api_calls_today');
    expect(template).toContain('store.developerStats()?.avg_latency_ms');
  });
});
