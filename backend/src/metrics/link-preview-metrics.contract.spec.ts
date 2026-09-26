import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LINK_PREVIEW_REQUEST_OUTCOMES,
  MetricsService,
} from './metrics.service';

/**
 * The link preview metrics only help operators if three things stay in step:
 * what the backend registers, what the Datadog agent is told to scrape, and
 * what the monitors query. This contract fails when one of them drifts.
 */
const repositoryRoot = join(__dirname, '..', '..', '..');
const agentConfig = readFileSync(
  join(repositoryRoot, 'config', 'datadog', 'datadog-agent.yaml'),
  'utf8',
);

interface Monitor {
  name: string;
  type: string;
  query: string;
  message: string;
  tags: string[];
  options: { thresholds: Record<string, number> };
}

const monitors: Monitor[] = (
  JSON.parse(
    readFileSync(
      join(repositoryRoot, 'config', 'datadog', 'link-preview-monitors.json'),
      'utf8',
    ),
  ) as { monitors: Monitor[] }
).monitors;

const EXPECTED_METRICS: Record<string, 'counter' | 'histogram' | 'gauge'> = {
  hellotalk_link_preview_requests_total: 'counter',
  hellotalk_link_preview_fetch_duration_seconds: 'histogram',
  hellotalk_link_preview_inflight_fetches: 'gauge',
  hellotalk_link_preview_persistence_total: 'counter',
};

describe('link preview metrics contract', () => {
  it('whitelists every link preview metric in the Datadog agent with its Prometheus type', () => {
    for (const [name, type] of Object.entries(EXPECTED_METRICS)) {
      expect(agentConfig).toContain(`- ${name}: ${type}`);
    }
  });

  it('whitelists no link preview metric the backend does not register', async () => {
    const service = new MetricsService();
    const exposition = await service.getMetrics();
    const whitelisted = [
      ...agentConfig.matchAll(/- (hellotalk_link_preview_\w+): (\w+)/g),
    ].map((match) => match[1]);

    expect(whitelisted.sort()).toEqual(Object.keys(EXPECTED_METRICS).sort());
    for (const [name, type] of Object.entries(EXPECTED_METRICS)) {
      expect(exposition).toContain(`# TYPE ${name} ${type}`);
    }
  });

  it('defines monitors that only query registered link preview metrics', () => {
    expect(monitors.length).toBeGreaterThan(0);
    for (const monitor of monitors) {
      const referenced = [...monitor.query.matchAll(/hellotalk_[a-z_]+/g)].map(
        (match) => match[0],
      );
      expect(referenced.length).toBeGreaterThan(0);
      for (const name of referenced) {
        expect(Object.keys(EXPECTED_METRICS)).toContain(name);
      }
    }
  });

  it('filters monitors only on outcome and result values the backend can emit', () => {
    const validResults = ['ok', 'hit', 'miss', 'error'];
    for (const monitor of monitors) {
      for (const [, outcome] of monitor.query.matchAll(/outcome:(\w+)/g)) {
        expect(LINK_PREVIEW_REQUEST_OUTCOMES).toContain(outcome);
      }
      for (const [, result] of monitor.query.matchAll(/result:(\w+)/g)) {
        expect(validResults).toContain(result);
      }
    }
  });

  it('gives every monitor an owner, severity, thresholds and an actionable message', () => {
    for (const monitor of monitors) {
      expect(monitor.name.startsWith('[Link Preview] ')).toBe(true);
      expect(monitor.type).toBe('query alert');
      expect(monitor.tags).toEqual(
        expect.arrayContaining(['service:hellotalk', 'team:chat']),
      );
      expect(monitor.tags.some((tag) => tag.startsWith('severity:'))).toBe(
        true,
      );
      expect(Object.keys(monitor.options.thresholds)).toContain('critical');
      expect(monitor.message).toContain('**Actions:**');
    }
  });

  it('names the guards an operator should check when private targets are blocked', () => {
    const blocked = monitors.find((monitor) =>
      monitor.query.includes('outcome:blocked'),
    );

    expect(blocked?.message).toContain('safe-html-fetch.ts');
    expect(blocked?.message).toContain('outcome=blocked');
  });

  it('never puts full URLs in the operator guidance', () => {
    for (const monitor of monitors) {
      expect(monitor.message).not.toMatch(/https?:\/\//);
    }
  });
});
