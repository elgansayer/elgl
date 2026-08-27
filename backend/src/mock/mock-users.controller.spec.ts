import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MockUsersController } from './mock-users.controller';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_MOCK_BACKEND_MODE = process.env.MOCK_BACKEND_MODE;

function restoreEnvironment(): void {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
  if (ORIGINAL_MOCK_BACKEND_MODE === undefined) {
    delete process.env.MOCK_BACKEND_MODE;
  } else {
    process.env.MOCK_BACKEND_MODE = ORIGINAL_MOCK_BACKEND_MODE;
  }
}

describe('MockUsersController', () => {
  const controller = new MockUsersController();

  afterEach(() => {
    restoreEnvironment();
  });

  it('is hidden when the explicit mock backend profile is disabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MOCK_BACKEND_MODE;

    expect(() => controller.getPopulation()).toThrow(NotFoundException);
  });

  it('serves deterministic namespace-scoped profiles in explicit test mode', () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';

    const first = controller.getPopulation('minimal', 'playwright-1');
    const replay = controller.getPopulation('minimal', 'playwright-1');

    expect(first.count).toBe(12);
    expect(first.namespace).toBe('playwright-1');
    expect(replay).toEqual(first);
  });

  it('rejects unsupported population sizes', () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';

    expect(() => controller.getPopulation('huge', 'worker')).toThrow(
      BadRequestException,
    );
  });

  it('rejects unsafe or unbounded namespace values', () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';

    expect(() => controller.getPopulation('minimal', '../worker')).toThrow(
      BadRequestException,
    );
    expect(() => controller.getPopulation('minimal', 'x'.repeat(65))).toThrow(
      BadRequestException,
    );
  });
});
