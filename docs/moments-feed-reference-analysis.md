# Moments feed reference analysis

Issue: #1014

## Purpose

The files in `original-hello-talk-screenshots/` are a behavioural and information-hierarchy reference for ELGL's Moments experience. They are not a pixel-copy specification. ELGL keeps its own Relay design language, Spartan primitives, semantic theme tokens, user accent colour, accessibility requirements, and product terminology.

The corpus contains 49 PNG files representing 33 unique binary captures. Sixteen `-1` files are byte-identical aliases and must not be counted as separate product states. `npm run check:moments-reference-analysis` keeps this inventory synchronized with the repository and fails when an asset is added/removed without updating this analysis.

## Capture inventory

The Git blob identity was used to identify exact aliases. Rows with two filenames are one binary capture.

| Canonical capture | Exact alias | Reference area |
| --- | --- | --- |
| `Screenshot_20260722_012546.png` | none | Feed shell / content hierarchy |
| `Screenshot_20260722_012551.png` | none | Feed shell / content hierarchy |
| `Screenshot_20260722_012559.png` | `Screenshot_20260722_012559-1.png` | Moment card state |
| `Screenshot_20260722_012610.png` | `Screenshot_20260722_012610-1.png` | Media-rich Moment state |
| `Screenshot_20260722_012615.png` | `Screenshot_20260722_012615-1.png` | Moment card state |
| `Screenshot_20260722_012624.png` | none | Feed interaction state |
| `Screenshot_20260722_012629.png` | none | Feed interaction state |
| `Screenshot_20260722_012635.png` | `Screenshot_20260722_012635-1.png` | Moment card state |
| `Screenshot_20260722_012646.png` | none | Feed interaction state |
| `Screenshot_20260722_012657.png` | `Screenshot_20260722_012657-1.png` | Media-rich Moment state |
| `Screenshot_20260722_012705.png` | none | Feed interaction state |
| `Screenshot_20260722_012715.png` | `Screenshot_20260722_012715-1.png` | Moment card state |
| `Screenshot_20260722_012729.png` | none | Feed interaction state |
| `Screenshot_20260722_012747.png` | none | Media-rich Moment state |
| `Screenshot_20260722_012803.png` | `Screenshot_20260722_012803-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_012815.png` | `Screenshot_20260722_012815-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_012835.png` | `Screenshot_20260722_012835-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_012844.png` | none | Feed interaction state |
| `Screenshot_20260722_012851.png` | none | Media / discussion state |
| `Screenshot_20260722_012859.png` | `Screenshot_20260722_012859-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_012906.png` | none | Moment detail / discussion state |
| `Screenshot_20260722_012910.png` | none | Feed interaction state |
| `Screenshot_20260722_012920.png` | `Screenshot_20260722_012920-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_012928.png` | none | Moment detail / discussion state |
| `Screenshot_20260722_012941.png` | none | Media / discussion state |
| `Screenshot_20260722_012946.png` | none | Feed interaction state |
| `Screenshot_20260722_012953.png` | `Screenshot_20260722_012953-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_013006.png` | none | Feed interaction state |
| `Screenshot_20260722_013018.png` | none | Moment detail / discussion state |
| `Screenshot_20260722_013023.png` | `Screenshot_20260722_013023-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_013034.png` | `Screenshot_20260722_013034-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_013040.png` | `Screenshot_20260722_013040-1.png` | Moment detail / discussion state |
| `Screenshot_20260722_013055.png` | `Screenshot_20260722_013055-1.png` | Feed / terminal captured state |

## Product findings

### 1. The Moment, not the surrounding chrome, is the primary unit

The reference set repeatedly centres the author's identity, the post body/media, recency, and social actions as a single scan unit. ELGL should preserve that reading order even when search/filter controls are present. The feed toolbar must remain secondary to the content cards and should not become a dashboard-style header.

Current mapping:

- `frontend/src/app/components/moments-feed/moments-feed.component.html` already renders each Moment as an `article` and keeps author identity at the top of the card.
- `moments-feed.component.ts` bounds the rendered collection and separates feed filtering from individual Moment state.
- Relay cards and semantic surface tokens are intentional ELGL differences from the source product.

### 2. Identity and context must be visible before interaction

The reference hierarchy gives users enough context to decide whether to engage before presenting the social actions: avatar/name, status markers where applicable, timestamp, then content. ELGL's profile link, VIP/Serious Learner badges, and timestamp belong in the card header rather than in an action overflow.

Requirements carried forward:

- Profile identity must remain navigable without making the entire card a link.
- Status badges must have text/accessible names and must not rely on colour alone.
- Relative/absolute time presentation should remain locale-aware and readable at high zoom.
- Privacy settings and block state from the backend remain authoritative; the UI must never infer visibility from screenshot parity.

### 3. Text and media are one content block

The captures include both text-led and media-rich states. Media is important but should not displace the post text or author context. ELGL's current image grid and lightbox are therefore the correct product direction: compact media in-feed, progressive disclosure for full-screen inspection.

ELGL-specific constraints:

- Media URLs continue through the existing safe URL handling rather than accepting arbitrary schemes.
- Images require meaningful alternative text where a description exists and a sensible fallback otherwise.
- Full-resolution assets should load only when requested; the feed must not eagerly inflate every image into a full-screen representation.
- Broken media must degrade inside the card without making the rest of the Moment unusable.

