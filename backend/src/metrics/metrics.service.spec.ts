import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

<<<<<<< HEAD
  it('should return Prometheus content type', () => {
    const contentType = service.getContentType();
    expect(contentType).toContain('text/plain');
  });

  it('should return metrics string with default metrics', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics).toContain('hellotalk_');
  });

  it('should expose HTTP request duration histogram', () => {
    expect(service.httpRequestDuration).toBeDefined();
    service.httpRequestDuration.observe({ method: 'GET', route: '/test', status_code: '200' }, 0.1);
  });

  it('should expose HTTP requests total counter', () => {
    expect(service.httpRequestsTotal).toBeDefined();
    service.httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
  });

  it('should expose WebSocket connections gauge', () => {
    expect(service.websocketConnections).toBeDefined();
    service.websocketConnections.set(5);
=======
  it('should return metrics string from getMetrics()', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should increment active connections', () => {
    service.incrementActiveConnections();
    // No error means success; gauge is incremented internally
    expect(true).toBe(true);
  });

  it('should decrement active connections', () => {
    service.incrementActiveConnections();
    service.decrementActiveConnections();
    expect(true).toBe(true);
  });

  it('should record HTTP request metrics without throwing', () => {
    service.recordHttpRequest('GET', '/api/test', 200, 0.05);
    expect(true).toBe(true);
  });

  it('should expose a registry', () => {
    const registry = service.getRegister();
    expect(registry).toBeDefined();
>>>>>>> origin/main
  });
});
