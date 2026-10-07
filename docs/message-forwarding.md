# Message forwarding

## Product contract

ELGL supports forwarding an existing chat message into one or more conversations while making the copied message visibly distinguishable from an original message. Forwarded records persist `is_forwarded = true`; existing Angular message rendering uses that flag for the **Forwarded** label.

The authoritative mutation is:

```http
POST /api/chat/messages/:messageId/forward
Authorization: Bearer <Supabase access token>
Content-Type: application/json

{
  "room_ids": ["<room uuid>"]
}
```

A single request must contain between 1 and 10 unique room UUIDs. `messageId` must be a UUID v4. The route is limited to 10 requests per minute per configured NestJS throttling scope.

The response is an array containing the successfully persisted forwarded messages. The existing Angular `ChatService.forwardMessage()` client calls this route.

## Authorization and privacy

`SupabaseAuthGuard` authenticates the request and the backend always derives the forwarding user from that session. The API does not accept a sender/user ID from the client.

`ChatService.forwardMessage()` remains the single business-rule implementation. Before copying content it verifies that the authenticated user can access the source conversation, removes the source room from the destination set, and restricts delivery to target rooms in which the user is a member. Existing block checks and target-room membership checks continue to apply before persistence/delivery.

The forwarding API does not expose source-room membership or other private conversation metadata to destination users. It copies the supported message payload needed to render the forwarded content and marks the new record as forwarded.

## Abuse resistance

Forwarding is deliberately bounded at both request and fan-out layers:

- at most 10 forwarding requests per minute at the route boundary;
- at most 10 unique target rooms per request;
- UUID validation occurs before business logic executes;
- forwarded text continues through the existing spam detector;
- target rooms are deduplicated and the source room is excluded;
- the server, not the browser, decides which destinations the authenticated user may write to.

These bounds prevent a single request from turning the forwarding endpoint into an unbounded message/push fan-out.

## Message semantics

Forwarding creates a new message in each accepted destination rather than moving or exposing the source database record.

The existing service intentionally:

- sets `is_forwarded = true`;
- starts a fresh reply thread (`reply_to_id = null`);
- does not preserve view-once semantics (`is_view_once = false`);
- preserves compatible text/media/correction/status payloads needed to render the copy;
- publishes each saved copy to the destination Centrifugo channel;
- emits the normal chat notification event for the destination conversation.

Because the copy has its own message ID and sender ID, normal delivery/read receipt behavior applies to the new message.

## Failure behavior

A source message that does not exist or cannot be accessed fails before fan-out. Spam and validation failures are returned to the caller rather than silently treated as success.

Destination processing is best-effort because one selected room may become unavailable while another remains valid. Individual destination insert/delivery failures are skipped. If no destination succeeds, the service returns a `400` failure rather than pretending the operation succeeded. The response array therefore represents the authoritative successful subset for partial-success requests.

The route does not queue forwards while offline. Clients should keep the original forwarding selection available for an explicit retry rather than replaying a potentially stale multi-room action automatically.

## Data model and retention

No migration is required for this change. `chat_messages.is_forwarded` already exists in the deployed chat-message enhancement migration. Forwarded copies follow the same retention, soft-delete, room authorization, backup/export, and account-deletion rules as ordinary chat messages.

## Verification

Focused backend verification:

```bash
cd backend
npm test -- src/chat/chat-forward.controller.spec.ts src/chat/dto/forward-message.dto.spec.ts
npm run build
npm run lint:check
```

Repository CI remains authoritative for the full backend, database, dependency, E2E-context and product-flow gates.

Manual acceptance checks should cover:

1. forward a text message to one permitted room and confirm the destination copy carries `is_forwarded: true` and renders the Forwarded label;
2. attempt an empty, duplicate, malformed or 11-room request and confirm validation rejects it before fan-out;
3. attempt to forward a message from a room the current account cannot access;
4. include an unauthorized destination alongside an authorized one and confirm only the successful copy is returned;
5. retry after a failed request and verify successful copies behave as independent ordinary destination messages.

## Rollout and rollback

The endpoint is additive and uses the existing message schema/service, so the backend can deploy independently of older clients. No data backfill is required.

Rollback is a normal code revert of the forwarding controller registration and request-boundary changes. Existing forwarded rows remain valid chat messages and require no cleanup. Leaving the existing `is_forwarded` column and service implementation in place is safe for mixed-version clients.
