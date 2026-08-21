# Daily Centrifugo Real-Time Payload Audit

## Objective
Guarantee seamless real-time messaging by validating WebSocket JSON payloads.

## Instructions
1. Review the `realtime-centrifugo-channel` skill.
2. Audit the NestJS Centrifugo publish methods to ensure the payloads strictly match the expected interfaces (`text`, `voice`, `correction`, `doodle`, `gift`).
3. Confirm that sensitive user data (e.g., passwords, raw email) is never accidentally broadcast over a global or public channel.
4. Audit the Angular frontend to ensure all incoming payload types are parsed and mapped to strict TypeScript interfaces using Zod or custom type guards.
