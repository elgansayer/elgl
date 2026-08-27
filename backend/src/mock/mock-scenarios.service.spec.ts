import { BadRequestException } from '@nestjs/common';
import { MockScenariosService } from './mock-scenarios.service';

describe('MockScenariosService', () => {
  const originalMode = process.env.MOCK_BACKEND_MODE;
  const originalScenarios = process.env.MOCK_BACKEND_SCENARIOS;
  const originalSeed = process.env.MOCK_BACKEND_SEED;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';
    delete process.env.MOCK_BACKEND_SCENARIOS;
    process.env.MOCK_BACKEND_SEED = '7932';
  });

  afterAll(() => {
    if (originalMode === undefined) delete process.env.MOCK_BACKEND_MODE;
    else process.env.MOCK_BACKEND_MODE = originalMode;
    if (originalScenarios === undefined)
      delete process.env.MOCK_BACKEND_SCENARIOS;
    else process.env.MOCK_BACKEND_SCENARIOS = originalScenarios;
    if (originalSeed === undefined) delete process.env.MOCK_BACKEND_SEED;
    else process.env.MOCK_BACKEND_SEED = originalSeed;
  });

  it('isolates mutable selections by namespace', () => {
    const service = new MockScenariosService();

    service.select('worker-1', ['dense', 'degraded']);

    expect(service.get('worker-1').packs).toEqual([
      'baseline',
      'dense',
      'degraded',
    ]);
    expect(service.get('worker-2').packs).toEqual(['baseline']);
  });

  it('reset restores the configured default selection', () => {
    process.env.MOCK_BACKEND_SCENARIOS = 'dense,degraded';
    const service = new MockScenariosService();
    service.select('worker-1', ['moderation-heavy']);

    expect(service.reset('worker-1').packs).toEqual([
      'baseline',
      'dense',
      'degraded',
    ]);
  });

  it('builds deterministic baseline, dense and empty fixture snapshots', () => {
    const service = new MockScenariosService();
    const baseline = service.snapshot('baseline-worker');
    const replay = service.snapshot('baseline-worker');

    expect(JSON.stringify(replay.fixtures)).toBe(
      JSON.stringify(baseline.fixtures),
    );
    expect(baseline.summary.users).toBe(150);

    service.select('dense-worker', ['dense']);
    expect(service.snapshot('dense-worker').summary.users).toBe(450);

    service.select('empty-worker', ['empty']);
    expect(service.snapshot('empty-worker').summary).toEqual({
      users: 0,
      linkedAccounts: 0,
      totalRecords: 0,
    });
  });

  it('rejects invalid namespace and manifest input before mutating state', () => {
    const service = new MockScenariosService();

    expect(() => service.select('../worker', ['dense'])).toThrow(
      BadRequestException,
    );
    expect(() => service.select('worker-1', ['not-real'])).toThrow(
      BadRequestException,
    );
    expect(service.get('worker-1').packs).toEqual(['baseline']);
  });
});
