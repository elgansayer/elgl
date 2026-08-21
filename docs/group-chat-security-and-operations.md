# Group chat security and operations

Issue #844 completes group chats on top of the canonical `chat_rooms` / `chat_room_members` model. A group chat is a normal chat room with `type = 'group'`; direct conversations and group conversations therefore keep the same message, correction, reaction, read-receipt, offline-queue, and Centrifugo transport paths.

## Product invariants

- A group contains 2 to 19 people total, including the creator.
- The creator is the initial admin and is stored consistently in both `chat_rooms.admin_id` and the creator membership row (`role = 'admin'`).
- Member IDs are de-duplicated before capacity is evaluated.
- Blocked or blocking users cannot be invited by the requester.
- Only the current admin can change group metadata, add or remove members, or transfer admin ownership.
- An admin cannot be removed or leave a non-empty group until ownership is transferred.
- The final member leaving soft-deletes the room instead of leaving an orphaned active conversation.
- Message inserts are rejected by a database trigger unless the sender is still a member of the target room. This protection also applies to service-role writes.

## Atomicity and concurrency

Creation and membership changes use `SECURITY DEFINER` PostgreSQL functions rather than a sequence of application-side inserts. `add_group_chat_members`, `remove_group_chat_member`, `transfer_group_chat_admin`, and `leave_group_chat` lock the `chat_rooms` row with `FOR UPDATE` before evaluating capacity or ownership. Two concurrent invite requests therefore cannot both observe stale capacity and push a room past 19 members.

The functions are revoked from `PUBLIC` and granted only to `service_role`. The Nest API supplies the authenticated user ID as the requester and maps authorization, missing-resource, and capacity failures to appropriate HTTP errors.

## API

All routes require the normal Supabase auth guard.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/chat/groups` | Create a group with 1-18 invited members |
| `GET` | `/chat/groups/:roomId` | Read group metadata as a member |
| `GET` | `/chat/groups/:roomId/members` | List members as a member |
| `PATCH` | `/chat/groups/:roomId` | Update name/topic/avatar as admin |
| `PATCH` | `/chat/groups/:roomId/rename` | Compatibility route for the existing Angular client |
| `POST` | `/chat/groups/:roomId/members` | Add members as admin |
| `DELETE` | `/chat/groups/:roomId/members/:memberId` | Remove a non-admin member |
| `POST` | `/chat/groups/:roomId/admin` | Transfer ownership to an existing member |
| `POST` | `/chat/groups/:roomId/leave` | Leave; final member soft-deletes the group |

Successful membership and metadata operations emit the existing realtime system-message events so an open room can refresh without polling.

## Frontend behavior

The existing create-group flow is retained and now uses the backend's 19-person contract: at most 18 other users may be selected. On successful creation the client opens the newly created chat room immediately rather than returning to an unrelated page.

Existing room administration actions (`renameGroup`, `addGroupMembers`, `removeGroupMember`, and `getGroupMembers`) now have matching authenticated server routes. Legacy clients calling `/chat/groups/:roomId/rename` continue to work while newer clients can use the general metadata endpoint.

## Deployment and verification

1. Apply Supabase migrations before deploying the backend that calls the new RPC functions.
2. Deploy the backend and confirm `POST /chat/groups` creates exactly one room and one membership per unique participant.
3. Exercise concurrent member additions near capacity and verify the room never exceeds 19 memberships.
4. Confirm non-members cannot read group metadata/member lists and non-admins receive a forbidden response for mutations.
5. Confirm blocked users cannot be added.
6. Confirm message insertion by a non-member fails with `chat_room_membership_required`.
7. Create a group from the Angular UI and confirm it opens `/chat/<room-id>` and receives realtime system events.

## Rollback

The Nest routes can be rolled back independently after stopping traffic that calls the group RPCs. If the database portion must be reverted, first remove application calls to the functions, then drop the five group mutation functions and the `enforce_chat_sender_membership` trigger/function. The additive `chat_rooms` columns can remain safely in place; dropping them is intentionally not part of the fast rollback because doing so could destroy group metadata written after rollout.
