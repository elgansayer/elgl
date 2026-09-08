## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]

**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2026-08-25 - [Batch Supabase Queries with Promise.all]

**Learning:** Independent Supabase query builder `.then()` requests in NestJS services block sequentially, creating N+1 latency across network calls to the Postgres database.
**Action:** When aggregating data across multiple independent tables (e.g., getting counts from `moments`, `moment_comments`, `profile_visits`), gather all configured query builder objects and resolve them concurrently using a single `Promise.all` array.

## 2026-08-28 - [Bound Initial Chat Unread Fetch Concurrency]

**Learning:** Loading room unread counts sequentially creates N+1 latency, while starting every request at once can overload the client and backend for accounts with large room histories.
**Action:** Fetch room messages in bounded `Promise.allSettled()` batches so startup gains parallelism, retains partial results, and caps request fan-out.

## 2026-09-08 - [Memoize Chat Message Ownership]

**Learning:** Angular 22 already uses its signal-aware change detection strategy by default, so explicit `OnPush` metadata is redundant. The chat message template reads message ownership repeatedly for layout, colour, bubble-tail, and delivery-state bindings, making that derived value a better optimization target.
**Action:** Keep Angular's framework default and express repeatedly consumed derived template state as a `computed()` signal so it is cached until its signal dependencies change. Remove unused computed values so they do not expand the component's reactive API.
