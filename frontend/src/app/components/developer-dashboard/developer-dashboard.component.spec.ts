import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { DeveloperDashboardComponent } from './developer-dashboard.component';

type DashboardHarness = {
  isGeneratingApiKey: ReturnType<typeof signal<boolean>>;
  store: {
    generateApiKey: ReturnType<typeof vi.fn>;
  };
  addLog: ReturnType<typeof vi.fn>;
};

function createHarness(generateApiKey: ReturnType<typeof vi.fn>): DashboardHarness {
  return {
    isGeneratingApiKey: signal(false),
    store: { generateApiKey },
    addLog: vi.fn().mockResolvedValue(undefined),
  };
}

async function invokeGenerateKey(harness: DashboardHarness): Promise<void> {
  await DeveloperDashboardComponent.prototype.generateKey.call(
    harness as unknown as DeveloperDashboardComponent,
  );
}

describe('DeveloperDashboardComponent API key management', () => {
  it('records success only when the backend actually issued a credential', async () => {
    const generateApiKey = vi.fn().mockResolvedValue('ht_dev_0123456789abcdef0123456789abcdef');
    const harness = createHarness(generateApiKey);

    await invokeGenerateKey(harness);

    expect(generateApiKey).toHaveBeenCalledTimes(1);
    expect(harness.addLog).toHaveBeenCalledWith(
      'REDIS',
      'Generated new production API key (600 RPM).',
      'success',
    );
    expect(harness.addLog.mock.calls.flat().join(' ')).not.toContain(
      'ht_dev_0123456789abcdef0123456789abcdef',
    );
    expect(harness.isGeneratingApiKey()).toBe(false);
  });

  it('fails closed when the store reports that no credential was issued', async () => {
    const generateApiKey = vi.fn().mockResolvedValue(null);
    const harness = createHarness(generateApiKey);

    await invokeGenerateKey(harness);

    expect(harness.addLog).toHaveBeenCalledTimes(1);
    expect(harness.addLog).toHaveBeenCalledWith(
      'REDIS',
      'Developer API key generation failed; no credential was issued.',
      'warn',
    );
    expect(harness.addLog).not.toHaveBeenCalledWith(
      'REDIS',
      'Generated new production API key (600 RPM).',
      'success',
    );
    expect(harness.isGeneratingApiKey()).toBe(false);
  });

  it('deduplicates concurrent generate actions', async () => {
    let resolveIssue: ((value: string | null) => void) | undefined;
    const generateApiKey = vi.fn().mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveIssue = resolve;
        }),
    );
    const harness = createHarness(generateApiKey);

    const first = invokeGenerateKey(harness);
    expect(harness.isGeneratingApiKey()).toBe(true);

    await invokeGenerateKey(harness);
    expect(generateApiKey).toHaveBeenCalledTimes(1);

    resolveIssue?.('ht_dev_0123456789abcdef0123456789abcdef');
    await first;

    expect(harness.isGeneratingApiKey()).toBe(false);
    expect(harness.addLog).toHaveBeenCalledTimes(1);
  });
});
