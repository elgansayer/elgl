/**
 * Datadog monitoring alert definitions for the Virtual Coin Economy.
 *
 * These alert rules are designed to be imported into Datadog's monitor
 * configuration (either manually via the Datadog UI or programmatically
 * via the Datadog Terraform provider / API).
 *
 * Each rule maps directly to Prometheus metrics emitted by MetricsService
 * under the `hellotalk_economy_*` prefix.
 *
 * ## Usage
 *
 * 1. Ensure the Datadog Agent is configured to scrape the Prometheus
 *    endpoint at `GET /metrics` (exposed by MetricsController).
 * 2. Apply these monitors via Datadog's Monitors API or Terraform.
 * 3. Set `DD_API_KEY` and `DD_APP_KEY` environment variables for
 *    programmatic management.
 */

export interface DatadogMonitorDefinition {
  /** Unique monitor name shown in the Datadog UI. */
  name: string;
  /** Datadog monitor type (e.g. 'metric alert', 'query alert'). */
  type: 'metric alert' | 'query alert' | 'service check';
  /** Datadog metric query string. */
  query: string;
  /** Human-readable message shown when the monitor triggers. */
  message: string;
  /** Tags for categorisation and routing (team, severity, service). */
  tags: string[];
  /** Monitor priority from P1 (critical) to P5 (info). */
  priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  /** Evaluation window and thresholds. */
  options: {
    thresholds: {
      critical?: number;
      warning?: number;
      ok?: number;
    };
    evaluationDelay?: number;
    notifyNoData?: boolean;
    noDataTimeframe?: number;
    renotifyInterval?: number;
  };
}

