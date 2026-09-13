# Docker Compose orchestration contract

Issue #1285 asked for Docker Compose configuration that orchestrates the five core application services. The repository now has that architecture in both `docker-compose.yml` and `docker-compose.dev.yml`; this document records the contract and the automated guard that prevents it from silently drifting.

## Core services

Both Compose files must retain these services:

- `api`: the NestJS backend. Production builds from `./backend`; development mounts `./backend` into a Node 22 container. Port 3000 remains the HTTP application boundary.
- `web`: the Angular frontend. Production builds from `./frontend`; development mounts `./frontend` into a Node 22 container. Production serves port 80 and development serves port 4200.
- `cache`: Redis 7 Alpine, with a persistent data volume and a Redis health check.
- `websocket`: Centrifugo v5, using the checked-in Centrifugo configuration and depending on Redis.
- `sfu`: LiveKit server, with its HTTP/WebRTC and TURN network ports exposed by the existing configuration.

Prometheus, Grafana, Datadog or other operational services may coexist with this core set. They are not substitutes for the five application services above.

## Dependency graph

The intended startup relationships are deliberately explicit:

```text
cache -> websocket -> api -> web
  \-----------------> api

sfu runs alongside the application path for realtime audio/video.
```

`api` depends on Redis and Centrifugo, `web` depends on `api`, and Centrifugo depends on Redis. Health checks remain present on every core service so deployment tooling can distinguish process start from service readiness.

## Development and production parity

`docker-compose.dev.yml` favours bind mounts and development commands. `docker-compose.yml` favours the repository Dockerfiles and production build targets. Both files must continue to use the same application technologies and network boundaries so a feature cannot work only because local development is running a different platform.

Configuration values and credentials continue to come from environment files or environment interpolation. Credentials must not be committed into either Compose file.

## Verification

Run the focused contract locally with:

```bash
node --test scripts/verify-compose-orchestration.test.mjs
```

The `Core Compose Contract` workflow runs the same check on pull requests, pushes to `main` or `develop`, and merge-queue checks. It verifies:

- all five core services exist in both Compose files;
- Redis remains on Redis 7, Centrifugo remains on v5, and LiveKit remains the SFU;
- production and development API/web services still point at the backend and frontend projects;
- the required service dependency edges remain present;
- every core service retains a health check;
- the established API, web, Centrifugo and LiveKit ports remain represented.

The guard is intentionally focused on the product orchestration contract. Observability-specific configuration is verified separately and may evolve without weakening this core service check.

## Rollout and rollback

This verification change does not alter runtime containers, persisted data, ports or credentials. It can be rolled out with an ordinary application change. Rollback is a normal revert of the contract test, workflow and this document.

If a future infrastructure migration intentionally replaces one of the five core technologies, update the architecture decision and its verification in the same reviewed pull request rather than weakening or deleting the guard first.
