# AI conversation starters

Issue #662 adds AI-assisted starter prompts to genuinely new one-to-one chats. The feature reuses the existing `POST /chat/conversation-starters` API and the existing frontend `ChatService.getConversationStarters()` client.

## User experience

Conversation starters are requested only after the chat room has loaded, has no messages, has exactly two participants, and the current composer is empty. Three suggestions are displayed as normal keyboard-focusable buttons with mobile-sized hit targets. Selecting a suggestion copies it into the composer and dismisses the starter panel; it never sends a message automatically.

The panel disappears when a message exists, when a message arrives in real time, when the user starts composing, or when a restored draft already contains text. Group chats never request starters. Loading and request-error states are announced using existing translated UI strings so the feature does not introduce untranslated static copy.

## Privacy and safety boundary

The backend does not treat `partnerId` as permission to read a profile. Before any profile or interest data is read, `ConversationStarterService` verifies that:

1. the caller is not requesting suggestions for themselves;
2. caller and partner share a chat room whose membership is exactly two users; and
3. neither user is in the caller's blocked/blocker set.

Requests that fail these checks return a generic forbidden response and do not invoke the LLM. This prevents the authenticated endpoint from becoming an arbitrary profile-probing surface. Profile fields included in the generation prompt are bounded in length, interests/languages are capped, and the prompt explicitly treats profile data as untrusted content. Prompt contents are not logged.

## Quota protection

Generated results, including deterministic fallbacks, are cached per caller/partner pair. The default TTL is 15 minutes and can be changed with `CONVERSATION_STARTER_CACHE_TTL_MS` (minimum 1 second, capped at 1 hour). Concurrent requests for the same pair share the same in-flight generation promise so one page-opening burst consumes at most one LLM request per backend instance.

The service also applies a conversation-starter-specific per-user request window. The default is 6 requests per minute and can be changed with `CONVERSATION_STARTER_RATE_LIMIT_PER_MINUTE` (capped at 60). The application-wide Nest throttler remains an additional outer limit.

Both the cache and request-window maps are bounded/pruned to avoid unbounded process memory growth. Eligibility and block checks are repeated even when generated copy is served from cache, so a newly blocked user cannot keep receiving cached personalised starters.

## LLM failure behaviour

If the partner profile cannot be loaded after authorisation, the service returns three generic language-exchange prompts. If the LLM fails, returns no usable lines, duplicates lines, or returns fewer than three valid suggestions, deterministic profile-aware fallbacks fill the response to three entries. Model lines longer than 240 characters are discarded.

## Verification

Backend tests cover eligible direct chats, cached generation, blocked partners, group-member rejection, deterministic fallback filling, and the endpoint-specific request limit. Frontend tests cover empty-vs-existing chats, group suppression, request deduplication, selection-to-composer without auto-send, hiding after typing, keyboard-native buttons, mobile hit-target sizing, and request errors.

## Rollout and rollback

No database migration is required. Roll out the backend and frontend together so the UI's request behaviour and the hardened authorisation boundary arrive in the same release. Monitor 403/429 rates and LLM request volume after deployment.

Rollback is code-only: revert the issue #662 PR. There are no persisted schema changes or data migrations to undo. If generation volume needs to be reduced without a deploy, lower `CONVERSATION_STARTER_RATE_LIMIT_PER_MINUTE` or increase `CONVERSATION_STARTER_CACHE_TTL_MS` within the documented caps.
