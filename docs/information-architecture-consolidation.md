# Information Architecture Consolidation

## 1. Map of User-Facing Routes and Major Capabilities

**App & Onboarding**
- `/` -> `/home` (Currently `/ai-conversation`)
- `/home` - Landing experience for social and learning.
- `/onboarding` - Setup for languages and preferences.
- `/proficiency` - Diagnostic assessment.

**Communication & Social**
- `/chat` - Conversation inbox.
- `/chat/:id` - Direct/group messaging.
- `/discovery` - Partner discovery.
- `/moments` - Multimodal community timeline.
- `/profile` and `/profile/:userId` - User identity and activity.
- `/community` - Groups and communities (currently overlapping with `/groups`, `/communities`).

**Media & Live**
- `/audio-rooms` - LiveKit room discovery.
- `/video-call` and `/active-call` - Real-time calling.
- `/events` - Scheduled language events and live sessions (overlaps with `/language-parties`).

**Learning & Immersion**
- `/vocabulary` - SRS vocabulary and review.
- `/lessons` - Structured learning content.
- `/study-buddy` - Serious learning partner matching (overlaps with `/discovery`).
- `/ai-conversation` - AI bot conversation.

**Commerce & VIP**
- `/subscription` (aliases `/vip`) - Subscription plans.
- `/shop` and `/cart` - Virtual goods.
- `/coin-economy` - Virtual coin management.

**Settings & Admin**
- `/settings/*` - Consolidated configuration (notifications, privacy, linked accounts, etc.).
- `/admin/*` - Admin and moderation tools.

## 2. Identified Overlaps, Duplicates, and Redundancies

1. **Groups vs Communities:**
   - `/groups`, `/communities`, and `/community` all exist. `/groups` points to `GroupsDiscoveryComponent`, while `/community` points to `CommunitiesComponent`.
   - *Issue:* Redundant entry points for community features.

2. **Discovery vs Study Buddy:**
   - `/discovery` (Social) is for partner discovery.
   - `/study-buddy` (Learning) is for "serious-learning partner matching".
   - *Issue:* Split intent. Both are matchmaking capabilities.

3. **Events vs Language Parties:**
   - `/events`, `/events/calendar`, `/language-parties` (redirects to `/community/language-parties`), and `/language-islands` (redirects to `/community/language-islands`).
   - *Issue:* Confusing hierarchy for live events.

4. **Settings Aliases Sprawl:**
   - There are many root-level redirects to settings: `/chat-settings`, `/message-filters`, `/blocks`, `/visitors`, `/notification-preferences`, `/my-subscription`, `/account/deletion`, `/version`, `/gdpr`, `/device-transfer`, `/data-storage`, `/language`.
   - *Issue:* Pollutes the root route namespace.

5. **Flashcards & Vocabulary:**
   - `/vocabulary` (VocabularyDashboardComponent), `/decks`, `/review`, and `/suggest-flashcards`.
   - *Issue:* Multiple root-level routes for the single SRS capability. They should be nested under `/vocabulary`.

6. **Default Route:**
   - Default route `''` and fallback `**` redirect to `/ai-conversation`.
   - *Issue:* `/home` is the intended landing experience summarizing learning and social activity, per `ui_architecture.md`.

## 3. Consolidation Plan

1. **Default Route:** Update default `''` and `**` to redirect to `home` instead of `ai-conversation` so the user enters the primary dashboard.
2. **Communities:** Move `/groups` to `/community/groups`. Remove the `/communities` redirect and consolidate entirely under `/community`.
3. **Matchmaking:** Merge the concept of `/study-buddy` as a mode/filter within `/discovery`, or nest it as `/discovery/study-buddy`. For route purposes, move `/study-buddy` to redirect to `/discovery` with a query param, or update `/discovery` to handle both.
4. **Events:** Consolidate `/events`, `/language-parties`, and `/language-islands` under `/community/events` or `/events`.
5. **Vocabulary:** Move `/decks`, `/review`, and `/suggest-flashcards` to be children of `/vocabulary` (e.g., `/vocabulary/decks`).
6. **Clean up root aliases:** Remove legacy root-level redirects to settings if they are not actively used deep links, or clearly group them.
