# Personal message and call encryption

Issue: #1195

## Scope

Personal 1-on-1 text messages, voice calls, and video calls are secured using client-side encryption. Plaintext text-message content and real-time media frames are never exposed to the message transport (Centrifugo), database persistence (Supabase PostgreSQL), or media SFU (LiveKit). Media attachments and structured chat payloads need their own encrypted upload and rendering contracts before they can carry the same UI guarantee.

The authenticated NestJS application API operates outside the message and media plane as the key broker over TLS. Ephemeral and room key material is accessible only to verified room participants.

Group chats remain outside this encrypted payload flow: key broker requests for group rooms are rejected, and group messages continue to use standard transport security.

## Trust boundary

The application API derives and distributes the symmetric message and call keys. This protects content from database, Centrifugo and LiveKit inspection, but it does not protect content from a compromised application API. The UI therefore describes the current feature as encrypted, not end-to-end encrypted. A future cryptographic E2EE design must use client-held identity keys, authenticated device-to-device key agreement, rotation and recovery without exposing private or conversation keys to the API.

## Architecture and key brokering

### 1. Personal calls (voice and video)

- Ephemeral 256-bit CSPRNG keys are generated per direct call session by `VideoCallsEncryptionService` during `POST /video-calls/start`.
- The key and participant allowlist are cached in Redis (`call:e2ee:${roomId}`) with a 3600-second (1 hour) TTL matching the LiveKit token duration.
- Both caller and callee receive the key during call start and acceptance responses with `Cache-Control: no-store`.
- Frontend clients (`LivekitService` and `VideoCallService`) configure LiveKit's `ExternalE2EEKeyProvider` and launch a dedicated Web Worker before connecting to the SFU.
- The LiveKit SFU receives only encrypted WebRTC media frames and has no access to key material.

### 2. Personal messages (direct chats)

- Direct 1-on-1 chat rooms use authenticated AES-256-GCM encryption with 96-bit random initialization vectors (IVs).
- The backend `PersonalChatEncryptionService` derives a deterministic 256-bit AES key per direct room via HMAC-SHA256 over the canonical participant pair and room ID, keyed only by the dedicated `CHAT_E2EE_MASTER_SECRET`. Missing or short configuration fails closed, with no fallback to another credential or literal value.
- The derived key is cached in Redis (`chat:e2ee:${roomId}`) with a 24-hour TTL for high-throughput lookup.
- Room participants obtain the key on demand via `GET /chat/rooms/:roomId/e2ee-key`. The endpoint revalidates current database membership before every cache read and strictly validates that the requesting user is a room member before disclosing whether the room supports content encryption. Non-members receive `403 Forbidden`; authorised group members receive `422 Unprocessable Entity`.
- Responses enforce `Cache-Control: no-store` to prevent caching on intermediate proxies or disk.
- Frontend `PersonalChatEncryptionService` imports the key into the browser WebCrypto SubtleCrypto API and caches it in memory for the duration of the room session.

## Wire and storage envelope

### 1. Database schema

Migration `20261031040000_personal_messages_e2ee.sql` extends `public.chat_messages` with:

- `is_encrypted BOOLEAN NOT NULL DEFAULT false`
- `encrypted_payload TEXT`

### 2. Wire format

Encrypted messages use the envelope format:

```
e2ee:v1:<base64-iv>:<base64-ciphertext>
```

- When sending a message in a direct room, the frontend encrypts the plaintext using AES-256-GCM and sends `is_encrypted: true`, `encrypted_payload: "e2ee:v1:..."`, and a generic sanitised `text_content`.
- When receiving messages via REST or Centrifugo WebSocket channels, the frontend decrypts `encrypted_payload` in-place using WebCrypto.
- If decryption fails (for example tampering or payload corruption), the client displays a localised encrypted-message placeholder rather than crashing or revealing corrupted state.
- Push notifications for encrypted messages use the generic redacted string `'🔒 Encrypted message'`, ensuring APNs and FCM transport servers never inspect personal chat plaintext.
- Plaintext parsing features (server-side link preview extraction and @-mention notifications) are cleanly bypassed for encrypted messages.

