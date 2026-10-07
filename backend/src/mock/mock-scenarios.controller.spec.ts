import { NotFoundException } from '@nestjs/common';
import { MockScenariosController } from './mock-scenarios.controller';
import { MockScenariosService } from './mock-scenarios.service';

describe('MockScenariosController', () => {
  const originalMode = process.env.MOCK_BACKEND_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  let service: MockScenariosService;
  let controller: MockScenariosController;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';
    service = new MockScenariosService();
    controller = new MockScenariosController(service);
  });

  afterAll(() => {
    if (originalMode === undefined) delete process.env.MOCK_BACKEND_MODE;
    else process.env.MOCK_BACKEND_MODE = originalMode;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('exposes list, selection, snapshot and reset operations in mock mode', () => {
    expect(controller.list().manifests).toHaveLength(5);
    expect(controller.select('worker-1', { packs: ['dense'] }).packs).toEqual([
      'baseline',
      'dense',
    ]);
    expect(controller.snapshot('worker-1').summary.users).toBe(450);
    expect(controller.reset('worker-1').packs).toEqual(['baseline']);
  });

  it('hides every control when mock mode is disabled', () => {
    process.env.MOCK_BACKEND_MODE = 'disabled';

    expect(() => controller.list()).toThrow(NotFoundException);
    expect(() => controller.get('worker-1')).toThrow(NotFoundException);
    expect(() => controller.snapshot('worker-1')).toThrow(NotFoundException);
    expect(() => controller.select('worker-1', { packs: ['dense'] })).toThrow(
      NotFoundException,
    );
    expect(() => controller.reset('worker-1')).toThrow(NotFoundException);
  });
});
