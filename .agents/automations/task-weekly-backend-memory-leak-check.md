# Weekly Backend Memory Leak & Health Check

## Objective
Ensure the NestJS API can run 24/7 on a VPS without degrading.

## Instructions
1. Analyze the backend controllers and services for potential memory leaks (e.g., improperly scoped providers, open Redis connections, or dangling RxJS subscriptions in services).
2. Validate that `onModuleDestroy` hooks properly close Centrifugo, LiveKit, and Supabase client connections.
3. Add robust unit tests that assert graceful teardown.
