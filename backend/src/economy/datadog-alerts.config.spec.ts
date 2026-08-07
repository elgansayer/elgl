import { ECONOMY_DATADOG_MONITORS, DatadogMonitorDefinition } from './datadog-alerts.config';

describe('Datadog Economy Monitoring Alerts', () => {
  it('should export at least one monitor definition', () => {
    expect(ECONOMY_DATADOG_MONITORS).toBeDefined();
    expect(ECONOMY_DATADOG_MONITORS.length).toBeGreaterThan(0);
  });

  it('should have valid monitor names on every definition', () => {
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(typeof monitor.name).toBe('string');
      expect(monitor.name.length).toBeGreaterThan(0);
      expect(monitor.name).toContain('[Economy]');
    }
  });

  it('should have valid monitor types', () => {
    const validTypes = ['metric alert', 'query alert', 'service check'];
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(validTypes).toContain(monitor.type);
    }
  });

  it('should have a non-empty query string', () => {
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(typeof monitor.query).toBe('string');
      expect(monitor.query.length).toBeGreaterThan(0);
    }
  });

  it('should have a non-empty message', () => {
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(typeof monitor.message).toBe('string');
      expect(monitor.message.length).toBeGreaterThan(0);
    }
  });

  it('should have valid tags', () => {
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(Array.isArray(monitor.tags)).toBe(true);
      expect(monitor.tags.length).toBeGreaterThan(0);
    }
  });

  it('should have valid priority values', () => {
    const validPriorities = ['P1', 'P2', 'P3', 'P4', 'P5'];
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(validPriorities).toContain(monitor.priority);
    }
  });

  it('should have valid thresholds in options', () => {
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(monitor.options).toBeDefined();
      expect(monitor.options.thresholds).toBeDefined();
    }
  });

  it('should reference economy metric names in queries', () => {
    for (const monitor of ECONOMY_DATADOG_MONITORS) {
      expect(monitor.query).toContain('hellotalk_economy');
    }
  });

  it('should have at least one P1 critical alert', () => {
    const p1Monitors = ECONOMY_DATADOG_MONITORS.filter(
      (m) => m.priority === 'P1',
    );
    expect(p1Monitors.length).toBeGreaterThanOrEqual(1);
  });

  it('should have monitors covering core economy operations', () => {
    const uniqueMonitors = new Set(ECONOMY_DATADOG_MONITORS.map((m) => m.name));
    expect(uniqueMonitors.size).toBeGreaterThanOrEqual(5);
  });

  describe('specific alert definitions', () => {
    const monitorByName = new Map<string, DatadogMonitorDefinition>(
      ECONOMY_DATADOG_MONITORS.map((m) => [m.name, m]),
    );

    it('should have a purchase failure rate alert', () => {
      const monitor = monitorByName.get(
        '[Economy] Coin Purchase Failure Rate High',
      );
      expect(monitor).toBeDefined();
      expect(monitor!.priority).toBe('P1');
      expect(monitor!.query).toContain('hellotalk_economy_purchase_errors_total');
    });

    it('should have a revenue drop alert', () => {
      const monitor = monitorByName.get('[Economy] Coin Revenue Drop Detected');
      expect(monitor).toBeDefined();
      expect(monitor!.priority).toBe('P1');
      expect(monitor!.query).toContain('hellotalk_economy_coin_revenue_total');
    });

    it('should have a purchase duration alert', () => {
      const monitor = monitorByName.get('[Economy] Purchase Duration P95 High');
      expect(monitor).toBeDefined();
      expect(monitor!.query).toContain('hellotalk_economy_purchase_duration_seconds');
    });

    it('should have a gift send anomaly alert', () => {
      const monitor = monitorByName.get('[Economy] Gift Send Rate Anomaly');
      expect(monitor).toBeDefined();
      expect(monitor!.query).toContain('hellotalk_economy_gift_sends_total');
    });

    it('should have a daily check-in rate drop alert', () => {
      const monitor = monitorByName.get('[Economy] Daily Check-In Claim Rate Drop');
      expect(monitor).toBeDefined();
      expect(monitor!.query).toContain('hellotalk_economy_daily_check_ins_total');
    });

    it('should have an active purchases gauge alert', () => {
      const monitor = monitorByName.get('[Economy] Active Purchases Gauge Elevated');
      expect(monitor).toBeDefined();
      expect(monitor!.query).toContain('hellotalk_economy_active_purchases');
    });
  });
});