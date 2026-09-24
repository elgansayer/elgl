## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]
**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2026-08-25 - [Batch Supabase Queries with Promise.all]
**Learning:** Independent Supabase query builder `.then()` requests in NestJS services block sequentially, creating N+1 latency across network calls to the Postgres database.
**Action:** When aggregating data across multiple independent tables (e.g., getting counts from `moments`, `moment_comments`, `profile_visits`), gather all configured query builder objects and resolve them concurrently using a single `Promise.all` array.

## 2026-08-28 - [Bound Initial Chat Unread Fetch Concurrency]
**Learning:** Loading room unread counts sequentially creates N+1 latency, while starting every request at once can overload the client and backend for accounts with large room histories.
**Action:** Fetch room messages in bounded `Promise.allSettled()` batches so startup gains parallelism, retains partial results, and caps request fan-out.

## 2026-09-16 - [Angular Chat Page Performance Optimization]
**Learning:** In the frontend `chat-page.component.ts`, large chat message arrays (where new messages stream in dynamically via Centrifugo and push into the signal array) and long chat room lists cause excessive, repetitive full-list DOM reconstructions when rendered with `@for (item of items; track item)`. Tracking by object reference (`item`) instead of a unique ID forces Angular's differ to re-render nodes unnecessarily on every signal update. Furthermore, without `ChangeDetectionStrategy.OnPush`, global zone events constantly trigger change detection for these heavy lists.
**Action:** When working with frequently updated list items (like real-time chat messages or active chat room rosters), always add `changeDetection: ChangeDetectionStrategy.OnPush` to the `@Component` decorator, and strictly track items by their unique identifier (e.g. `@for (msg of messages(); track msg.id)`) rather than by object reference to prevent widespread DOM recreation overhead.
