# Issue 1
## Title: N+1 API Request Explosion on Message Status Updates
## Description
In `chat-page.component.ts`, when a user selects a room, the component auto-marks unread messages from others as 'delivered' and then 'read'. It loops over all unread messages and fires two unawaited API calls per message (`this.chatService.markMessageStatus(msg.id, 'delivered')` and `this.chatService.markMessageStatus(msg.id, 'read')`). This causes an N+1 explosion of HTTP requests if there are many unread messages, potentially overwhelming the backend and degrading frontend performance.
## Acceptance Criteria
* The two separate API calls per message are replaced with a single bulk update endpoint, or the backend logic is updated such that marking a message as 'read' automatically implies 'delivered'.
* The component only sends a single batched request for all unread message IDs.
* No race conditions or rate-limiting issues occur when loading a room with hundreds of unread messages.
## Suggested Labels
* performance
* tech-debt

# Issue 2
## Title: Redundant Message Deletion Logic in Centrifugo Event Handler
## Description
In the `handleCentrifugoEvent` method of `chat-page.component.ts`, the logic handling the `message_deleted` event contains redundant branches. If `deletedFor === 'everyone'`, it returns `msgs.filter((m) => m.id !== deletedId)`. The fallback return statement is identical (`msgs.filter((m) => m.id !== deletedId)`). This indicates either incomplete logic for handling 'deleted for me' vs 'everyone', or unnecessary branching that adds tech debt.
## Acceptance Criteria
* The redundant `if` statement is removed if both scenarios require the exact same client-side behaviour.
* If 'deleted for me' requires different handling (e.g. updating the message content instead of completely removing it from the array), the logic is correctly implemented.
## Suggested Labels
* bug
* tech-debt
* good first issue

# Issue 3
## Title: Race Condition in Room Selection (Message Overwrite)
## Description
When switching rooms rapidly in `chat-page.component.ts`, a race condition can occur. The `selectRoom` method calls `await this.chatService.getMessages(room.id)`. If a user clicks Room A, then immediately clicks Room B, the asynchronous request for Room A might resolve after the request for Room B. Because there is no guard to check if the active room is still the one that initiated the request, Room A's messages could overwrite the state of `this.messages` while the user is viewing Room B.
## Acceptance Criteria
* A guard condition is added after `await this.chatService.getMessages(room.id)` to verify that `this.selectedRoom()?.id === room.id` before calling `this.messages.set(messages)`.
* Alternatively, RxJS `switchMap` or Angular's `rxMethod` is used to automatically cancel stale requests when the selected room changes.
## Suggested Labels
* bug
