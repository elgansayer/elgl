# Moments monitoring and alerting

Issue #2049 sets up production alerting for the Moments architecture. The rules cover the `For You` ranking pipeline described in `docs/moments_for_you_ranking.md`: candidate sourcing, ranking latency, degraded serving and empty-feed behaviour.

The alerts are configuration-only. No database migration, API contract change or new persistence is introduced.

## Metrics

All metrics are emitted by the NestJS `MetricsService` and exposed through the existing Prometheus registry at `/api/metrics`. Labels are fixed enumerations, so cardinality is constant.

| Metric                                               | Type      | Labels                                                                                               | Purpose                                                       |
| ---------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `hellotalk_moments_for_you_ranking_duration_seconds` | histogram | `outcome`: `ranked`, `degraded`, `empty`                                                             | Ranking latency including viewer context loading              |
| `hellotalk_moments_for_you_candidates`               | histogram | `stage`: `recent_source`, `in_network_source`, `pool`, `served`                                      | Candidate volume at each pipeline stage                       |
| `hellotalk_moments_for_you_degraded_total`           | counter   | `reason`: `viewer_context_unavailable`, `in_network_source_unavailable`, `recent_source_unavailable` | Requests served without an optional source or personalisation |

No user IDs, Moment IDs, author IDs, text content, tokens or provider errors are used as labels or annotations.

## Prometheus rules

`prometheus/moments.rules.yml` defines a `moments` rule group. It is mounted read-only into the Prometheus container by `docker-compose.yml`, `docker-compose.dev.yml` and `docker-compose.prod.yml`, and is listed in `prometheus/prometheus.yml` under `rule_files`.

| Alert                              | Expression                                                      | For | Severity | Meaning                                                        |
| ---------------------------------- | --------------------------------------------------------------- | --- | -------- | -------------------------------------------------------------- |
| `MomentsForYouRankingLatencyHigh`  | p95 ranking duration above 1.5s                                 | 5m  | warning  | Ranking or dependency latency is degrading the feed            |
| `MomentsForYouDegradedRateHigh`    | degraded ranking outcomes above 20% of requests                 | 10m | warning  | A candidate source or viewer context is repeatedly unavailable |
| `MomentsForYouEmptyRateHigh`       | empty ranking outcomes above 50% of requests                    | 15m | warning  | The feed has almost nothing eligible to serve                  |
| `MomentsForYouRankingStalled`      | zero ranking observations                                       | 30m | critical | The endpoint is down, unused or metrics ingestion is broken    |
| `MomentsForYouCandidatePoolThin`   | average candidate pool below one Moment while traffic continues | 15m | warning  | Upstream queries are returning an unusably thin pool           |
| `MomentsForYouDegradedSourceSpike` | more than 20 events for one `reason` in 15 minutes              | 5m  | warning  | A single dependency is failing at a high rate                  |

Thresholds are deliberately conservative. Ranking is capped at 100 candidates and 50 returned Moments, so a healthy request should complete well under 1.5 seconds and the pool should normally contain many more than one Moment. The empty and degraded ratios are computed against total ranking observations so a quiet period does not look like a failure.

Prometheus evaluates rules every 15 seconds. No Alertmanager target is configured in this repository, so the rules fire into the Prometheus alert view only. Add an `alerting.alertmanagers` block in `prometheus/prometheus.yml` to route to Slack, PagerDuty or email when an Alertmanager instance exists.

## Datadog monitors

`config/datadog/moments-monitors.json` mirrors the Prometheus rules as six Datadog query alerts. The three Moments metrics are registered in `config/datadog/datadog-agent.yaml` so the Agent scrapes and namespaces them alongside the other HelloTalk feature metrics.

Monitors carry the tags `service:hellotalk`, `team:moments` and a `severity:*` tag. Apply them with the existing Datadog monitor tooling, for example the `datadog-monitor` CLI or Terraform, after the Agent is scraping the backend.

The Datadog `no data` monitor for `[Moments] For You ranking stalled` is intentionally paired with `notify_no_data: true`. Treat a no-data page as either an application outage or an Agent/metrics pipeline failure, not as proof that Moments traffic is genuinely zero.

## Failure behaviour and correlation

The Moments feed degrades rather than failing:

- a failed candidate source is replaced by the other source and increments `hellotalk_moments_for_you_degraded_total` with a fixed reason;
- failed viewer context removes personalisation but still returns a ranked feed;
- an exhausted pool returns an empty list, which the client renders as its empty state.

Every degradation path emits a fixed `moments_for_you_*` warn log event with no user or content identifiers. Correlate an alert with the request route and response time from `hellotalk_http_request_duration_seconds`, and with the matching `degraded_total` reason. No direct database access is required to identify the failing stage.

## Verification

Validate the rule and monitor files with the focused contract test:

```bash
node --test scripts/verify-moments-monitoring.test.mjs
```

Check that Prometheus accepts the configuration when a Prometheus container is available:

```bash
docker compose run --rm prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose run --rm prometheus promtool check rules /etc/prometheus/moments.rules.yml
```

A deployment smoke test should confirm that Prometheus lists the `moments` rule group, that `hellotalk_moments_for_you_*` series appear under the `hellotalk-nestjs` target, and that the Datadog Agent reports the three Moments metrics.

## Rollout and rollback

Rollout is a configuration-only change:

1. Deploy the updated Prometheus configuration and the `moments.rules.yml` mount, then reload or restart Prometheus.
2. Confirm the rule group loaded and no configuration error is reported.
3. Apply `config/datadog/moments-monitors.json` once the Agent emits the metrics.

Existing Prometheus time-series data and Grafana state are reused. No volumes need to be removed.

Rollback reverts the configuration files and removes the `moments.rules.yml` entry from `prometheus/prometheus.yml`. Pause or delete the Datadog monitors if they were applied. Retained metrics data is harmless and can remain until the standard retention window expires.
