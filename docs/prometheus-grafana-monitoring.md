# Prometheus and Grafana monitoring

Issue #1688 defines the Docker Compose observability contract for the NestJS API and Centrifugo realtime service.

## Architecture

Prometheus scrapes two internal service endpoints every 10 seconds:

- NestJS: `http://api:3000/api/metrics`
- Centrifugo: `http://websocket:8001/metrics`

Grafana is provisioned with one immutable Prometheus datasource at `http://prometheus:9090`. Dashboards under `grafana/dashboards/` are mounted read-only and loaded by the existing dashboard provider.

In `docker-compose.prod.yml`, the Centrifugo metrics port is exposed only to the Compose network. Prometheus and Grafana bind to loopback on the host rather than all interfaces. Operators can reach them locally or through an authenticated tunnel/reverse proxy without publishing raw metrics or the Grafana login directly to the internet.

## Production configuration

Set a real `GRAFANA_ADMIN_PASSWORD` in the production secret store. Production Compose intentionally fails interpolation when this value is absent; there is no `admin` fallback. Anonymous access and user self-registration are disabled.

Optional monitoring settings:

- `PROMETHEUS_PORT` defaults to `9090` on `127.0.0.1`.
- `GRAFANA_PORT` defaults to `3001` on `127.0.0.1`.
- `PROMETHEUS_RETENTION_TIME` defaults to `15d`.
- `PROMETHEUS_RETENTION_SIZE` defaults to `5GB`.

Prometheus stops retaining data when either retention boundary is reached. Persistent metrics and Grafana state live in the named `prometheus_prod_data` and `grafana_prod_data` volumes.

## Failure behavior

Prometheus uses a five-second scrape timeout so a degraded target cannot consume the full scrape interval. A failed NestJS or Centrifugo scrape makes that target unhealthy in Prometheus but does not stop the application services.

Grafana depends on Prometheus but application traffic does not depend on either monitoring container. Monitoring can therefore restart or be rolled back without taking the API, frontend or realtime service offline.

The production Compose health checks use the actual globally prefixed NestJS health endpoint at `/api/health`. Datadog's optional Prometheus integration uses `/api/health` and `/api/metrics` for the same reason.

## Security and privacy

Raw metrics endpoints must not contain credentials, access tokens, message text, profile text or other user content. Prefer aggregate counters, durations and bounded labels. Do not add user IDs, room IDs, message IDs or arbitrary request values as metric labels because that creates both privacy risk and unbounded cardinality.

The Prometheus web lifecycle endpoint is intentionally disabled in production. Prometheus configuration and Grafana provisioning/dashboard mounts are read-only. Grafana's Gravatar integration is disabled to avoid sending operator email hashes to an external service.

## Verification

Run the existing Compose contract locally:

```bash
node --test scripts/verify-compose-orchestration.test.mjs
```

The contract verifies that:

- Prometheus and Grafana remain defined and correctly wired;
- production Prometheus/Grafana host ports remain loopback-only;
- the Centrifugo metrics port is not host-published;
- retention and scrape timeouts remain bounded;
- production Grafana requires an explicit admin password and disables anonymous access;
- the NestJS and Centrifugo scrape paths remain correct;
- Grafana has exactly one immutable Prometheus datasource;
- the Datadog monitoring endpoints and production API health check use the NestJS `/api` prefix.

For a deployment smoke test, start the production stack with valid application secrets and `GRAFANA_ADMIN_PASSWORD`, then verify Prometheus reports both `hellotalk-nestjs` and `centrifugo` as scrape targets and that the provisioned Grafana dashboards can query the `Prometheus` datasource.

## Rollout and rollback

Deploy this as a configuration-only monitoring change. No database migration or application API contract changes are required. Existing Prometheus and Grafana named volumes are reused.

During rollout, set `GRAFANA_ADMIN_PASSWORD` before starting the production Compose stack. If operators previously reached Prometheus or Grafana through a publicly bound host port, switch that access to localhost, an SSH tunnel, VPN, or an authenticated reverse proxy.

Rollback is a code/configuration revert. Retained Prometheus time-series data and Grafana state can remain in their named volumes; deleting those volumes is not required and would destroy monitoring history and local dashboard state.
