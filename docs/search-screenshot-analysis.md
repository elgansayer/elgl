# Search Reference Screenshot Analysis

## Purpose

This document provides a comprehensive reference analysis of the original HelloTalk Android search capture corpus in `original-hello-talk-screenshots/`. It establishes the behavioral, architectural, and visual contracts for ELGL's search and discovery experiences, including:

- Chat-level conversation search and filtering
- Find Partners discovery search and multi-dimensional learner matching
- Nearby map-based spatial search
- Custom search compact scanning views

This document serves as an architectural reference and design system reconciliation contract. It is not an instruction to copy source-product trademarks, branding, or proprietary trade dress. ELGL preserves its independent Relay design language, Spartan UI primitives, semantic theme tokens, strict accessibility standards, British English spelling conventions, and robust privacy boundaries.

## Evidence and corpus scope

The repository contains 49 PNG captures in `original-hello-talk-screenshots/`, representing 33 unique binary captures across Android Waydroid desktop runtime sessions. Within this corpus, exactly 19 captures (13 unique binary states and 6 byte-identical alias pairs) constitute the search reference set.

The search capture sequence spans timestamps `012546` through `012729`. From timestamp `012747` onwards, the corpus transitions into Moments feed and discussion detail captures, which are separately inventoried by `docs/moments-feed-reference-analysis.md`.

Six captures in the search set possess `-1` filename suffixes that are byte-identical SHA-256 aliases of their canonical captures. These aliases represent identical binary artifacts and must not be treated as separate application states. The automated drift guard in `scripts/check-search-reference-analysis.mjs` verifies asset persistence, alias group byte-identity, and documentation consistency.

## Capture inventory

The Git blob identity and SHA-256 digests identify exact alias groups. Each row in the table below maps a canonical capture, its verified alias, its reference functional area, and its observed user interface state.

| Canonical capture                | Exact alias                        | Reference area                   | Observed UI state and primary focus                                      |
| -------------------------------- | ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `Screenshot_20260722_012546.png` | none                               | Chat search shell                | Top search input, conversation filter tabs, language filter pills        |
| `Screenshot_20260722_012551.png` | none                               | Chat search results              | Active query matching, conversation result cards with metadata           |
| `Screenshot_20260722_012559.png` | `Screenshot_20260722_012559-1.png` | Chat search suggestions          | Categorised results, Language Talks section, AI conversation prompts     |
| `Screenshot_20260722_012610.png` | `Screenshot_20260722_012610-1.png` | Find Partners initial            | Top category filter pills, language filter row, learning test banner     |
| `Screenshot_20260722_012615.png` | `Screenshot_20260722_012615-1.png` | Find Partners filter sheet       | Language pair picker, native and target language filter modal            |
| `Screenshot_20260722_012624.png` | none                               | Find Partners results            | Filtered candidate partner list, rich partner cards with presence dots   |
| `Screenshot_20260722_012629.png` | none                               | Find Partners card details       | MBTI personality badges, interest and hobby tags, interaction modes      |
| `Screenshot_20260722_012635.png` | `Screenshot_20260722_012635-1.png` | Find Partners card badges        | VIP status badges, Partner of the Week highlight, Connect action trigger |
| `Screenshot_20260722_012646.png` | none                               | Find Partners filter interaction | Active category pill toggle, sorting order overlay, pagination scroll    |
| `Screenshot_20260722_012657.png` | `Screenshot_20260722_012657-1.png` | Nearby map search                | Interactive world map, partner geographic clusters, location pins        |
| `Screenshot_20260722_012705.png` | none                               | Nearby map search list drawer    | Bottom sheet list of nearby partners ordered by coarse distance          |
| `Screenshot_20260722_012715.png` | `Screenshot_20260722_012715-1.png` | Find Partners filter drawer      | Advanced criteria modal: city, gender, age range, learning seriousness   |
| `Screenshot_20260722_012729.png` | none                               | Custom search view               | Compact partner card layout for rapid high-density candidate scanning    |

