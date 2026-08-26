## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]
**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2024-05-18 - Replacing sequential await with Promise.all in User Profile Fetching
**Learning:** Sequential awaits for fetching related user data (follower/following counts, XP, corrector score) create unnecessary latency during user profile retrieval. The Supabase queries are completely independent and can be fired off concurrently.
**Action:** Found sequentially awaited db queries/service calls in `UsersService.getProfile`. Used `Promise.all` to fetch the counts, xp, and score concurrently, maintaining safe fallbacks utilizing inner `catch` wrappers to ensure partial failures do not crash the entire request.
