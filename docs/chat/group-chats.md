# Group chats

Issue #844 adds small, interest-led study groups to the existing chat stack. A group contains **2 to 19 people total**, including its creator. The creator starts as the admin and at least one other partner is required.

## User flow

The existing Angular **Create group** screen is the entry point. It searches discovery partners, allows at most 18 invitees, and creates the room through `POST /chat/groups`. The API supports a group name, description, avatar, short study `topic` (for example, `Beginner French Grammar`), and an optional canonical `interestId` for discovery/recommendation surfaces.

The existing chat room UI already provides group-aware sender attribution, participant/mention UI, an admin panel for renaming and membership changes, corrections/replies, voice notes, stickers and search. The backend now supplies canonical group identity and admin ownership to that UI from `chat_rooms`/`chat_room_members` instead of relying on the legacy mock room fallback.

Group messages use the same `chat:<roomId>` Centrifugo channel and `chat_messages` table as direct messages. For a group room, the server verifies membership before message reads, sends, typing events and member enumeration. First-contact direct-message filters and automatic away replies do not run for group messages: group membership is the consent boundary. Spam detection, XP, link previews, delivery tracking, per-recipient notification fan-out, mentions, corrections/replies, and existing message rendering remain available.

## API

All endpoints require Supabase authentication.

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/chat/groups` | authenticated user | Atomically create a 2-19 person group; creator becomes admin |
| `GET` | `/chat/groups/:roomId` | member | Read group metadata and current role |
| `GET` | `/chat/groups/:roomId/members` | member | List members; compatible with the existing Angular array response |
| `PATCH` | `/chat/groups/:roomId/rename` | admin | Rename using the existing Angular contract |
| `PATCH` | `/chat/groups/:roomId` | admin | Update name, description, topic, interest or avatar |
| `POST` | `/chat/groups/:roomId/members` | admin | Add members without exceeding 19 |
| `DELETE` | `/chat/groups/:roomId/members/:memberId` | admin | Remove a member |
| `POST` | `/chat/groups/:roomId/admin` | admin | Transfer admin ownership to an existing member |
| `POST` | `/chat/groups/:roomId/leave` | member | Leave; an admin must nominate a replacement first |

Invitees are deduplicated, must exist, and cannot have a block relationship with the inviting admin. A non-admin cannot mutate membership or group metadata. The current admin cannot remove themselves; they must transfer ownership or use the leave endpoint with `newAdminId`. The final member leaving archives the room.

## Atomic creation and concurrency

Migration `20260821000000_harden_group_chats.sql` installs `create_group_chat_atomic`, callable only by the backend service role. The function validates creator/member existence, 2-19 capacity, optional interest metadata and creator/invitee block relationships, then inserts the room plus every initial membership in one PostgreSQL transaction. The public API therefore cannot expose an empty or partially-created group.

Subsequent member additions are protected by a `BEFORE INSERT` trigger that locks the room row before counting members. Concurrent admin requests therefore serialize and member 20 is rejected at the database boundary even if two requests passed the application pre-check at the same time.

If account deletion or moderator cleanup removes a group admin outside the normal leave endpoint, an `AFTER DELETE` membership trigger promotes the oldest remaining member. If no members remain, it archives the room. This prevents live orphaned groups.

## Authorization and privacy

The application service takes a dedicated group path for room listing, message history, message sends, typing and member reads. Direct rooms continue through the established direct-chat behavior. Group sends do **not** apply issue #772 first-contact recipient filters or direct-chat away-message logic.

The migration also enables membership-scoped RLS for rooms, memberships, messages and reactions. Authenticated clients cannot enumerate rooms/messages/reactions unless `auth.uid()` is a current member, and message inserts additionally require `sender_id = auth.uid()`. A database trigger repeats the membership/archive check for service-role group message inserts as defence in depth.

Notification fan-out emits one `chat.message` event per other group member. The existing notification listener remains the source of truth for notification preferences and DND behavior, so group implementation does not bypass per-user opt-outs.

## Storage and indexing

Chat groups intentionally reuse `chat_rooms`, `chat_room_members`, `chat_messages` and `message_reactions`; no parallel chat-group membership/message model is introduced. The migration adds `topic` and `interest_id` metadata plus partial indexes for active group discovery and `(user_id, room_id)` membership lookup. Message history remains bounded to 100 messages in the current group-read path and member reads are capped at the product maximum of 19.

## Compatibility

`GroupAwareChatService` delegates direct rooms to the existing `ChatService` and uses the group-specific path only when `chat_rooms.type = 'group'`. Existing Angular group methods (`createGroup`, `renameGroup`, `addGroupMembers`, `removeGroupMember`, and `getGroupMembers`) retain their current endpoint shapes. The room-list mapping accepts both canonical (`name`, `avatar_url`, `description`) and legacy (`title`, `avatar`, `subtitle`) columns so a mixed client deployment remains usable.

## Verification

Before deployment:

1. Run backend build, lint and tests, including `group-chat.dto.spec.ts` and `group-chat-create.service.spec.ts`.
2. Run frontend build and `create-group.component.spec.ts`.
3. Replay migrations on a clean/staging Supabase database before deploying the backend that calls `create_group_chat_atomic`.
4. Create a group with 2 users and another with 19 users; verify room + initial memberships appear together.
5. Race two member-add requests against an 18-member group and verify at most one succeeds.
6. Verify a 20th member is rejected at both the API and database layers.
7. Verify a non-member cannot read/send/list group content and an archived group cannot accept messages.
8. Verify member messages fan out over Centrifugo and produce per-recipient notifications respecting preferences/DND.
9. Verify direct-chat first-contact filtering still behaves as before while group messages bypass it.
10. Transfer admin, remove a member, exercise member/admin leave behavior, then simulate admin account deletion and verify automatic recovery.

## Deployment and rollback

Apply `20260821000000_harden_group_chats.sql` **before** deploying the backend because `POST /chat/groups` uses the new atomic RPC. The frontend change is backwards-compatible and may deploy independently.

Application rollback is safe while leaving the database protections in place. For a database rollback, first roll the backend back so it no longer calls `create_group_chat_atomic`. Then remove the group policies/triggers/functions introduced by the migration if required. The `topic`/`interest_id` columns and indexes are additive and may remain. Do not remove the 19-member or group-message membership triggers while clients that depend on those invariants are deployed.
