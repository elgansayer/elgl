import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatadogMetricsService } from './datadog-metrics.service';

// Mock hot-shots to avoid real StatsD connections in tests.
// hot-shots is a CJS module with module.exports = StatsD constructor.
// With esModuleInterop, the default import gives us the constructor directly.
jest.mock('hot-shots', () => {
  const mockInstance = {
    increment: jest.fn(),
    gauge: jest.fn(),
    timing: jest.fn(),
    histogram: jest.fn(),
    distribution: jest.fn(),
    event: jest.fn(),
    close: jest.fn(),
    socket: { on: jest.fn() },
  };
  const ctor = jest.fn().mockImplementation(() => mockInstance);
  return { __esModule: true, default: ctor };
});

describe('DatadogMetricsService', () => {
  let service: DatadogMetricsService;

  const createTestModule = async (env: Record<string, string | undefined>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatadogMetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => env[key],
          },
        },
      ],
    }).compile();

    return module.get<DatadogMetricsService>(DatadogMetricsService);
  };

  it('should be defined when DD environment variables are set', async () => {
    service = await createTestModule({
      DD_AGENT_HOST: '127.0.0.1',
      DD_DOGSTATSD_PORT: '8125',
      DD_API_KEY: 'test-key',
      DD_ENV: 'test',
    });
    expect(service).toBeDefined();
    expect(service.isEnabled()).toBe(true);
  });

  it('should be disabled when DD_AGENT_HOST is missing', async () => {
    service = await createTestModule({
      DD_AGENT_HOST: undefined,
      DD_DOGSTATSD_PORT: '8125',
      DD_API_KEY: 'test-key',
    });
    expect(service.isEnabled()).toBe(false);
  });

  it('should be disabled when DD_DOGSTATSD_PORT is missing', async () => {
    service = await createTestModule({
      DD_AGENT_HOST: '127.0.0.1',
      DD_DOGSTATSD_PORT: undefined,
      DD_API_KEY: 'test-key',
    });
    expect(service.isEnabled()).toBe(false);
  });

  it('should be disabled when DD_API_KEY is missing', async () => {
    service = await createTestModule({
      DD_AGENT_HOST: '127.0.0.1',
      DD_DOGSTATSD_PORT: '8125',
      DD_API_KEY: undefined,
    });
    expect(service.isEnabled()).toBe(false);
  });

  it('should not throw when increment is called while disabled', async () => {
    const svc = await createTestModule({});
    expect(() => {
      svc.increment('test.metric', { tag: 'value' });
    }).not.toThrow();
  });

  it('should not throw when gauge is called while disabled', async () => {
    service = await createTestModule({});
    expect(() => {
      service.gauge('test.metric', 42, { tag: 'value' });
    }).not.toThrow();
  });

  it('should not throw when timing is called while disabled', async () => {
    service = await createTestModule({});
    expect(() => {
      service.timing('test.metric', 100, { tag: 'value' });
    }).not.toThrow();
  });

  it('should not throw when event is called while disabled', async () => {
    service = await createTestModule({});
    expect(() => {
      service.event('Test Event', 'Testing disabled mode', 'info', {
        tag: 'value',
      });
    }).not.toThrow();
  });

  it('should call onModuleDestroy without error when disabled', async () => {
    service = await createTestModule({});
    expect(() => service.onModuleDestroy()).not.toThrow();
  });
});