## Reference search flows and modalities

### 1. Chat-level conversation search (`012546`, `012551`, `012559`, `012559-1`)

The chat search interface is positioned at the top of the messages inbox. It answers the user query: "Which existing conversation or partner requires my attention?"

- **Top search field:** persistent full-width input container featuring a magnifying glass icon, query hint prompt, and clear query action.
- **Primary conversation filter tabs:** horizontally scrollable single-select pill group containing:
  - `All`: unfiltered list of conversations matching query.
  - `Archives`: archived conversations excluded from default inbox view.
  - `Online`: conversations where partner is currently active.
  - `Unread`: conversations with pending unread incoming messages.
  - `My turn`: deterministic turn-taking status (last incoming message unanswered).
  - `Timezone proximity`: conversations where partner local time aligns with current user.
- **Secondary language filter pills:** horizontal row of language badges:
  - `Thai`, `English`, `Chinese Simplified`, `Japanese`, followed by an interactive `More` action.
- **Categorised result sections:**
  - `Language Talks`: live audio and group discussion rooms relevant to query.
  - `AI Assistant`: contextual prompt suggestion cards assisting conversation initiation (e.g. "If they only reply 'ok', are they upset?").
  - `Conversation Cards`: partner avatar, display name, last message preview snippet, relative timestamp, unread badge counter, and room type indicators.

### 2. Find Partners / Discovery search (`012610`, `012610-1`, `012615`, `012615-1`, `012624`, `012629`, `012635`, `012635-1`, `012646`, `012715`, `012715-1`)

The primary social discovery surface facilitating cross-linguistic language exchange partner matching.

- **Header and navigation:** page title `Find Partners`, action buttons for search configuration, filter drawer toggle, and view switching.
- **Top category filter pills:** horizontally scrollable container featuring:
  - `All`: comprehensive learner directory.
  - `Serious Learners`: verified learners committed to regular study schedules.
  - `Nearby`: geo-spatial sorting based on relative distance.
  - `City`: city-specific partner scoping.
  - `Gender`: gender preference filtering.
  - `Paid Practice`: certified community tutors and language exchange hosts.
- **Language selector row:** compact badges displaying target exchange languages (`Japanese`, `Korean`, `Norwegian`) with expand control.
- **Promotional/Assessment banner:** contextual prompt for language assessment ("Find Your Perfect Chat Partner - Test Now >>").
- **Rich Partner Card architecture:**
  - _Identity block:_ user avatar, green presence dot, display name, verification badge.
  - _Language pair:_ directional indicator showing native and learning languages (e.g. `NO -> EN`, `JP -> EN`, `NO -> JP`).
  - _Location and proximity:_ city, country, and approximate distance (e.g. `Schaerbeek, Belgium >300km`, `Shenzhen, China`, `Incheon, South Korea`).
  - _Activity recency:_ textual indicator (`Active now`, `Active 2 minutes ago`, `Recently active`, `Joined 2 days ago`).
  - _Personality indicator:_ MBTI personality type tag (e.g. `INFP`, `INFJ`).
  - _Biography:_ multi-line truncated bio snippet introducing interests and learning targets.
  - _Interest and hobby pills:_ small rounded tags categorising learner affinities (`BLACKPINK`, `Games`, `Photography`, `Traveling`, `Baking`, `Painting`, `Transformers`, `Spider-Man`, `PUBG`).
  - _Shared interest highlight:_ contextual badge highlighting common ground (e.g. `You both like Fitness`).
  - _Desired interaction expectations:_ preferred exchange modalities (`Correction`, `Pronunciation`, `Language Exchange`).
  - _Badges and credentials:_ `VIP` membership indicator, `Partner of Week` highlight, `NEW` learner tag.
  - _Primary action:_ prominent `Connect` CTA button initiating language exchange requests.

### 3. Custom Search view (`012729`)

A specialized, high-density partner discovery view designed for experienced users conducting targeted queries.

