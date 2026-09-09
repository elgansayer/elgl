## 2026-09-09 - [Redis Invalidation DoS Fix]
**Learning:** This codebase uses Redis cache tags and user lists. Using `redis.keys` with wildcards like `admin:users:list:*` runs blocking `KEYS` command which can freeze the Redis event loop, creating a DoS vulnerability or scaling bottleneck as the key count grows.
**Action:** Always prefer `redis.scan` with `MATCH` using a cursor when invalidating or listing wildcard keys in Redis for scalable cache evictions.