export const ECONOMY_DATADOG_MONITORS: DatadogMonitorDefinition[] = [
  // ─── Revenue & Transactions ──────────────────────────────────────────
  {
    name: '[Economy] Coin Purchase Failure Rate High',
    type: 'query alert',
    query: `sum(last_15m):sum:hellotalk_economy_purchase_errors_total{*}.as_rate() / (sum:hellotalk_economy_coin_purchases_total{status:completed}.as_rate() + sum:hellotalk_economy_purchase_errors_total{*}.as_rate() + 1) * 100 > 10`,
    message:
      'Coin purchase error rate exceeded 10% over the last 15 minutes.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Users may be unable to purchase coins, affecting revenue.\n'
      + '**Action:** Check Stripe/Apple/Google payment provider status, '
      + 'verify receipt validation logs, inspect `purchaseCoins` error counters.\n'
      + '**Dashboard:** {{economy_dashboard_url}}\n'
      + '{{/is_alert}}\n'
      + '{{#is_recovery}}Purchase error rate returned to normal. {{/is_recovery}}',
    tags: ['team:platform', 'service:economy', 'severity:critical'],
    priority: 'P1',
    options: {
      thresholds: { critical: 10, warning: 5 },
      evaluationDelay: 300,
      notifyNoData: false,
      renotifyInterval: 60,
    },
  },
  {
    name: '[Economy] Coin Revenue Drop Detected',
    type: 'query alert',
    query: `sum(last_1h):sum:hellotalk_economy_coin_revenue_total{*}.as_rate() < 1`,
    message:
      'No coin purchase revenue detected in the last hour.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Potential checkout flow breakage or payment provider outage.\n'
      + '**Action:** Verify Stripe checkout sessions are being created, '
      + 'check `/economy/create-checkout-session` endpoint health.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:critical'],
    priority: 'P1',
    options: {
      thresholds: { critical: 1, warning: 10 },
      evaluationDelay: 600,
      notifyNoData: true,
      noDataTimeframe: 120,
      renotifyInterval: 30,
    },
  },
  {
    name: '[Economy] High Value Coin Purchase Anomaly',
    type: 'query alert',
    query: `avg(last_1h):anomalies(avg:hellotalk_economy_coin_purchases_total{package_id:coins_mega}.as_rate(), 'basic', 2, direction='above') >= 1`,
    message:
      'Unusually high rate of Mega coin pack purchases detected.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Potential fraud or promotional abuse. Verify transaction legitimacy.\n'
      + '**Action:** Check `coin_purchases` table for suspicious patterns, '
      + 'review Stripe dashboard for chargeback risk.\n'
      + '{{/is_alert}}',
    tags: ['team:security', 'service:economy', 'severity:warning'],
    priority: 'P2',
    options: {
      thresholds: { critical: 1, warning: 0.8 },
      evaluationDelay: 300,
      notifyNoData: false,
      renotifyInterval: 60,
    },
  },

  // ─── Purchase Latency ────────────────────────────────────────────────
  {
    name: '[Economy] Purchase Duration P95 High',
    type: 'query alert',
    query: `p95(last_15m):p95:hellotalk_economy_purchase_duration_seconds{*} > 15`,
    message:
      'P95 purchase duration exceeds 15 seconds.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Users experiencing slow coin purchases, potential checkout abandonment.\n'
      + '**Action:** Check Supabase query performance, Redis latency, '
      + 'and external payment provider API response times.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:warning'],
    priority: 'P2',
    options: {
      thresholds: { critical: 15, warning: 10 },
      evaluationDelay: 300,
      notifyNoData: false,
      renotifyInterval: 60,
    },
  },

  // ─── Gift Economy ────────────────────────────────────────────────────
  {
    name: '[Economy] Gift Send Rate Anomaly',
    type: 'query alert',
    query: `avg(last_1h):anomalies(avg:hellotalk_economy_gift_sends_total{*}.as_rate(), 'basic', 2, direction='both') >= 1`,
    message:
      'Anomalous virtual gift sending rate detected.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** May indicate spam, abuse, or a viral event.\n'
      + '**Action:** Review recent gift transactions, check for coordinated '
      + 'gift spam across user accounts.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:warning'],
    priority: 'P3',
    options: {
      thresholds: { critical: 1, warning: 0.8 },
      evaluationDelay: 600,
      notifyNoData: false,
      renotifyInterval: 120,
    },
  },
  {
    name: '[Economy] Gift Spend Spike',
    type: 'query alert',
    query: `sum(last_5m):sum:hellotalk_economy_gift_revenue_coins_total{*}.as_rate() > 10000`,
    message:
      'Gift coin spend rate exceeded 10 000 coins/min.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Unusual spending pattern - potential abuse or a very '
      + 'popular live room event.\n'
      + '**Action:** Check Centrifugo room activity, verify no automated gift spamming.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:info'],
    priority: 'P4',
    options: {
      thresholds: { critical: 10000, warning: 5000 },
      evaluationDelay: 300,
      notifyNoData: false,
      renotifyInterval: 120,
    },
  },

  // ─── Daily Check-Ins ─────────────────────────────────────────────────
  {
    name: '[Economy] Daily Check-In Claim Rate Drop',
    type: 'query alert',
    query: `sum(last_1d):sum:hellotalk_economy_daily_check_ins_total{status:claimed}.as_rate() / (sum:hellotalk_economy_daily_check_ins_total{*}.as_rate() + 1) * 100 < 50`,
    message:
      'Daily check-in claim rate dropped below 50%.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Users may be unable to claim daily rewards, indicating '
      + 'a Redis or Supabase issue with the daily check-in flow.\n'
      + '**Action:** Inspect Redis connectivity for `daily_checkin:*` keys, '
      + 'check `/economy/daily-check-in` endpoint errors.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:warning'],
    priority: 'P3',
    options: {
      thresholds: { critical: 50, warning: 70 },
      evaluationDelay: 3600,
      notifyNoData: false,
      renotifyInterval: 120,
    },
  },

  // ─── Sticker Pack Economy ────────────────────────────────────────────
  {
    name: '[Economy] Sticker Pack Unlock Error Rate',
    type: 'query alert',
    query: `sum(last_15m):default_zero(sum:hellotalk_economy_sticker_pack_unlocks_total{*}.as_rate()) < 0`,
    message:
      'No sticker pack unlocks detected in an extended period.\n\n'
      + '{{#is_no_data}}\n'
      + '**Impact:** Sticker pack unlock flow may be broken or engagement '
      + 'has dropped significantly.\n'
      + '**Action:** Verify `/economy/unlock-sticker-pack` endpoint, check claim rate.\n'
      + '{{/is_no_data}}',
    tags: ['team:platform', 'service:economy', 'severity:info'],
    priority: 'P5',
    options: {
      thresholds: { ok: 0 },
      evaluationDelay: 7200,
      notifyNoData: true,
      noDataTimeframe: 120,
      renotifyInterval: 360,
    },
  },

  // ─── Balance Queries ─────────────────────────────────────────────────
  {
    name: '[Economy] Balance Query Rate Spike',
    type: 'query alert',
    query: `avg(last_5m):avg:hellotalk_economy_balance_queries_total{*}.as_rate() > 500`,
    message:
      'Unusually high rate of coin balance queries.\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** May indicate a misbehaving client, polling loop, or '
      + 'increased load requiring caching review.\n'
      + '**Action:** Check API Gateway / load balancer logs for the '
      + '`GET /economy/balance` endpoint, verify cache-control headers are applied.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:info'],
    priority: 'P4',
    options: {
      thresholds: { critical: 500, warning: 300 },
      evaluationDelay: 300,
      notifyNoData: false,
      renotifyInterval: 60,
    },
  },

  // ─── Active Purchases (Gauge) ────────────────────────────────────────
  {
    name: '[Economy] Active Purchases Gauge Elevated',
    type: 'query alert',
    query: `avg(last_10m):avg:hellotalk_economy_active_purchases{*} > 20`,
    message:
      'Number of in-flight coin purchases is elevated (>20).\n\n'
      + '{{#is_alert}}\n'
      + '**Impact:** Payment provider may be slow, causing purchase operations '
      + 'to accumulate. Risk of timeout cascades.\n'
      + '**Action:** Check external payment provider (Stripe/Apple/Google) status, '
      + 'inspect Supabase connection pool.\n'
      + '{{/is_alert}}',
    tags: ['team:platform', 'service:economy', 'severity:warning'],
    priority: 'P3',
    options: {
      thresholds: { critical: 20, warning: 10 },
      evaluationDelay: 600,
      notifyNoData: false,
      renotifyInterval: 60,
    },
  },
];