- **Header navigation:** top back control `< Custom Search` paired with search parameters summary.
- **Streamlined tabs:** `All` and `Serious Learners`.
- **Compact card layout:** vertical height reduced by 40% compared to rich discovery cards, allowing 4 to 5 candidate partners visible per viewport.
- **Core compact elements:** avatar with presence indicator, inline display name, language exchange pair, coarse location string, active status pill, truncated single-line bio, and status badges (`VIP`, `NEW`).

### 4. Nearby / Map-based search (`012657`, `012657-1`, `012705`)

Geographic partner discovery enabling local community finding and travel preparation.

- **Interactive map viewport:** full-screen pinch-to-zoom map displaying partner concentrations across global regions.
- **Cluster markers and individual pins:** numeric cluster circles indicating local learner counts that expand into individual partner avatar pins on zoom.
- **Proximity list bottom sheet (`012705`):** draggable sheet surfacing nearby partners sorted by ascending distance, displaying coarse distance badges (e.g. `1.2 km`, `5 km`, `>20 km`).

## Architectural breakdown and design patterns

### Information architecture and filter hierarchy

The reference captures demonstrate a strict two-tier filter hierarchy:

```
+-------------------------------------------------------------+
| Top Search Bar: Text Input (Name, City, Keyword)            |
+-------------------------------------------------------------+
| Tier 1 Filters: Functional / Modality Scope                 |
| [ All ] [ Serious Learners ] [ Nearby ] [ City ] [ Gender ] |
+-------------------------------------------------------------+
| Tier 2 Filters: Language Exchange Criteria                  |
| [ Japanese ] [ Korean ] [ Norwegian ] [ + More Languages ]  |
+-------------------------------------------------------------+
| Partner Result Collection (Rich, Compact, or Map Overlay)   |
+-------------------------------------------------------------+
```

1. **Tier 1 (Functional scope):** partitions the query domain by intent (all users, serious learners, spatial proximity, demographic filters).
2. **Tier 2 (Language criteria):** narrows the candidate pool by native and target language pairs.
3. **Progressive narrowing:** users select intent first, language exchange pair second, and keyword criteria third.

### Visual hierarchy of partner cards

The layout prioritises visual elements in order of learner decision-making importance:

1. **Primary scan tier:** avatar, display name, and language exchange pair (`Native -> Learning`). Users first evaluate linguistic compatibility.
2. **Secondary scan tier:** location, coarse distance, and active recency. Users next determine timezone and conversational availability.
3. **Tertiary scan tier:** shared interests, MBTI personality type, and learning goals. Users assess conversational chemistry and common topics.
4. **Action tier:** right-aligned or bottom-anchored `Connect` button provides an unambiguous next step.

## ELGL parity decisions and design divergence

### Features adopted in ELGL

1. **Multi-tiered filter architecture:** separate modality pills from language selection pills across chat search and discovery.
2. **Directional language pairs:** prominently render native and learning language pairs using standard ISO language codes internally and localised labels in the UI.
3. **Rich partner cards:** surface MBTI personality type, interest tags, shared interest highlights, and desired interaction expectations on discovery cards.
4. **Recency text:** replace ambiguous coloured dots with descriptive text (`Active now`, `Active 5m ago`, `Recently active`) to provide clear conversational context.
5. **Turn-taking indicators:** provide deterministic "My turn" indicators based on message exchange history.

### Intentional ELGL divergences

1. **Design system and UI primitives:** ELGL uses Spartan UI primitives (Spartan button, badge, avatar, dialog, tabs) and Tailwind CSS logical properties rather than copying source Android visual styling.
2. **Theme and colour palette:** ELGL adheres strictly to its semantic theme token system (supporting light, dark, and system themes with full contrast parity) and user-configurable accent colours.
3. **No dark-pattern paywalls:** source screenshots display restrictive VIP prompts for basic filter actions. ELGL rejects abusive monetisation gates; core search, filtering, and discovery capabilities remain accessible without artificial friction.
4. **British English copy:** all UI strings and documentation use British English (`colour`, `favourite`, `monetisation`, `tokenise`, `optimisation`, `synchronised`).
5. **No em dashes:** all documentation, comments, and copy avoid em dashes, using colons or hyphens instead.
6. **Privacy-first geo-location:** source captures suggest precise location sharing. ELGL strictly enforces coarse, obfuscated distance calculation on the backend, never exposing raw GPS coordinates.

