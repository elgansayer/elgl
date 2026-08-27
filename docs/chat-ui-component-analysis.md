# Chat UI Reference Screenshot Analysis

## Purpose

This document analyses the original HelloTalk Android screenshot corpus in
`original-hello-talk-screenshots/` specifically for chat and conversation UI. It is a
reference contract, not an instruction to copy source-product branding or trade dress.
ELGL should preserve its Relay design system, Spartan primitives, accessibility contract,
and existing backend/security boundaries while borrowing useful interaction patterns.

## Evidence and corpus scope

The repository contains 49 PNG files in the reference corpus. The chat-search sequence is
positively identified by the existing search analysis and consists of these four files:

- `Screenshot_20260722_012546.png`
- `Screenshot_20260722_012551.png`
- `Screenshot_20260722_012559.png`
- `Screenshot_20260722_012559-1.png`

`Screenshot_20260722_012559.png` and `Screenshot_20260722_012559-1.png` are byte-identical
aliases, so the sequence represents three unique visual states rather than four. The drift
guard in `scripts/verify-chat-reference-analysis.mjs` protects that evidence from silently
changing.

The earlier version of this document described a generic chat interface without naming its
evidence and treated several now-shipped ELGL features as missing. This revision separates
observed reference behavior from current ELGL implementation decisions and avoids inferring
screen ownership from filenames alone.

## Reference chat search flow

### Information architecture

The reference search screen is conversation-first rather than message-type-first. The top
search field is followed by horizontally scrollable conversation filters and a second row of
language filters.

Observed conversation filters are:

- All
- Archives
- Online
- Unread
- My turn
- Timezone proximity

Observed language pills include Thai, English, Chinese Simplified, and Japanese, with a More
action for additional languages.

Below the filters, the reference UI includes a Language Talks section and an AI Assistant
area with suggested conversation prompts. Conversation results prioritise the partner/room
name, last-message preview, relative timestamp, unread or turn-taking state, and room-type
metadata such as live/voice-room context.

### What the reference gets right

The strongest pattern is progressive narrowing: text search, conversational state, then
language context. It supports the learner's actual question ("which conversation needs my
attention?") without requiring knowledge of message storage types. State is visible in the
list, so a user does not need to open each room to discover unread or turn-taking status.

### What ELGL should not copy literally

The exact source styling, branding, iconography, spacing, and promotional/AI content are not
parity requirements. Timezone proximity can disclose sensitive behavioural/location signals
if implemented naively, and online filtering must honour ELGL's online-status privacy
setting. Language filters must use canonical language identifiers rather than display names.

## Chat-room visual contract

The wider reference corpus and the existing ELGL chat implementation establish the following
product hierarchy for a conversation screen. These are behavioral contracts rather than a
request for one monolithic visual component.

### Header

The header should make room identity, participant/profile affordance, and realtime status
understandable without competing with message content. Group rooms additionally need a clear
participant entry point. Presence is secondary metadata and must disappear when privacy
policy says it is hidden.

### Message timeline

The timeline is the primary surface. ELGL currently supports text, replies, corrections,
voice notes, media/doodles, gifts, system events, forwarded messages, receipts, typing state,
and other realtime message variants. The useful reference pattern is a stable sent/received
visual rhythm with lightweight date/timestamp context; message type must not force a wholly
separate page or break chronological scanning.

Use semantic grouping and preserve source order. Corrections and educational affordances
should remain visually related to the message they teach from. Delivery/read state is
secondary and should never be communicated by colour alone.

### Composer

The composer should keep text entry and Send as the dominant path while exposing richer
learning/media actions without permanently consuming most of the viewport. Reply/correction
context must be visible before send and dismissible. Recording/uploading/sending are real
states: controls must expose busy state, prevent duplicate submission, and keep unsent input
recoverable after failures.

### Search inside a conversation

ELGL's message search is intentionally distinct from the inbox-level search shown in the
reference screenshots. Message search can retain message-type/date/query tools because its
question is "find a message in this room", whereas inbox search asks "find or prioritise a
conversation". The two surfaces should not share one overloaded filter model merely because
both contain a search field.

## ELGL parity decisions

### Already represented in the current product

The current codebase has dedicated production paths for Chat Room, message search, emoji and
gift pickers, voice recording/playback, replies, corrections, media sharing, forwarding,
system events, group participants, realtime typing/receipts, unread counters, draft recovery,
and privacy-aware user state. New work should compose those paths rather than recreate the
obsolete component list from the previous version of this document.

