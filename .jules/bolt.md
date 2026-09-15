## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]
**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2026-08-25 - [Batch Supabase Queries with Promise.all]
**Learning:** Independent Supabase query builder `.then()` requests in NestJS services block sequentially, creating N+1 latency across network calls to the Postgres database.
**Action:** When aggregating data across multiple independent tables (e.g., getting counts from `moments`, `moment_comments`, `profile_visits`), gather all configured query builder objects and resolve them concurrently using a single `Promise.all` array.

## 2026-08-28 - [Bound Initial Chat Unread Fetch Concurrency]
**Learning:** Loading room unread counts sequentially creates N+1 latency, while starting every request at once can overload the client and backend for accounts with large room histories.
**Action:** Fetch room messages in bounded `Promise.allSettled()` batches so startup gains parallelism, retains partial results, and caps request fan-out.

## 2026-09-15 - [Track Angular Loops by ID & Use OnPush]
**Learning:** In Angular frontend components with frequent array updates (like real-time chat lists or messages), iterating with `@for (item of items(); track item)` tracks by object reference. When the array is replaced or items are updated immutably, Angular destroys and recreates the DOM elements, causing severe jank. Additionally, without `ChangeDetectionStrategy.OnPush`, Angular checks the entire component tree on every tick. Unawaited async tasks (like `void this.chatService.markMessageStatus`) are inherently non-blocking and do not suffer from sequential N+1 latency, so wrapping them in `Promise.all` is redundant.
**Action:** Always use `track item.id` in `@for` loops to track by unique identifier. Apply `ChangeDetectionStrategy.OnPush` to components using Signals to prevent unnecessary re-renders. Avoid attempting to batch naturally concurrent unawaited operations.
