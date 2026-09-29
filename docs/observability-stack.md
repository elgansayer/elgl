# Production observability stack

The production Compose stack includes Prometheus for metrics collection and Grafana for dashboards. Prometheus scrapes both the NestJS API and Centrifugo on the private Compose network.

## Data flow

- NestJS exposes Prometheus metrics at `http://api:3000/api/metrics`.
- Centrifugo exposes Prometheus metrics at `http://websocket:8000/metrics` with its Redis-backed engine enabled.
- Prometheus scrapes those internal endpoints and stores time-series data in the `prometheus_prod_data` volume.
- Grafana uses the provisioned Prometheus datasource at `http://prometheus:9090` and loads dashboards from `/var/lib/grafana/dashboards`.

Neither the NestJS scrape path nor the Centrifugo metrics endpoint requires a separate public host port. Prometheus and Grafana bind their host-facing administration ports to `127.0.0.1` so they are reachable only from the host by default. Use SSH port forwarding or an authenticated reverse proxy when remote operator access is required.

## Required configuration

Set `GRAFANA_ADMIN_PASSWORD` in the production environment before starting the stack. There is intentionally no default admin password. Do not commit Grafana credentials, Prometheus credentials, bearer tokens, user identifiers, message content, or other personal data into dashboard configuration or metric labels.

Centrifugo continues to use the Compose `cache` Redis service. Its metrics endpoint shares the internal Centrifugo HTTP port and is consumed by Prometheus on the Compose network.

## Verification

Run:

```bash
npm run check:observability-stack
```

The contract check verifies that:

- Prometheus, Grafana and Datadog are actual Compose services;
- Prometheus and Grafana administration ports are loopback-only;
- no obsolete Centrifugo metrics host port is published;
- Grafana has no insecure default admin password;
- Prometheus scrapes the NestJS and Centrifugo metrics endpoints;
- Grafana points at the Compose Prometheus service and provisions dashboards; and
- Centrifugo has Prometheus metrics and the Redis engine enabled.

After deployment, operators should also check container health and Prometheus target health before relying on dashboards.

## Rollout and rollback

This change does not migrate application data. Deploy it with the normal production Compose rollout after setting `GRAFANA_ADMIN_PASSWORD`. The observability containers use persistent named volumes, so restarting or recreating application containers does not discard Prometheus or Grafana state.

To roll back, restore the previous Compose/configuration revision and recreate the affected containers. Do not roll back to a configuration that exposes the Grafana or Prometheus administration ports publicly or restores a default Grafana admin password.