### Reference-inspired opportunities

The chat-search screenshots identify useful inbox-level capabilities that remain conceptually
separate from message search:

1. **Conversation-state filters** such as unread and archived. These should be backed by
   authoritative conversation state and represented in the URL/store so reload/back
   navigation is predictable.
2. **My turn** can be valuable for language exchange, but only if the rule is deterministic
   and explainable (for example, latest human message from the other participant with no later
   reply from the current user). It must not become a hidden engagement score.
3. **Online** must respect the target user's visibility preference and should fail closed when
   presence is unavailable.
4. **Language filters** should compare canonical language codes associated with room
   participants and expose localized labels in the UI.
5. **Timezone proximity** should not require or expose precise location. If retained, derive
   it from an explicitly shared coarse timezone/profile setting and document the privacy
   trade-off.
6. **Conversation prompts** can use ELGL's existing learning/AI boundaries, but prompts are a
   secondary empty/help state, not paid-placement content mixed into private conversations.

These are product findings from the reference analysis, not automatic implementation
requirements for issue #1675. Each behavior that changes data/API semantics should remain a
separate scoped issue and PR.

## Accessibility and internationalisation

- Conversation and message collections should use list/log semantics appropriate to their
  interaction model; do not mark every individual bubble as a live region.
- Realtime announcements should be bounded so a busy group chat does not continuously
  interrupt screen-reader users.
- Search/filter controls need programmatic names, selected state, visible focus, keyboard
  operation, and at least a 44 px touch target where they are pointer targets.
- Horizontal filter rows must remain usable at 200% and 400% zoom. Wrapping or an accessible
  overflow mechanism is preferable to clipping controls off-screen.
- User-authored names, bios, message previews, and messages need bidirectional isolation such
  as `dir="auto"`; layout spacing should use logical properties for RTL.
- Language labels must be localized display names while API/store values remain stable
  language codes.
- Relative timestamps need an accessible exact-date equivalent where ambiguity matters.
- Voice/media controls must expose text alternatives and state independent of icon shape or
  colour.

## Privacy and security

The screenshots are design evidence only. They do not override ELGL's authorization model.

- Private room membership remains authoritative for conversation/message reads.
- Block relationships, hidden/deletion-pending accounts, and message privacy rules must be
  applied server-side, not inferred only in the Angular list.
- Presence/online filters must not reveal a user who has disabled online-status visibility.
- Do not log search queries, private message previews, room names, message bodies, tokens, or
  participant identifiers merely to diagnose filter behavior.
- Do not persist private chat search text in long-lived browser storage unless a separate
  privacy-reviewed requirement explicitly calls for it.
- Timezone/location-derived filters must operate on the least precise data needed for the
  feature and must never expose raw coordinates.
- AI prompt/help features must not send private conversation history to a provider unless the
  user explicitly invokes a reviewed feature whose privacy contract permits that content.

## Performance and failure handling

- Conversation collections and message results stay paginated/bounded; do not load the full
  chat history to implement an inbox filter.
- Debounce text search and cancel/ignore stale responses when room, query, or filter changes.
- Use stable identifiers for rendering so realtime updates do not rebuild the entire list.
- Preserve stale-but-valid conversation data during transient refresh failure and label the
  refresh failure rather than replacing a populated inbox with a false empty state.
- Presence, AI-assistant, or optional language metadata failures should degrade independently;
  the user must still be able to open an authorized conversation.
- Search/filter APIs should return stable validation errors for unsupported parameters and
  must bound page size, offsets/cursors, and query length.
- Realtime events and API pagination can overlap, so message/conversation merging must be
  idempotent and deduplicated by stable IDs.

## Verification and maintenance

Run:

```text
npm run check:chat-reference-analysis
```

The command runs Node regression tests and then checks the repository evidence. It fails when
one of the four positively identified chat-search screenshots is removed, when the known
`012559` alias pair stops being byte-identical, when the analysis stops naming its evidence,
or when required accessibility/privacy/operations sections are removed.

When the reference corpus changes, review the new image manually before changing the guard.
Do not simply update filenames or hashes to make CI green. If a new screenshot is determined
to be chat-specific, document what it adds to the behavioral model and then extend the
reference inventory in the same PR.

No runtime data, schema, or user state is introduced by this analysis. Rollback is a normal
revert of the documentation/check changes; the source screenshots should not be deleted to
satisfy the verifier.
