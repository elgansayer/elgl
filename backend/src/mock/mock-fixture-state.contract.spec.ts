import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_MOCK_BACKEND_MODE = process.env.MOCK_BACKEND_MODE;
const ORIGINAL_MOCK_BACKEND_SEED = process.env.MOCK_BACKEND_SEED;

describe('mock fixture reset and reseed contract', () => {
  let service: AppService;
  let controller: AppController;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';
    process.env.MOCK_BACKEND_SEED = '7932';
    service = new AppService();
    controller = new AppController(service);
  });

  afterAll(() => {
    restoreEnvironment('NODE_ENV', ORIGINAL_NODE_ENV);
    restoreEnvironment('MOCK_BACKEND_MODE', ORIGINAL_MOCK_BACKEND_MODE);
    restoreEnvironment('MOCK_BACKEND_SEED', ORIGINAL_MOCK_BACKEND_SEED);
  });

  it('resets a namespace to the exact deterministic seed without duplicates', () => {
    const first = service.resetMockFixtures('worker-a');
    const second = service.resetMockFixtures('worker-a');

    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.summary).toEqual({
      users: 150,
      linkedAccounts: 10,
      totalRecords: 160,
    });
    expect(new Set(second.snapshot.users.map((user) => user.id)).size).toBe(
      second.snapshot.users.length,
    );
  });

  it('reseeds one namespace without changing another parallel worker', () => {
    const workerA = service.reseedMockFixtures(111, 'worker-a');
    const workerB = service.reseedMockFixtures(222, 'worker-b');

    expect(workerA.seed).toBe(111);
    expect(workerB.seed).toBe(222);
    expect(workerA.snapshot.users).not.toEqual(workerB.snapshot.users);

    service.resetMockFixtures('worker-a');
    const workerBAfter = service.getMockFixtures('worker-b');
    expect(workerBAfter.seed).toBe(workerB.seed);
    expect(workerBAfter.snapshot).toEqual(workerB.snapshot);
    expect(workerBAfter.summary).toEqual(workerB.summary);
  });

  it('captures and restores a named snapshot exactly', () => {
    const original = service.reseedMockFixtures(4242, 'restore-worker');
    service.captureMockFixtureSnapshot('before-change', 'restore-worker');
    service.reseedMockFixtures(9999, 'restore-worker');

    const restored = service.restoreMockFixtureSnapshot(
      'before-change',
      'restore-worker',
    );

    expect(restored.seed).toBe(4242);
    expect(restored.snapshot).toEqual(original.snapshot);
    expect(restored.summary).toEqual(original.summary);
  });

  it('validates namespace, checkpoint and seed inputs', () => {
    expect(() => service.resetMockFixtures('not allowed!')).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.captureMockFixtureSnapshot('', 'worker-a'),
    ).toThrow(BadRequestException);
    expect(() => service.reseedMockFixtures('invalid', 'worker-a')).toThrow(
      'unsigned 32-bit integer',
    );
    expect(() =>
      service.restoreMockFixtureSnapshot('missing', 'worker-a'),
    ).toThrow(NotFoundException);
  });

  it('hides the reset API when explicit mock mode is disabled', () => {
    process.env.MOCK_BACKEND_MODE = 'disabled';

    expect(() => controller.getMockFixtures()).toThrow(NotFoundException);
    expect(() => controller.resetMockFixtures({})).toThrow(NotFoundException);
  });
});

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
