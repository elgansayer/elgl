## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]
**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2026-08-25 - [Batch Supabase Queries with Promise.all]
**Learning:** Independent Supabase query builder `.then()` requests in NestJS services block sequentially, creating N+1 latency across network calls to the Postgres database.
**Action:** When aggregating data across multiple independent tables (e.g., getting counts from `moments`, `moment_comments`, `profile_visits`), gather all configured query builder objects and resolve them concurrently using a single `Promise.all` array.

## 2026-08-28 - [Bound Initial Chat Unread Fetch Concurrency]
**Learning:** Loading room unread counts sequentially creates N+1 latency, while starting every request at once can overload the client and backend for accounts with large room histories.
**Action:** Fetch room messages in bounded `Promise.allSettled()` batches so startup gains parallelism, retains partial results, and caps request fan-out.
## 2026-09-16 - Prevent package-lock.json drift on minor edits
**Learning:** Running `npm install` just to fetch tools like `ng` or `@angular/cli` on a minor UI change can catastrophically alter `package-lock.json` and strip critical build dependencies if the sandbox Node environment differs slightly from what generated the lock file.
**Action:** When asked to make small component optimizations without explicitly modifying dependencies, do not run `npm install`. Use `npx` with precise tools, or if a global tool requires an updated node via `nvm`, do not subsequently run `npm install` on the whole project unless instructed, or ensure to `git restore package-lock.json` before committing.