## Accessibility and internationalisation

- **Intl.Segmenter tokenisation:** all search query processing, keyword highlighting, and word boundary detection use `Intl.Segmenter` to ensure accurate segmentation across Chinese, Japanese, Korean, Thai, Arabic, and Latin scripts.
- **Full i18n support:** zero hard-coded copy. All user-facing labels, empty states, filter names, and button text utilize `TranslatePipe` in Angular templates and `I18nService` in programmatic contexts.
- **Directional layout (RTL):** all containers, filter rows, partner card columns, and badge margins use Tailwind CSS logical properties (`ps-`, `pe-`, `ms-`, `me-`, `border-s`, `border-e`, `start-`, `end-`) to guarantee natural right-to-left mirroring in Arabic, Hebrew, and Persian.
- **Touch target compliance:** every filter pill, language badge, connect button, and interactive tab meets or exceeds the WCAG 2.2 AA minimum touch target sizing of 44 by 44 CSS pixels.
- **Screen reader announcements:** search inputs use semantic `<search>` elements; filter tabs employ `role="tablist"` and `role="tab"` with `aria-selected` state; partner cards use `<article>` elements with accessible headings.
- **Zoom reflow resilience:** horizontal filter containers and partner card grids support 200% and 400% browser zoom without text truncation or horizontal overflow clipping.

## Privacy, security and abuse resistance

- **Coarse spatial query resolution:** the backend uses PostGIS geography queries with spatial quantization, calculating distance ranges (e.g. `<5km`, `<25km`, `>100km`) without storing or returning high-precision latitude/longitude pairs.
- **Privacy preference enforcement:** backend search queries automatically filter out users who have enabled "Hide my location", "Hide online presence", or who exist in the requesting user's block list.
- **SQL injection prevention:** all text searches via `pg_trgm` similarity or full-text search use parameterized NestJS repository queries; unsanitized user query interpolation is strictly prohibited.
- **Rate limiting and enumeration prevention:** search and discovery endpoints are bounded by rate limiting guards in NestJS to prevent automated scraping of user profiles or mass bot connections.

## Performance and failure handling

- **Bounded pagination:** all search and discovery endpoints enforce maximum page size boundaries (`limit <= 50`) using keyset or cursor-based pagination, preventing unbounded database scans.
- **Database index optimisation:** user display names, bios, and interest tags are indexed using PostgreSQL `pg_trgm` GIN indices to enable sub-50ms fuzzy matching across large user populations.
- **Spatial indexing:** user location coordinates are indexed using PostGIS GiST spatial indices (`GIST(location)`).
- **Graceful degradation:** when search backend connectivity fails or queries return zero results:
  - Display helpful empty state illustrations and recommended search adjustments.
  - Present explicit error notifications and retry actions when search connectivity fails.
  - Provide immediate client-side retry mechanisms without losing entered query text.

## Verification and maintenance

The search reference analysis contract is enforced by automated test tooling to prevent evidence drift and regression:

- **Verification script:** `scripts/check-search-reference-analysis.mjs`
- **Unit test suite:** `scripts/check-search-reference-analysis.test.mjs`
- **NPM task:** `npm run check:search-reference-analysis`

The verification runner enforces that:

1. All 19 search reference screenshots remain present in `original-hello-talk-screenshots/`.
2. All 6 byte-identical alias pairs maintain matching SHA-256 digests.
3. Every referenced screenshot is cited in `docs/search-screenshot-analysis.md`.
4. All required architectural section headings are preserved.
5. All duplicate alias pairs share a unified inventory table row.
6. Zero banned em dash punctuation characters exist within the document.
