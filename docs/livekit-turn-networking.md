# LiveKit STUN/TURN production networking

Issue #1669 hardens the self-hosted LiveKit deployment for users behind restrictive corporate NATs and firewalls. The deployment keeps direct WebRTC UDP/TCP available, but also provides an embedded TURN/TLS fallback on TCP 443 and TURN/UDP on 3478.

## Runtime contract

`config/livekit/config.yaml` is intentionally free of API credentials, TURN certificates, and deployment hostnames. `docker-compose.yml` supplies those values at runtime:

- `LIVEKIT_API_KEY` and `LIVEKIT_SECRET` are combined into LiveKit's `LIVEKIT_KEYS` setting. The same pair is used by the NestJS API when it signs LiveKit access tokens.
- `LIVEKIT_TURN_DOMAIN` is required. It must resolve publicly to the host running the LiveKit/TURN service and must match the certificate SAN/CN.
- `LIVEKIT_TURN_CERT_FILE` and `LIVEKIT_TURN_KEY_FILE` are required host paths. Docker Compose mounts them read-only as secrets and passes only the container secret paths to LiveKit.
- LiveKit's embedded TURN server creates short-lived client TURN credentials itself. Do not provision or persist a shared `LIVEKIT_TURN_USERNAME` or `LIVEKIT_TURN_PASSWORD`.
- The tracked LiveKit YAML contains no API key/secret fallback. Missing `LIVEKIT_API_KEY`, `LIVEKIT_SECRET`, TURN domain, certificate, or key therefore prevents the Compose deployment from being rendered or started instead of silently falling back to development credentials.

The default deployment terminates TURN TLS inside LiveKit (`external_tls: false`). If production moves TURN/TLS behind an L4 load balancer that terminates TLS, change the deployment deliberately and keep the load balancer, advertised port, certificate, and health checks in the same change. Do not simply toggle `external_tls` while continuing to expose LiveKit directly.

## Required network paths

The Compose deployment exposes only the ports used by its LiveKit configuration:

| Transport | Port | Purpose |
| --- | ---: | --- |
| TCP | 7880 | LiveKit signal/API endpoint; normally placed behind the application ingress |
| TCP | 7881 | WebRTC ICE over TCP fallback |
| UDP | 58000-58100 | Direct WebRTC media range |
| UDP | 3478 | TURN/UDP fallback |
| TCP | 443 | TURN/TLS fallback for restrictive networks |

The old `50000-60000/udp` host exposure did not match the configured `58000-58100` LiveKit media range and unnecessarily opened almost 10,000 ports. It is now narrowed to the actual configured range.

The configured public STUN servers are forwarded to clients by LiveKit. `rtc.use_external_ip: true` remains enabled so the SFU can advertise its mapped public address when deployed on a cloud host with a private interface.

## Certificate and DNS rollout

1. Create a dedicated DNS name such as `turn.elgl.example` pointing directly at the public LiveKit host.
2. Obtain a trusted certificate whose SAN includes that exact TURN hostname. Store the private key outside the repository with permissions restricted to the deployment operator.
3. Set `LIVEKIT_TURN_DOMAIN`, `LIVEKIT_TURN_CERT_FILE`, `LIVEKIT_TURN_KEY_FILE`, `LIVEKIT_API_KEY`, and `LIVEKIT_SECRET` in the production secret/environment store. Use a LiveKit secret of at least 32 random characters.
4. Allow inbound TCP 443, TCP 7881, UDP 3478, and UDP 58000-58100 at the host/cloud firewall. Keep 7880 behind the normal HTTPS/WebSocket ingress where applicable.
5. Run `docker compose config` before rollout. Missing required credentials or certificate paths must fail this step.
6. Deploy the SFU and confirm its health endpoint remains healthy before shifting traffic.
7. Test from both a normal network and a network that blocks direct UDP. A restrictive client should remain able to join through TURN/TLS rather than receiving a plaintext or credential fallback.

Certificate/key rotation is operational only: update the secret files atomically, then recreate the `sfu` container. Never log either file or `LIVEKIT_KEYS` while diagnosing deployment failures.

## Observability

LiveKit Prometheus metrics are enabled internally on port 6789. The existing Prometheus service now scrapes `sfu:6789/metrics` with the `service=livekit-sfu` label. Use those metrics together with LiveKit's structured `info` logs and container health state to correlate connection failures without collecting call content, tokens, API secrets, TURN credentials, or certificate keys.

Useful incident checks include:

- DNS resolution and certificate expiry for the TURN hostname.
- Reachability of TCP 443 and UDP 3478 from an external network.
- Whether the SFU is healthy and `sfu:6789/metrics` is being scraped.
- Sudden changes in LiveKit room/participant/packet metrics around the failure window.
- Cloud firewall or security-group changes affecting 7881 or 58000-58100/UDP.

Do not add verbose logging of ICE credentials or participant tokens to troubleshoot NAT failures.

## Automated verification

Run:

```bash
npm run check:livekit-networking
```

The contract test verifies that:

- production API credentials are injected at runtime and are not tracked in `config/livekit/config.yaml`;
- required TURN domain and certificate/key inputs fail closed in Compose;
- TURN/TLS, TURN/UDP, RTC TCP, and the bounded RTC UDP range remain exposed;
- both environment examples document the same TLS/UDP contract and do not reintroduce static TURN usernames/passwords; and
- Prometheus continues to scrape LiveKit.

The check is part of root `npm run verify`, so regressions fail CI before deployment.

## Failure and rollback behavior

A missing domain, API credential, certificate, or private key is a deployment failure, not a reason to disable TURN or use a development secret. Keep the previous healthy SFU running until the replacement passes configuration and health checks.

To roll back, redeploy the previous application revision together with its matching firewall rules and LiveKit configuration. If the rollback revision contains the former tracked development key, override it at runtime with the real `LIVEKIT_KEYS` value; do not restore or rotate production clients onto the development credential. If only a certificate rollout fails, restore the previous certificate/key files and recreate the SFU without changing application data.

This change stores no new user data and requires no database migration or retention policy. Its only persisted artifacts are operator-managed TLS files outside source control and existing Prometheus time-series governed by the platform's monitoring retention policy.
