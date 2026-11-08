# Hobby tags and target vocabulary

## Runtime contract

The Angular hobby-tag surface reads and mutates data only through the NestJS `/api/hobby-tags` API. It never reads Supabase directly and never substitutes browser-only mock state when an API request fails.

The catalogue request accepts an optional exact `category` filter and is capped at 100 ordered records. Authenticated users can add or remove a catalogue tag, set proficiency from 0 to 3, and request vocabulary for a bounded language code. Repeating an add returns the existing selection, including after a concurrent unique-constraint race. Repeating a removal is safe because deletion is scoped by both user and tag. The `(user_id, hobby_tag_id)` database constraint prevents duplicate selections.

Vocabulary is selected from each chosen tag's `target_vocabulary` JSONB value for the requested language. When a known base-vocabulary tag has no cached translation, the backend performs one batched translation request, returns the mapped words, and caches only provider-confirmed translations. If the provider is unavailable, source words remain usable for that response but are not persisted as false translations. Missing tags, malformed vocabulary entries and tags without a base vocabulary are skipped rather than exposed as malformed client data.

## State and failure behaviour

- Initial loading is announced with `aria-live` and mutation controls remain disabled.
- A catalogue, selection or vocabulary read failure replaces empty-state messaging with a retryable unavailable state.
- Mutations are single-flight in the component. A failed mutation shows a translated retry message and reloads server state, so partial success is reconciled without inventing local success.
- Authentication and validation failures remain HTTP failures. The frontend does not convert them into mock tags or vocabulary.
- An empty successful response renders the normal empty state.

The API validates UUIDs, proficiency bounds, language-code shape, catalogue bounds and trimmed tag fields before database access. The global NestJS throttler applies to catalogue creation and user mutations. Catalogue reads are public; user selections and vocabulary remain protected by `SupabaseAuthGuard`.

## Persistence and operations

`public.hobby_tags` owns catalogue metadata and target vocabulary. `public.user_hobby_tags` owns user selection and proficiency, cascades on user or tag deletion, and has indexes for both foreign-key query paths. Existing migrations remain authoritative; this completion requires no schema migration or data backfill.

NestJS request logging and the existing hobby-tag translation warnings diagnose database, provider and cache failures without logging credentials or user-authored private content. Browser users receive translated generic errors rather than provider details.

Deploy backend validation and response changes before or with the frontend. Mixed versions remain compatible because the route shapes are unchanged and deletion now returns the success shape the existing client already declared. Rollback is a normal application revert. No persisted data needs removal, and the existing additive tables and indexes must remain in place.
