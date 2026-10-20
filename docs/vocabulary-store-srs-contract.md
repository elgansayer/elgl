# Vocabulary store SRS contract

Issue #973 is implemented by `frontend/src/app/services/vocabulary.store.ts`.

## State ownership

`VocabularyStore` is an application-wide Angular service backed by writable signals. Its canonical token lookup is `flashcardMap`, a `Map<string, Flashcard>` keyed by a lower-case word token. `allFlashcards` and `dueReviews` are separate signals for list and review-session consumers.

The store owns client-side vocabulary state. The backend remains authoritative for persisted flashcards and SRS scheduling; successful API responses are sanitised before they enter the signals.

## Word-state mapping

`getWordStatus()` is the presentation contract used by tokenised learning surfaces:

| SRS state | Meaning | Relay treatment |
| --- | --- | --- |
| no flashcard | new word, level 0 | secondary accent |
| 1, 2, 3 | learning | warning accent |
| 4 or greater | known | normal primary text |

Lookups trim surrounding whitespace and compare case-insensitively. The returned `flashcard` remains the original typed record so consumers can open the correct SRS item without a second lookup.

Both `colourClass` and the legacy `colorClass` alias currently expose the same class string. New code should prefer the British-English `colourClass` name; the alias remains for compatibility until consumers are migrated.

## Accessibility

Colour is presentation, not the data model. Consumers must not communicate vocabulary state only by colour. Accessible names, text, context menus, or other semantic state remain the responsibility of the rendering component.

The store returns Relay semantic token classes rather than fixed hexadecimal colours, preserving light/dark theme and user accent compatibility.

## Failure and privacy boundaries

The store attaches the authenticated access token only to the existing API requests. User vocabulary, translations, definitions, and review history must not be written to normal diagnostic logs. Offline fallback is limited to the user-owned SRS cache.

The level mapping itself is pure and performs no network, storage, analytics, or navigation side effects.

## Verification

`vocabulary.store.srs-contract.spec.ts` locks the issue contract by verifying:

- `flashcardMap` is signal-owned and reacts to map replacement/update;
- unknown tokens map to level 0;
- levels 1, 2, and 3 map to the learning treatment;
- level 4 maps to the known-word treatment;
- lookups are case-insensitive and trim surrounding whitespace;
- list and due-review collections remain independently writable signals;
- the compatibility `colorClass` alias matches `colourClass`.

The existing broader `vocabulary.store.spec.ts` continues to cover loading, persistence, SRS updates, offline behavior, NLP calls, and haptic feedback.

## Rollout and rollback

This completion change adds regression coverage and documentation only. It does not change API, schema, persisted SRS values, or runtime styling. Rollback is a normal revert of the test/documentation commit.