### 4. Social actions sit after content and expose state

The reference corpus treats reactions and discussion as consequences of the Moment content, not as primary navigation. Like, comment, social-proof/liked-by, share/copy, and reporting controls should remain after the body/media and should expose current state rather than relying on icon colour alone.

Current ELGL behavior already aligns with this shape:

- optimistic like/comment mutations provide immediate feedback while preserving server reconciliation;
- the Liked By affordance has a dedicated dialog flow;
- sharing/copying is separate from destructive/report actions;
- report actions use the central content-report flow rather than a Moments-only moderation path.

### 5. Discussion remains subordinate but directly reachable

The later reference states devote more space to comments/replies while preserving the originating Moment context. ELGL should keep inline discussion close to the card and allow a detail route or dialog to expand it without losing the parent post identity.

Discussion requirements:

- loading, empty, failed, and retry states must be explicit;
- comments must use stable IDs and server ordering, not DOM position, as identity;
- optimistic comments must reconcile or roll back deterministically;
- blocked/deleted/private content must fail closed and disappear rather than leaving a stale cached discussion;
- keyboard focus must move predictably when a discussion surface opens/closes.

### 6. Filters are feed lenses, not separate feeds

The reference material supports a lightweight content-switching mental model. ELGL's Popular/Latest controls and search field should keep a single feed surface and update its query state. A filter change must not silently combine stale results from the prior mode.

`moments-feed.component.ts` already protects this with request-state handling and bounded pagination. Future feed lenses should reuse that path rather than creating independent unbounded client-side collections.

## Parity matrix

| Reference behavior | ELGL implementation | Decision |
| --- | --- | --- |
| Author identity leads each content unit | Moments feed card header/profile route | Preserve |
| Timestamp/context is visible before actions | Card metadata | Preserve, locale-aware |
| Text and attached media read as one post | Moment body + image grid | Preserve |
| Media can receive focused inspection | Existing lightbox flow | Preserve; no exact source-product chrome |
| Reactions follow content | Like/comment/social-proof action row | Preserve |
| Discussion expands around a parent Moment | Inline/detail discussion paths | Preserve |
| Social proof can reveal the liker set | Liked By dialog | Preserve with access/block filtering |
| Feed can be re-ordered/filtered | Popular/Latest/search toolbar | Preserve as one query surface |
| User safety actions remain reachable | Shared report flow | Preserve; moderation is authoritative server-side |
| Source-product colours, typography and exact geometry | Relay tokens + Spartan primitives | Intentionally diverge |
| Source-product branding/trade dress | ELGL product identity | Do not copy |

## Accessibility and responsive contract

Screenshot parity never overrides accessibility. All Moments work must continue to satisfy the repository's frontend contract:

- keyboard-operable interactive controls with visible focus states;
- semantic buttons/links rather than clickable containers;
- accessible names for icon-only controls and status changes announced where appropriate;
- no information encoded by colour alone;
- layouts that reflow at narrow widths and at browser zoom rather than requiring horizontal page scrolling;
- touch targets large enough for mobile use;
- light/dark theme support using semantic tokens;
- user accent colour only through the supported accent token path.

## Privacy and security contract

The reference captures are visual evidence only. They must never become an authorization source. Moments APIs and database policies remain responsible for visibility, blocking, ownership, reporting, and social-graph access.

Do not introduce screenshot-derived sample names, profile photos, post bodies, comments, or other potentially personal content into fixtures. Tests should use synthetic identities/content. Do not log Moment text, comment text, or private media URLs solely to debug visual parity.

## Performance and failure behavior

The screenshots describe presentation, not an excuse to reproduce source-product network behavior. ELGL keeps the following production constraints:

- bounded page sizes and bounded rendered Moment counts;
- stale-request protection when search/filter mode changes;
- lazy/progressive media behavior where possible;
- no client-side fetch of an entire social graph for filtering;
- retryable, localized failure surfaces rather than silent empty feeds;
- one failed image, translation, share operation, or secondary social action must not make the whole feed unavailable.

## Change boundaries

This analysis intentionally does not duplicate work already represented by dedicated Moments features. Full-screen image navigation, Liked By behavior, grammar review, translation, moderation, and creation flows should continue to evolve in their own components/issues. A future visual-parity change should cite the relevant row/pattern from this document and still pass the Relay/Spartan design-system checks.

## Verification

Run from the repository root:

```bash
npm run check:moments-reference-analysis
```

The check performs two contracts:

1. every PNG in `original-hello-talk-screenshots/` must be represented in this document and no removed PNG may remain referenced;
2. byte-identical aliases must be listed on the same inventory row so duplicate screenshots cannot inflate the number of observed product states.

The script's unit tests also exercise missing assets, stale references, and split duplicate aliases.

## Rollout and rollback

This change has no runtime or database rollout. It adds a design/reference contract to repository verification. If the screenshot corpus is intentionally changed, update this analysis in the same PR so reviewers can see how the evidence set changed.

Rollback is a normal revert of the documentation/check commit. Do not delete or rewrite reference screenshots merely to make the check pass; asset changes should be explicit and reviewable.
