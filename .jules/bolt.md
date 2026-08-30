## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]
**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2026-08-25 - [Batch Supabase Queries with Promise.all]
**Learning:** Independent Supabase query builder `.then()` requests in NestJS services block sequentially, creating N+1 latency across network calls to the Postgres database.
**Action:** When aggregating data across multiple independent tables (e.g., getting counts from `moments`, `moment_comments`, `profile_visits`), gather all configured query builder objects and resolve them concurrently using a single `Promise.all` array.

## 2026-08-28 - [Bound Initial Chat Unread Fetch Concurrency]
**Learning:** Loading room unread counts sequentially creates N+1 latency, while starting every request at once can overload the client and backend for accounts with large room histories.
**Action:** Fetch room messages in bounded `Promise.allSettled()` batches so startup gains parallelism, retains partial results, and caps request fan-out.

## 2026-08-30 - [Optimize Archive Cleanup via Promise.allSettled]
**Learning:** In the backend `privacy.service.ts`, iterating through rows of expired archives to sequentially remove objects from Supabase storage and update database statuses (`supabase.storage.from().remove()` and `supabase.from('archive_requests').update()`) inside a `for...of` loop causes additive N+1 latency, significantly delaying GDPR archive cleanup tasks when many archives expire simultaneously. A concurrent map can reduce overall task execution time. However, unbounded Promise.all is unsafe. We should use Promise.allSettled so one failure does not cascade, or if possible Promise.all.
**Action:** Replace sequential storage deletion and database update requests in a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows all API and DB interactions for an expired archive batch to resolve concurrently, drastically reducing execution time for cleanup jobs. (Batch size is already limited to boundedLimit which maxes out at 100 via the SQL limit clause upstream)
