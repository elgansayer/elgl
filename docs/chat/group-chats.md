# Group chats

Issue #844 adds small, interest-led study groups to the existing chat stack. A group contains **2 to 19 people total**, including its creator. The creator starts as the admin and at least one other partner is required.

## User flow

The existing Angular **Create group** screen is the entry point. It searches discovery partners, allows at most 18 invitees, and creates the room through `POST /chat/groups`. A study topic can be expressed in the group name (for example, `Beginner French Grammar`) and the backend also supports a description/avatar through the group update endpoint.

Group messages use the same `chat:<roomId>` Centrifugo channel and `chat_messages` table as direct messages. For a group room, the server verifies membership before message reads, sends, and typing events. First-contact direct-message filters and automatic away replies do not run for group messages: accepting a group invitation/membership is the consent boundary. Spam detection, XP, link previews, delivery tracking, push fan-out, mentions, corrections/replies, and existing message rendering remain available.

## API

All endpoints require Supabase authentication.

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/chat/groups` | authenticated user | Create a 2-19 person group; creator becomes admin |
| `GET` | `/chat/groups/:roomId` | member | Read group metadata and current role |
| `GET` | `/chat/groups/:roomId/members` | member | List members; compatible with the existing Angular array response |
| `PATCH` | `/chat/groups/:roomId/rename` | admin | Rename using the existing Angular contract |
| `PATCH` | `/chat/groups/:roomId` | admin | Update name, description, or avatar |
| `POST` | `/chat/groups/:roomId/members` | admin | Add members without exceeding 19 |
| `DELETE` | `/chat/groups/:roomId/members/:memberId` | admin | Remove a member |
| `POST` | `/chat/groups/:roomId/admin` | admin | Transfer admin ownership to an existing member |
| `POST` | `/chat/groups/:roomId/leave` | member | Leave; an admin must nominate a replacement first |

Invitees are deduplicated, must exist, and cannot have a block relationship with the inviting admin. A non-admin cannot mutate membership or group metadata. The current admin cannot remove themselves; they must transfer ownership or use the leave endpoint with `newAdminId`. The final member leaving archives the room.

## Database invariants

Migration `20260821000000_harden_group_chats.sql` adds two defence-in-depth triggers:

1. group membership inserts serialize on the room row and reject member 20, preventing concurrent requests from racing past the API count check;
2. inserts into `chat_messages` for a group reject senders who are not current room members.

It also adds group/member lookup indexes and a `topic` metadata column for future dedicated topic UI. These checks protect alternative clients and service-role code that can bypass browser-side controls.

## Compatibility

Direct chats continue through the existing `ChatService` behavior. `GroupAwareChatService` delegates direct rooms unchanged and only takes the group-specific path after reading `chat_rooms.type`. Existing Angular group methods (`createGroup`, `renameGroup`, `addGroupMembers`, `removeGroupMember`, and `getGroupMembers`) retain their current endpoint shapes.

## Verification

Before deployment:

1. Run backend build, lint and tests, including `group-chat.dto.spec.ts`.
2. Run frontend build and `create-group.component.spec.ts`.
3. Apply migrations to a staging Supabase database.
4. Create a group with 2 users and another with 19 users.
5. Verify a 20th member is rejected at both the API and database layers.
6. Verify a non-member cannot read, send, type, list members, or manage a group.
7. Verify member messages fan out over Centrifugo and produce per-recipient notifications.
8. Verify direct-chat first-contact filtering still behaves as before while group messages bypass it.
9. Transfer admin, remove a member, and exercise member/admin leave behavior.

## Rollback

Application rollback is safe before dropping database protections. If the migration itself must be rolled back, drop `trg_enforce_group_message_membership` and `trg_enforce_group_member_limit`, then their functions. The added indexes and `topic` column are backwards-compatible and may remain in place. Do not remove the 19-member database trigger while clients that depend on the limit are deployed.