## Failure behaviour (fail-closed)

All security boundaries fail closed:

- If key material cannot be retrieved or derived, calls refuse connection and personal messages refuse transmission.
- Direct calls fail closed: `VideoCallService` and `LivekitService` throw an error and abort connection if key material is missing or if the browser Web Worker fails to initialise.
- Personal text messages fail closed: `ChatService.sendMessage` halts if encryption fails, preventing plaintext leakage to Centrifugo or PostgreSQL. Offline direct messages are encrypted with an already-loaded in-memory room key before IndexedDB queueing; if that key or the cached room security state is unavailable, queueing is refused.
- Unauthorised users attempting to retrieve room keys receive an immediate `403 Forbidden` error.
- Group rooms reject encrypted-key requests with `422 Unprocessable Entity`, which is the only response the client interprets as permission to continue using the group's standard transport security.

## User interface indicators

Clear visual cues inform users of encrypted protection:

- **Chat room banner**: A top security banner with lock icon (`chatRoom.e2eeBanner`) displays in direct 1-on-1 chats and describes encrypted text-message storage and delivery.
- **Message padlock**: Individual encrypted messages display a lock icon beside their timestamp.
- **Call interfaces**: An encrypted-call badge is displayed only after media encryption is established on connected and active call surfaces:
  - `VoipCallComponent` (connected full-screen audio call)
  - `VoipActiveCallComponent` (floating mini-call overlay)
  - `VideoCallComponent` (connected 1-on-1 video call stage)

Incoming and connecting call screens do not display the badge because encrypted media has not yet been established.

## Security and privacy guarantees

- Keys are never persisted in Supabase tables, analytics, logs, traces, or client local storage (`localStorage`/`sessionStorage`).
- Call keys are ephemeral with a 1-hour TTL in Redis.
- Message keys are derived securely and cached in Redis with a 24-hour sliding TTL.
- Key broker endpoints require bearer JWT authentication and verify participant membership.
- All HTTP endpoints serving keys mandate `Cache-Control: no-store`.

## Verification

The test suite covers both unit and integration behaviour:

- **Backend**:
  - `PersonalChatEncryptionService`: deterministic key derivation, participant checking, group room rejection, Redis caching, stale-membership rejection, and missing-secret failure.
  - `ChatController`: `GET /chat/rooms/:roomId/e2ee-key` authentication, member authorisation, and response shape.
  - `ChatService`: encrypted message insertion, push notification preview redaction, link preview bypass, and edit preservation.
  - `VideoCallsService` and `CallsService`: call key generation, participant binding, and Redis caching.
- **Frontend**:
  - `PersonalChatEncryptionService`: key fetching, in-memory caching, WebCrypto AES-GCM encryption, decryption, and tamper rejection.
  - `ChatService`: direct message encryption before POST, realtime decryption, and local state management.
  - `VideoCallService`: fail-closed connection check when E2EE keys are absent.

## Rollout

1. Configure a unique, randomly generated `CHAT_E2EE_MASTER_SECRET` of at least 32 characters.
2. Apply the Supabase migration `20261031040000_personal_messages_e2ee.sql` to add `is_encrypted` and `encrypted_payload` columns plus their consistency constraint.
3. Deploy the NestJS backend API. The API provides the `/e2ee-key` endpoint, validates DTOs, and stores encrypted payloads.
4. Deploy the Angular frontend. Clients immediately begin negotiating encrypted sessions for 1-on-1 personal text messages and calls.

## Rollback

1. Roll back the frontend deployment to restore legacy behaviour.
2. Roll back the backend API deployment.
3. Revert migration `20261031040000_personal_messages_e2ee.sql` if required (`ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS is_encrypted, DROP COLUMN IF EXISTS encrypted_payload`).
