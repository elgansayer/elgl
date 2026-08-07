import { Injectable } from '@nestjs/common';
<<<<<<< HEAD
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';
=======
import {
  collectDefaultMetrics,
  Registry,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';
>>>>>>> origin/main

@Injectable()
export class MetricsService {
  private readonly register: Registry;
<<<<<<< HEAD
  readonly httpRequestDuration: Histogram<string>;
  readonly httpRequestsTotal: Counter<string>;
  readonly websocketConnections: Gauge<string>;

  constructor() {
    this.register = new Registry();
    collectDefaultMetrics({ register: this.register, prefix: 'hellotalk_' });
=======
  private httpRequestDuration: Histogram<string>;
  private httpRequestsTotal: Counter<string>;
  private activeConnections: Gauge<string>;

  constructor() {
    this.register = new Registry();

    collectDefaultMetrics({
      register: this.register,
      prefix: 'hellotalk_',
    });
>>>>>>> origin/main

    this.httpRequestDuration = new Histogram({
      name: 'hellotalk_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
<<<<<<< HEAD
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
=======
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
>>>>>>> origin/main
    });

    this.httpRequestsTotal = new Counter({
      name: 'hellotalk_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

<<<<<<< HEAD
    this.websocketConnections = new Gauge({
      name: 'hellotalk_websocket_connections',
      help: 'Number of active WebSocket connections',
=======
    this.activeConnections = new Gauge({
      name: 'hellotalk_active_connections',
      help: 'Number of active connections',
>>>>>>> origin/main
      registers: [this.register],
    });
  }

<<<<<<< HEAD
  getContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
=======
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  getRegister(): Registry {
    return this.register;
>>>>>>> origin/main
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}