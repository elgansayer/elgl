import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: Registry;
  readonly httpRequestDuration: Histogram<string>;
  readonly httpRequestsTotal: Counter<string>;
  readonly websocketConnections: Gauge<string>;

  constructor() {
    this.register = new Registry();
    collectDefaultMetrics({ register: this.register, prefix: 'hellotalk_' });

    this.httpRequestDuration = new Histogram({
      name: 'hellotalk_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.httpRequestsTotal = new Counter({
      name: 'hellotalk_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.websocketConnections = new Gauge({
      name: 'hellotalk_websocket_connections',
      help: 'Number of active WebSocket connections',
      registers: [this.register],
    });
  }

  getContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}