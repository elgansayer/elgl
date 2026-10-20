## 2026-08-24 - [Optimize Offline Reading Cache Articles via Promise.all]
**Learning:** In the frontend `offline-reading.service.ts`, iterating through arrays to sequentially await insertions (`this.putInStore`) and evictions (`this.deleteFromStore`) in `cacheArticles` causes significant, additive delay to the UI thread/local storage interaction. A simple loop adds unnecessary serialization of writes to IndexedDB when caching lists of articles for offline support.
**Action:** Replace single sequential IDB writes inside a `for...of` loop with a single concurrent `Promise.all` batch using `.map`. This allows multiple object store requests to queue effectively in IndexedDB and resolves much faster, keeping offline cache updates snappy and reducing potential stuttering.

## 2024-05-18 - Replacing sequential await with Promise.all in User Profile Fetching
**Learning:** Sequential awaits for fetching related user data (follower/following counts, XP, corrector score) create unnecessary latency during user profile retrieval. The Supabase queries are completely independent and can be fired off concurrently.
**Action:** Found sequentially awaited db queries/service calls in `UsersService.getProfile`. Used `Promise.all` to fetch the counts, xp, and score concurrently, maintaining safe fallbacks utilizing inner `catch` wrappers to ensure partial failures do not crash the entire request.
## 2026-08-25 - [Batch Supabase Queries with Promise.all]
**Learning:** Independent Supabase query builder `.then()` requests in NestJS services block sequentially, creating N+1 latency across network calls to the Postgres database.
**Action:** When aggregating data across multiple independent tables (e.g., getting counts from `moments`, `moment_comments`, `profile_visits`), gather all configured query builder objects and resolve them concurrently using a single `Promise.all` array.

## 2026-08-28 - [Bound Initial Chat Unread Fetch Concurrency]
**Learning:** Loading room unread counts sequentially creates N+1 latency, while starting every request at once can overload the client and backend for accounts with large room histories.
**Action:** Fetch room messages in bounded `Promise.allSettled()` batches so startup gains parallelism, retains partial results, and caps request fan-out.
## 2026-09-18 - [Optimize Chat Component Rendering with OnPush and Object Identity Tracking]
**Learning:** Changing ChangeDetectionStrategy to OnPush in data-heavy components like `ChatPageComponent`, combined with tracking `@for` loop items by their unique identifiers (e.g., `track msg.id` instead of object reference `track msg`), significantly reduces change detection and DOM recreation overhead when the local list of messages updates.
**Action:** Use ChangeDetectionStrategy.OnPush for components that receive frequent reactive updates (e.g. chat messages), and always use unique IDs for list `@for` tracking.

## 2026-09-18 - [Angular OnPush and @for Loop Optimization]
**Learning:** Adding `ChangeDetectionStrategy.OnPush` to components using Signals, alongside updating `@for` loops to track by unique IDs (e.g., `track item.id`) rather than entire object references, significantly reduces unnecessary change detection cycles and DOM re-renders without adding complexity to the codebase.
**Action:** Always prioritize applying `ChangeDetectionStrategy.OnPush` on components displaying dynamic lists, and ensure `@for` loops track by specific unique identifiers to leverage Angular's optimized rendering.


## 2026-09-18 - [Optimize Angular @for loops with explicit track by id]
**Learning:** Tracking items by object reference (e.g., `track room` or `track msg`) instead of unique IDs in Angular's `@for` block can cause unnecessary DOM recreations during state updates.
**Action:** When iterating over objects with unique identifiers (like `id`), always use `track item.id` instead of `track item` to improve rendering performance and minimize change detection overhead.

## 2026-08-30 - [Overlap Independent Bulk Queries in getComments]
**Learning:** `getComments` issues two fixed-count bulk queries after loading comments. Running those independent lookups sequentially adds their network latencies even though neither result depends on the other.
**Action:** Start independent bulk lookups together with `Promise.all` when their combined request load is bounded and partial results are not required.


## 2026-08-30 - [Optimize GDPR Archive Deck Flashcards Fetch with Bounded Concurrency]
**Learning:** In the backend `privacy.service.ts`, sequentially fetching chunks of `deck_flashcards` using `this.fetchPaged` within a `for` loop during GDPR archive creation introduces N+1 latency, prolonging the data collection process. However, simply using an unbounded `Promise.all` over a large number of decks can exhaust database connection pools.
**Action:** Replace the sequential chunk fetching with a bounded concurrency approach (e.g., chunking the array into smaller subsets of 5 concurrent requests) and resolve these subsets using `Promise.all` to balance speed and resource utilisation.

## 2026-09-03 - [Batch Redis Cache Invalidation Queries with Promise.all]
**Learning:** Sequential `deleteByPattern` and `del` requests in NestJS event handlers block sequentially, creating N+1 latency across network calls to the Redis cache database.
**Action:** When performing multiple cache invalidations in a single handler, gather all promises and resolve them concurrently using a single `Promise.all` array.

## 2026-09-07 - [Parallelize Multiple Redis Cache Invalidations in NestJS Services]
**Learning:** Sequential `await` calls for independent `invalidateCache` methods in mutative admin API routes create unnecessary additive latency during actions like blocking or warning users, degrading performance.
**Action:** Group independent, concurrent cache invalidations (e.g., user lists, blocks, login history) into a single `Promise.all` array to execute them in parallel and reduce request roundtrip times.

## 2026-09-08 - [Memoize Chat Message Ownership]

**Learning:** Angular 22 already uses its signal-aware change detection strategy by default, so explicit `OnPush` metadata is redundant. The chat message template reads message ownership repeatedly for layout, colour, bubble-tail, and delivery-state bindings, making that derived value a better optimization target.
**Action:** Keep Angular's framework default and express repeatedly consumed derived template state as a `computed()` signal so it is cached until its signal dependencies change. Remove unused computed values so they do not expand the component's reactive API.

## 2026-09-08 - [Batch Archive Cleanup Queries with Promise.allSettled]

**Learning:** Sequential awaits in GDPR archive cleanup add storage and database latency, while unbounded fan-out can overload Supabase and amplify provider failures.
**Action:** Process archive cleanup in bounded `Promise.allSettled` chunks. Preserve partial progress and report only privacy-safe aggregate failure counts.


## 2026-09-09 - [Redis Invalidation DoS Fix]
**Learning:** This codebase uses Redis cache tags and user lists. Using `redis.keys` with wildcards like `admin:users:list:*` runs blocking `KEYS` command which can freeze the Redis event loop, creating a DoS vulnerability or scaling bottleneck as the key count grows.
**Action:** Always prefer `redis.scan` with `MATCH` using a cursor when invalidating or listing wildcard keys in Redis for scalable cache evictions.

## 2026-09-15 - [Track Angular Loops by ID & Use OnPush]
**Learning:** In Angular frontend components with frequent array updates (like real-time chat lists or messages), iterating with `@for (item of items(); track item)` tracks by object reference. When the array is replaced or items are updated immutably, Angular destroys and recreates the DOM elements, causing severe jank. Additionally, without `ChangeDetectionStrategy.OnPush`, Angular checks the entire component tree on every tick. Unawaited async tasks (like `void this.chatService.markMessageStatus`) are inherently non-blocking and do not suffer from sequential N+1 latency, so wrapping them in `Promise.all` is redundant.
**Action:** Always use `track item.id` in `@for` loops to track by unique identifier. Apply `ChangeDetectionStrategy.OnPush` to components using Signals to prevent unnecessary re-renders. Avoid attempting to batch naturally concurrent unawaited operations.

## 2024-05-18 - Missing Component Tests Force Slower Full Suite Testing
**Learning:** Some heavily integrated UI components (like `chat-view.component.ts`) in this architecture completely lack dedicated unit tests. If you modify them during optimization passes, you cannot rely on targeted `--include` runs and are forced to execute the entire frontend test suite, which can be computationally expensive (90s+).
**Action:** When scoping daily performance improvements in `chat-view`, anticipate a longer verification cycle. Future performance work might benefit from first refactoring and decoupling these heavy components to make localized testing feasible before optimizing their internals.


## 2026-09-19 - [Optimize Angular @for loops with tracking by unique identifier]
**Learning:** In the Angular frontend components (like `frontend/src/app/pages/chat/chat-page.component.ts`), using `@for` with object reference tracking (e.g. `track room` or `track msg`) causes unnecessary DOM recreations during state updates.
**Action:** When optimizing Angular `@for` loops, always track items by their unique identifiers (e.g., `track item.id`) instead of object references to prevent unnecessary DOM re-renders and improve frontend performance.

## 2026-09-19 - Avoid modifying `package-lock.json` unless explicitly resolving local dependencies
**Learning:** Running `npm install` blindly, especially when Node.js versions mismatch (`nvm` not being set up by default), can strip out critical native or optional dependencies (like `sass-embedded`) from `package-lock.json`, breaking the build and introducing massive diff noise.
**Action:** Always prefer `git restore --staged package-lock.json && git checkout package-lock.json` if a lockfile modification was inadvertently made while trying to resolve local missing dependencies or tools. Never commit `package-lock.json` updates without explicit instructions when making purely frontend component changes.

## 2026-08-29 - [Optimize Angular @for loops with track .id]
**Learning:** Tracking whole object references in Angular `@for` loops (e.g., `track msg` or `track room`) causes the framework to recreate DOM elements unnecessarily when the object reference changes (e.g., during state updates like appending a message).
**Action:** Always use unique primitive identifiers like `track item.id` in `@for` loops for collections that update frequently.

## 2026-08-30 - [Optimize Angular @for Loops]
**Learning:** In Angular 17+, using `@for` with `track item` where `item` is an object reference (e.g., `track room` or `track msg`) causes Angular to recreate the DOM nodes if the array is replaced with new object references, even if the actual item IDs are the same. This can lead to significant rendering jank in active views like chat lists or message histories where updates arrive via websockets.
**Action:** Always track by a unique primitive identifier (e.g., `track room.id`) in `@for` loops to preserve DOM state across reference-breaking state updates.

## 2024-05-18 - Centrifugo Status Updates and Angular @for Tracking
**Learning:** Real-time chat apps using Centrifugo for status updates (like delivery/read receipts) mutate the messages array frequently. If Angular's `@for` loop tracks items by object reference (`track msg`), every single real-time update forces a full DOM re-render of the entire chat list, causing severe scroll jank and main thread blocking.
**Action:** Always verify that Angular `@for` loops in high-frequency update scenarios (like chat rooms or websockets) strictly track by a unique scalar identifier (`track msg.id`) rather than the object reference.


## 2026-09-20 - [Batch Supabase Queries with Promise.all in Moderation Service]
**Learning:** Sequential database queries in `analyseUserForDatingBehaviour` create unnecessary N+1 latency, despite being independent queries on `users` and `moments`.
**Action:** Always wrap independent database fetch operations in a single concurrent `Promise.all` batch array, especially when compiling composite data for analysis.

## 2026-09-21 - [Optimize Archive Cleanup via Promise.allSettled]
**Learning:** In the backend `privacy.service.ts` cronjob `purgeExpiredArchives`, sequentially iterating through expired archives and running `await supabase.storage.remove` followed by `await supabase.update` causes N+1 network latency during cleanup tasks.
**Action:** Replace single sequential loop with bounded concurrent chunks using `Promise.allSettled` to improve throughput.


## 2026-09-22 - [Avoid Replacing IndexedDB store.put() Loops with .map()]
**Learning:** Calling `store.put(item)` inside an IndexedDB transaction simply queues the requests synchronously. Replacing a `for...of` loop of `store.put()` calls with `.map()` does not change the concurrency model and actually degrades performance by allocating an unnecessary array of `IDBRequest` objects that are immediately discarded.
**Action:** Retain `for...of` loops for queuing operations inside IndexedDB transactions instead of attempting to "parallelise" them with `.map()`.

## 2026-08-30 - [IDBRequest Overhead in Promise.all]
**Learning:** Calling `store.put(item)` inside an IndexedDB transaction queues the requests synchronously. Replacing a `for...of` loop of `store.put()` calls with `.map()` (to try to use Promise.all) does not make the queueing concurrent. It instead degrades performance by allocating an unnecessary array of IDBRequest objects.
**Action:** Reverted the Promise.all IDB optimization and replaced it with a direct synchronous `for...of` loop executing `store.put()`, wrapping the block in a single Promise resolved by `transaction.oncomplete`.

## 2026-09-23 - [Bound Promise.all when batching API requests]
**Learning:** Replacing sequential `await` loops with unconstrained `Promise.all` mapping can cause race conditions or exceed request rate limits (e.g., Supabase storage removals and database updates inside `purgeExpiredArchives`).
**Action:** When migrating sequential operations to concurrent mapping, enforce concurrency bounds (e.g. `chunkSize = 10`) and process the chunks in a loop before awaiting the next chunk.


## 2026-09-24 - [Optimize User Profile Counters via Promise.all]
**Learning:** Sequential Supabase count queries for `followers` and `following` introduce significant N+1 latency in user profile lookups.
**Action:** Always fetch independent user stat aggregations concurrently via `Promise.all` in NestJS service methods.

## 2026-09-24 - [Batch Redis Cache Invalidations with Promise.all]
**Learning:** Sequential `await` calls to independent cache invalidation methods (like `redis.del()`) create additive network latency when clearing multiple related caches.
**Action:** When invalidating multiple independent cache sets (e.g., `invalidateUserListCaches()`, `invalidateBlocksListCaches()`), group the method calls into a single concurrent `Promise.all` batch to improve execution speed.

## 2024-10-31 - [Batch Cache Invalidation Calls with Promise.all]
**Learning:** Sequential cache invalidation `await` calls in NestJS services block sequentially, creating additive N+1 latency across network calls to Redis.
**Action:** When invalidating multiple independent caches (e.g., user lists, blocks, login history), group all invalidation calls and resolve them concurrently using a single `Promise.all` array.

## 2025-01-24 - Batching independent cache invalidation network calls
**Learning:** Sequential await calls for independent cache invalidation (like Redis deletes) introduce additive network latency.
**Action:** Group independent await cache operations into a single Promise.all batch request to reduce round trip waiting time.


## 2024-09-27 - [Optimize Lifetime Counts by using exact count]
**Learning:** Using `.select('id')` to fetch full rows over the network just to determine their length creates N+1 latency, wastes memory, and causes bottleneck for operations aggregating multiple queries, like fetching stats.
**Action:** When determining the length of rows, use `.select('*', { count: 'exact', head: true })` instead and extract `count` from the response. This asks Supabase for only the headers and row count instead of transferring any body data.

## 2026-09-27 - [Optimize Counting Queries using HEAD requests]
**Learning:** Fetching full rows from a database over a network exclusively to count them using `.length` in Node.js (e.g., `momentsData.length`) scales poorly and creates a massive performance penalty. Supabase supports native counting without returning the payload.
**Action:** Always append `{ count: 'exact', head: true }` to the Supabase `.select()` call when only the total number of records is needed, ensuring the backend receives just the integer count.

## 2026-09-28 - [Optimize Supabase Counts with HEAD Requests]
**Learning:** Using `.select('count(*) as ...')` still forces Supabase/PostgREST to generate a response body wrapping the integer.
**Action:** When only a row count is needed, always use `.select('id', { count: 'exact', head: true })` and read from `response.count` to avoid downloading the payload entirely.


## 2026-09-28 - [Batch Independent Redis Operations]
**Learning:** Sequential `await` calls for independent cache operations (e.g., clearing multiple Redis cache keys in admin controllers) create additive network latency that delays API responses.
**Action:** Identify sequences of independent asynchronous cache or database operations and batch them using `Promise.all` to resolve them concurrently, significantly reducing overall latency.

## 2026-09-29 - [Batch Redis Invalidations using Promise.all]
**Learning:** Sequential `await` calls on independent backend operations, such as calling `this.deletePattern()` iteratively inside a `for...of` loop in a NestJS event handler (like `handleUserDataCleared`), cause additive N+1 network latency against Redis.
**Action:** Replace `for...of` loops performing sequential independent network calls with `.map()` and `Promise.all()` to fire the operations concurrently. This reduces total waiting time to roughly the longest single operation instead of the sum.


## 2026-09-11 - [Start Independent User Statistics Queries Together]
**Learning:** Awaiting the user lookup before starting four independent statistics queries added one avoidable network-latency interval to successful requests.
**Action:** Start the five independent queries in one `Promise.all`. This preserves the query count while removing the separate user-lookup wait from the successful request's critical path.

## 2026-09-15 - [Avoid Redis KEYS in Cache Invalidation]
**Learning:** Using the `KEYS` command in Redis for prefix-based cache invalidation (`deleteByPattern`) blocks the Redis event loop, creating a bottleneck and potential DoS vector as the keyspace grows.
**Action:** Replaced `deleteByPattern` entirely with `deleteByScan` to asynchronously batch fetch and delete matching cache keys, preventing main thread blocking.

## 2026-08-31 - [Batch Archive Cleanup Queries with Promise.allSettled]

**Learning:** Sequential awaits in `for...of` loops during maintenance jobs like `purgeExpiredArchives` create significant N+1 database latency, especially since each loop execution awaits both object storage deletion and database table row updates.
**Action:** Replace sequential awaiting with `Promise.allSettled` over bounded chunks. Inspect every settled result and emit a privacy-safe aggregate failure count so concurrency retains partial progress without hiding provider or database failures.
## 2026-08-29 - Parallelize Profile Fetching in Gift Transaction Broadcast

**Learning:** In the `economy.service.ts` gift transaction logic, fetching sender and receiver profiles sequentially adds latency. Because the reads enrich a broadcast after the gift is committed, a lookup failure must not report that the committed gift failed.
**Action:** Run independent post-commit enrichment reads concurrently with `Promise.allSettled`, retain successful partial results, and keep ancillary failures from changing the transaction outcome.

## Performance Optimizations

- **Date:** 2026-08-06
- **Context:** Resolving N+1 query in `EventsService.checkReminders` (backend)
- **Bottleneck:** Iterating over events and calling `.eq()` for each event RSVP fetch leads to significant database roundtrips (N queries for N events).
- **Optimization Strategy:** Extract all `event_ids` into an array and perform a single batch lookup using the Supabase `.in('event_id', eventIds)` operator. Afterwards, map the results back to the original objects in-memory using a `Map`.
- **Edge Case Addressed:** Before executing `.in()`, always ensure the provided array is not empty (`if (typedEvents.length === 0) return;`) to avoid Supabase API errors with invalid queries.
- **Measured Impact:** Simulated execution time for 1,000 events dropped from ~10,325ms down to ~43ms.

## 2026-08-11 - [Optimize timeline fan-out via Redis pipeline]

**Learning:** In timeline fan-out via Redis, sequentially calling `lpush` and `ltrim` for potentially thousands of followers causes excessive network roundtrips.
**Action:** Replace the iterative `await redis.lpush` operations inside a loop with a batch using `redis.pipeline()`. Group commands with `pipeline.lpush` and `pipeline.ltrim` and execute `await pipeline.exec()` once to drastically reduce network latency.

## 2026-08-11 - [Optimize user data wiping by replacing sequential awaits with Promise.all]

**Learning:** In the backend `data-retention.service.ts`, wiping user data sequentially loops through 28 distinct database queries (deletes and updates) using `await`. In a simulated environment, sequentially awaiting 28 database operations takes ~550-600ms, whereas running them concurrently with `Promise.all` completes in ~20-30ms, mitigating a severe deletion bottleneck.
**Action:** When a service requires bulk independent operations (like GDPR user wipes across many tables), do not await them sequentially. Use `Promise.all` to execute them concurrently to drastically improve network latency, and map over the results to ensure errors aren't swallowed.

## 2026-08-12 - [Optimize GDPR data collection by replacing sequential awaits with Promise.all]

**Learning:** In the backend `privacy.service.ts`, exporting user data (`collectUserData`) sequentially loops through 15-17 distinct database queries using `await supabase`. In a simulated environment with 30ms latency, sequentially awaiting 15 queries takes ~450ms, whereas running them concurrently completes in ~30ms, mitigating a major bottleneck.
**Action:** When a service requires bulk independent operations (like GDPR user wipes OR data exports across many tables), do not await them sequentially. Use `Promise.all` to execute them concurrently to drastically improve network latency, mapping over the results to handle errors appropriately. Be mindful of relational dependencies (e.g. querying a junction table based on fetched IDs), running those specific subqueries sequentially afterward.

## 2026-08-12 - [Supabase N+1 batching within Promise.all]

**Learning:** For NestJS/Supabase queries that must fetch relations iteratively inside a `Promise.all`, we can batch a sequential N+1 bottleneck. If the parent dataset is already mapped, we can extract the IDs, fetch all relations with an `.in()` batch query upfront, and then stitch the dataset in the `map` step. If the relational table is too large for `.in()` counts or groups, retaining the `Promise.all` exclusively for the reduced query surface (e.g., fetching counts) and batching everything else cuts database latency significantly.
**Action:** When inspecting sequential queries, look for `Promise.all` blocks executing multiple queries per item. Split the batchable queries to run before the `Promise.all`, retaining parallel execution only for the queries that fundamentally require it (like exact aggregations).

## 2026-08-12 - [Social Learning Integration]

**Learning:** Implemented a new SocialLearningService to mock generating discussion questions, vocabulary challenges (from user flashcards), and conversation starters, integrated gracefully with Angular signals in the Reading Engine component.
**Action:** Always ensure UI template updates correspond exactly with newly added component logic methods and signals.

## 2026-08-12 - [Optimize user data fetching by replacing sequential awaits with Promise.all]

**Learning:** In the backend `privacy.service.ts`, assembling user data for the GDPR archive export sequentially looped through 15 distinct database queries (selects) using `await`. Running them concurrently with `Promise.all` eliminates the sequential network roundtrips, completing much faster while avoiding the rejection of the entire batch if a single query fails.
**Action:** When a service requires bulk independent operations (like GDPR user archives across many tables), do not await them sequentially. Use `Promise.all` to execute them concurrently to drastically improve network latency, and map over the results to safely extract the data.

## 2026-08-12 - [Optimize Sequential I/O in Loop using Promise.all]

**Learning:** In the backend `chat.service.ts` method `forwardMessage`, checking if room members block a user was done sequentially inside a `for...of` loop with `await`. This causes an N+1 query problem, making latency scale linearly with the number of members in the target room.
**Action:** Replaced the sequential `for...of` loop with a concurrent approach by mapping the array to `Promise.all`. This reduces the latency of checking all members to a single concurrent roundtrip.

## 2026-08-12 - [Optimize achievements evaluation by replacing N sequential lookups with Promise.all and Set]

**Learning:** In the backend `achievements.service.ts`, `evaluateAchievements` executed multiple independent operations sequentially: it fetched the user's message count, fetched their study streak, and then conditionally invoked an additional N sequential database queries for `hasAchievement` against individual milestone strings. This sequential chain, scaling with the number of milestones evaluated, created excessive database latency.
**Action:** When evaluating or assigning multiple flags conditionally against a user, fetch their existing flags/achievements concurrently in one batch using `Promise.all` alongside any necessary prerequisite checks (like stats or counts). Load those flags into an in-memory `Set` to instantly bypass sequential database hits, shifting N sequential network queries to O(1) in-memory checks.

## 2026-08-13 - [Optimize challenge prize distribution using Promise.allSettled]

**Learning:** In the backend `language-challenges.service.ts`, awarding prizes (`addCoins`) to challenge completers sequentially loops through database updates using `await`. Running them concurrently with `Promise.allSettled` eliminates sequential network roundtrips, completing faster. Furthermore, using a type predicate in `.filter((result): result is PromiseRejectedResult => result.status === 'rejected')` is necessary to safely cast `.reason` as an `Error` and satisfy the TypeScript compiler without breaking the build.
**Action:** When replacing sequential `await` operations in a loop with `Promise.allSettled`, ensure you use a type predicate when filtering for rejected promises to satisfy strict TypeScript typings, and maintain the original exception semantics (e.g., throwing a generic `Error` for a 500 status rather than a 400 Bad Request for a server-side failure).

## 2026-08-14 - [Optimize Quests Service Data Processing via Batching and Concurrency]

**Learning:** In the backend `quests.service.ts`, creating default quests (`ensureDefaults`) iterated over standard quests executing sequential queries to check and insert missing items, triggering N+1 roundtrips. Additionally, updating progress for an array of active user quests (`incrementProgress`) executed updates in a sequential `for...of` loop.
**Action:** Replaced sequential query checks and single row inserts in `ensureDefaults` with a single bulk fetch using `.select` followed by calculating differences in memory, culminating in a single bulk `.insert()`. Transformed sequential loop updates in `incrementProgress` into a concurrent execution model mapped over `.map()` resolving via `Promise.allSettled()`. This comprehensively collapses database overhead from O(N) linear time to near O(1) concurrent time for quest management.

## 2026-08-14 - [Optimize Blocked IDs Fetching in Discovery Recommendations]

**Learning:** In `backend/src/discovery/discovery.service.ts`, iterating through user match generation and sequentially calling `safetyService.getBlockedAndBlockerIds` using `await` inside a `for...of` loop causes an N+1 query problem, creating linear scaling latency when generating daily recommendations.
**Action:** Replaced the sequential `await` within the `for...of` loop with a concurrent approach by mapping the array to `Promise.all` and fetching `blockedIds` in parallel. This transforms N sequential queries into 1 concurrent roundtrip block, drastically reducing worst-case latency during discovery matchmaking calculations.

## 2026-08-14 - [Optimize Monetisation Payouts via Promise.allSettled]

**Learning:** In the backend `language-challenges.service.ts`, awarding coins to completers (`claimPrize`) sequentially iterated over a list of users, invoking `monetisationService.addCoins(cid, share)` using `await`. In a benchmark, executing this sequentially for 100 users took ~537ms, while executing it concurrently took only ~6ms.
**Action:** When a service requires bulk independent database or API operations (like awarding coins to multiple challenge winners), replace sequential awaits in loops with concurrent execution via `Promise.allSettled` mapped over the array. This mitigates significant N+1 network/database latency overheads.

## 2026-08-14 - [Optimize System Message Room Discovery via Batching]

**Learning:** In the backend `system-message.service.ts`, finding a 1-on-1 chat room iteratively queried the database inside a loop using `await` for `count`. With 50 mutual rooms and 30ms latency, this causes a 1.5s worst-case bottleneck. Replacing this with a single batch `.in()` query reduces the execution time to 30ms, a 98% improvement.
**Action:** Replaced sequential query checks with a single bulk fetch using `.select` followed by calculating member counts in memory, collapsing database overhead from O(N) linear time to O(1) concurrent time.

## 2026-08-15 - [Optimize Node.js stream iteration using toArray()]

**Learning:** In the backend `media.service.ts`, reading stream body chunks from a Cloudflare R2 / S3 `GetObjectCommand` via an asynchronous `for await...of` loop is significantly slower than parsing it directly. Asynchronous stream iteration has measurable event-loop overhead, which compounds for larger files.
**Action:** When converting a Node.js `Readable` stream to a buffer (especially AWS SDK response bodies), replace `for await (const chunk of stream) { chunks.push(chunk); }` with the native `stream.toArray()` followed by `Buffer.concat()`. This natively aggregates the chunks in internal C++ bindings and resolves substantially faster.

## 2026-08-16 - [Optimize discovery daily recommendations via Promise.all batch map]

**Learning:** In `discovery.service.ts` (`calculateDailyRecommendations`), during the caching phase, we check if recommended match IDs contain blocked users. This operation (`await this.safetyService.getBlockedAndBlockerIds()`) was performed inside a `for...of` loop sequentially over potentially dozens of user entries per unique language pair. This created N consecutive network roundtrips to the safety service, leading to significant delays in a cron job that processes large batch recommendations.
**Action:** Replaced sequential `for...of` `await` calls with a concurrent mapping using `Promise.all` before entering the caching loop. This transforms N sequential lookups into 1 concurrent batch block, dropping latency drastically (e.g. from 1000ms+ down to ~50ms per batch).

## 2026-08-16 - [Optimize language challenge prize distribution]

**Learning:** In the backend `language-challenges.service.ts`, awarding coins to completers (`claimPrize`) sequentially iterates over a list of users invoking `monetisationService.addCoins(cid, share)` using `await` inside a `for...of` loop. In a benchmark simulation, executing this sequentially for 100 users took ~527ms, while executing it concurrently took only 5ms.
**Action:** When awarding coins or processing bulk API operations, replace sequential awaits with concurrent execution via `Promise.allSettled`. Ensure to filter rejected promises with a type predicate `(result): result is PromiseRejectedResult => result.status === 'rejected'` to satisfy TypeScript, and throw the first `.reason` if any rejections occurred to preserve fail-fast error semantics.

## 2026-08-16 - [Optimize event reminders via Promise.allSettled]

**Learning:** In the backend `events.service.ts`, sending push reminders to users (`checkReminders`) sequentially iterated over events invoking `sendRemindersBatch` using `await` inside a `for...of` loop. In a benchmark simulation, executing this sequentially for 100 items took ~1000ms, while executing it concurrently took only 10ms.
**Action:** When dispatching bulk events or notifications, replace sequential awaits with concurrent execution via `Promise.allSettled`. This mitigates significant N+1 network/database latency overheads.

## 2026-08-16 - [Optimize heavy sequential I/O via chunked Promise.all]

**Learning:** When refactoring unbounded sequential background jobs (like Cron tasks deleting users) into concurrent operations, unconditionally pushing hundreds of async I/O operations into `Promise.all` can overwhelm database connection pools and cause timeouts. Additionally, when mapping over results that resolve to success/failure objects (e.g. returning `{success: true}` vs `{success: false}` in catch), the resulting type becomes a generic union unless discriminated explicitly.
**Action:** Always wrap concurrent background operations in bounded chunks (e.g., using `slice()` in a loop). To satisfy TypeScript when mapping to union states, explicitly narrow the boolean values using `as const` (e.g., `success: true as const, error: undefined`) so the compiler successfully resolves the discriminated union.

## 2026-08-17 - [Optimize Achievements Evaluation via Promise.all and Set]

**Learning:** In the backend `achievements.service.ts`, `evaluateAchievements` executed sequentially. It fetched the user's message count and study streak independently via `await`, and then for every relevant achievement threshold it executed a sequential `.hasAchievement()` database lookup. This N+1 scaling (N representing the number of evaluated milestones) caused significant and compounding latency delays within a commonly fired evaluation event. Furthermore, existing mocked tests assumed sequential execution via multiple chained `not.toHaveBeenCalledWith` spy statements for `hasAchievement`, obscuring the actual expected concurrent state flow.
**Action:** Always fetch prerequisites (e.g. counts and streaks) concurrently with the full history of the user's past achievements (`getUserAchievements`) using `Promise.all`. Load those historical achievements into a `Set` to provide synchronous O(1) checks during the evaluation loop instead of sequential database reads. When updating mocked tests, remember to remove the mocked `hasAchievement` spy and instead mock the `user_achievements` database response to provide the correct array for the `Set` builder.

## 2026-08-17 - [Optimize Sequential Account Deletions via Bounded Concurrency]

**Learning:** In the backend `data-retention.service.ts`, finalizing user account deletions (`finaliseAccountDeletions`) looped sequentially through `usersToDelete` executing `wipeUserData` and a table update. Simply changing this to an unbounded `Promise.allSettled` is dangerous and can exhaust database connections when processing dozens of concurrent users.
**Action:** When optimizing long-running cron jobs or batch loops across multiple records, replace sequential iterations with a bounded concurrent approach. Use a `for` loop with `slice(i, i + chunkSize)` (e.g. chunk size 10) and wrap the execution in `Promise.allSettled`. This safely provides concurrent execution benefits without breaking connection pool limits. Ensure the mapped functions catch errors and explicitly narrow return unions (e.g., `success: true as const`) to satisfy TypeScript.

## 2026-08-17 - Recommendation Service Bottleneck (O(n^2) nested maps)

**Learning:** Nested loops where the inner loop does array operations like `filter` and `map` followed by `JSON.stringify` can cause severe performance issues with large datasets.
**Action:** Pre-process inner-loop data structure outside loop. If generating JSON subsets where an item needs to be excluded, map and stringify elements just once, and string-manipulate the full string using `.replace` instead of re-evaluating arrays.

## 2026-08-17 - [Optimize Sequential Updates and Creation via Bulk Operations]

**Learning:** In `backend/src/quests/quests.service.ts`, iterating through arrays to sequentially fetch and insert missing default quests, or update existing active quests (`await supabase.from...update()`), causes significant N+1 network latency. Sequential I/O inside a loop severely degrades API route response times.
**Action:** Replace single sequential reads/inserts in `ensureDefaults` with a single bulk `.select()` followed by an in-memory difference calculation using a `Set`, culminating in one bulk `.insert()`. When updating independent rows inside a loop like `incrementProgress`, replace the sequential `await` operations with a mapped array of promises passed to `Promise.allSettled()` to allow parallel concurrent execution.

## 2026-08-18 - [Optimize Aggregator Loops using Promise.all]

**Learning:** In the backend `metrics` aggregators, sequentially awaiting queries inside a loop significantly degraded aggregation performance.
**Action:** When updating or querying multiple rows based on an array or iterable, use `.map` combined with `Promise.all` to convert a series of N sequential network calls into 1 concurrent block. This will significantly speed up metric aggregations and other loops across the application.

## 2026-08-19 - [Optimize Fan-Out Chat Forwarding via Bulk Array Querying]

**Learning:** In the backend `chat.service.ts`, forwarding a single message to multiple chat rooms (fan-out forwarding) initially verified target memberships and checked room blocklists iteratively using `await` inside a `for...of` loop over `roomIds`. This resulted in N separate sequential `chat_room_members` queries per target room, compounding database roundtrip delays when forwarding to many contacts.
**Action:** Replace single iterative `.eq('room_id')` checks inside loops with a single bulk array lookup via `.in('room_id', validRoomIds)`. Load the results into an in-memory Map structure before iterating the valid target IDs for payload generation. This successfully transforms O(N) sequential queries into an O(1) bulk fetch, reducing network overhead significantly.

## 2026-08-20 - [Optimize Lifetime Counts Query via Promise.all]

**Learning:** In the backend `moments.service.ts`, `getLifetimeCounts` sequentially queried three independent counts (`moments`, `moment_comments`, and `translations`). In an isolated benchmark simulating network delay, fetching these sequentially took ~160ms, whereas fetching them concurrently via `Promise.all` reduced the execution time to ~50ms.
**Action:** When a function requires multiple independent database lookups or calculations, always group them into a single concurrent `Promise.all` operation rather than executing them sequentially to mitigate additive network latency.

## 2026-08-21 - [Optimize Full Achievements Evaluation via Promise.all]

**Learning:** In `backend/src/achievements/achievements.service.ts`, `getFullAchievements` sequentially awaited three database queries (`getUserAchievements`, `getUserMessageCount`, `getStudyStreakDays`). These queries are completely independent. Fetching them sequentially introduces unnecessary additive network latency.
**Action:** When gathering independent data sources or counts for an entity overview, group the asynchronous fetches into a single `Promise.all` structure to execute them concurrently. Use array destructuring matching the exact order of the promises to properly assign the variables.

## 2026-08-22 - [Optimize daily tip generation via Bounded Concurrency]

**Learning:** In the backend `daily-tip.service.ts`, the cron job generating daily tips sequentially awaited LLM API proxy calls (`await this.llmProxyService.proxyMessage()`) in a `for...of` loop over all users. This creates severe and compounding network latency bottlenecks during batch notifications.
**Action:** Replaced sequential API requests with a bounded concurrent approach using `Promise.allSettled` over small chunks (e.g. 10 users). This mitigates N sequential API calls into concurrent batches without overwhelming upstream services or violating rate limits, while preserving fail-safe execution.

## 2026-08-22 - [Optimize sequential cache invalidations via Promise.all]

**Learning:** In `backend/src/admin/admin.service.ts`, methods like `setVipStatus`, `banUser`, and `warnUser` perform sequential `await` calls for independent cache invalidation operations (e.g., `await this.invalidateUserListCaches(); await this.invalidateLoginHistoryCache(...)`). This introduces unnecessary additive network latency.
**Action:** When performing multiple independent cache invalidations, group the `await` calls into a single concurrent `Promise.all` array to execute them concurrently and mitigate network latency.

## 2026-09-30 - Cache Invalidation Latency
**Learning:** Sequential await calls for cache invalidation (like Redis del or pattern scan deletions) add significant network latency, particularly when user actions trigger bulk cache clears across multiple namespaces.
**Action:** Group independent cache invalidation promises and resolve them concurrently using Promise.all to collapse the network roundtrips into a single wait time.

## 2026-08-30 - [Optimize bulk cache invalidations via Promise.all]
**Learning:** In the backend `video-calls-cache-invalidation.service.ts` (and similar invalidation services), iterating sequentially through cache pattern arrays using `await redis.del()` inside a `for...of` loop forces each invalidation to wait for the previous roundtrip. This additive latency drastically degrades performance during bulk resets.
**Action:** Always map pattern arrays into an array of concurrent promises, resolving them together via `Promise.all`. This effectively batches the network calls and minimizes the overall blocking time, ensuring O(1) latency overhead regardless of the pattern count.


## 2024-11-20 - [Optimize sequential cache invalidations via Promise.all]
**Learning:** In the backend admin service, sequential cache invalidations using `await` introduced unnecessary additive network latency.
**Action:** Group independent network operations like cache invalidations into a single `Promise.all` batch to mitigate additive latency.

## 2026-08-25 - [Optimize Chunked Database Inserts via Bounded Promise.allSettled]
**Learning:** In the backend `chat-backup.service.ts`, importing large backups by splitting them into chunks and iterating sequentially with `await` introduces compounding N+1 network latency. Sequential I/O inside a loop degrades performance on large batch jobs. However, blindly wrapping all requests in an unbounded `Promise.all` can overwhelm database connection pools.
**Action:** When inserting large sets of data in chunks, push the chunk insertion promises into an array and execute them using a bounded concurrent approach (e.g., batching into chunks of 10) with `Promise.allSettled` instead of sequentially awaiting each one in a `for` loop. Throw the reason on rejection to maintain error handling logic. Wrap Supabase queries in `Promise.resolve` before attaching `.then` or `.catch` to avoid TS2339 build errors.

## 2024-05-28 - [Optimize Sequential Cache Invalidation via Promise.all]

**Learning:** In the backend `admin.service.ts`, several administrative actions (e.g., `setVipStatus`, `banUser`, `warnUser`) performed cache invalidation by sequentially awaiting multiple independent Redis invalidation methods (like `invalidateUserListCaches` and `invalidateLoginHistoryCache`). Executing these network operations sequentially incurs additive network latency for the API response.
**Action:** Group independent cache invalidations or sequential network operations into a single concurrent `Promise.all` batch fetch to significantly reduce latency and speed up API response times.

## 2024-10-03 - [Optimize Sequential Cache Invalidations via Promise.all]

**Learning:** In the backend `admin.service.ts`, sequential calls to `await this.invalidate...Caches()` were being made at the end of mutation methods (e.g., `setVipStatus`, `banUser`, `warnUser`). These operations independently delete keys from Redis, and executing them sequentially introduces unnecessary additive network latency.
**Action:** When making multiple independent cache invalidation calls or other independent network operations (e.g., `invalidateUserListCaches()`), group the sequential `await` calls into a single `Promise.all` batch fetch to mitigate additive network latency.

## 2026-10-06 - Stream Cancellation Resource Leak
**Learning:** In Node.js `fetch` implementations, calling `response.body.cancel()` sequentially after `response.arrayBuffer()` throws a 'ReadableStream is locked' error. Furthermore, sequential awaits on stream cleanups delay socket reuse.
**Action:** Execute stream cleanups (`arrayBuffer()` and `body.cancel()`) concurrently using `Promise.allSettled()` to prevent the lock error and expedite connection pool release.
## 2026-10-06 - Stream Cancellation Resource Leak
**Learning:** In Node.js `fetch` implementations, calling `response.body.cancel()` sequentially after `response.arrayBuffer()` throws a 'ReadableStream is locked' error. Furthermore, sequential awaits on stream cleanups delay socket reuse.
**Action:** Execute stream cleanups (`arrayBuffer()` and `body.cancel()`) concurrently using `Promise.allSettled()` to prevent the lock error and expedite connection pool release.

## 2026-10-06 - Retry Mechanism N+1 False Positive
**Learning:** Static analysis tools may incorrectly flag sequential HTTP requests inside a `for` loop as an N+1 query performance issue. In the context of an exponential backoff retry mechanism (like `fetchWithExponentialBackoff`), sequential execution is fundamentally required. Converting these requests to execute concurrently with `Promise.all` would break the retry logic and potentially flood the downstream service. Additionally, fully consuming the response body (e.g., via `await response.arrayBuffer()`) on failed requests is critical in Node/Undici to release the socket back to the connection pool for keep-alive; optimizing this away by only calling `.cancel()` can lead to socket exhaustion regressions.
**Action:** Always evaluate the functional context of a loop before attempting to parallelize its I/O operations. For retry loops, prioritize sequential execution and explicit socket cleanup (keep-alive) over static analysis warnings about N+1 queries.


## 2026-10-06 - [Optimize Reading Engine Cache Invalidation via Promise.all]

**Learning:** In the backend `reading-engine-cache.service.ts`, clearing reading engine caches (`handleUserDataCleared`) iteratively over prefixes using `await` inside a `for...of` loop creates N separate sequential cache invalidation calls, which add up to unnecessary delay during user data deletion.
**Action:** Replaced single sequential iterations inside cache invalidation loops with an array lookup via `.map` and grouped them via `Promise.all`. This safely mitigates latency issues when bulk deleting multiple cached items.
## 2026-10-06 - [Optimize Moments feed initialization via Promise.all]

**Learning:** In the backend `moments.service.ts`, the `getFeed` method sequentially awaited `safetyService.getBlockedAndBlockerIds` and `usersService.getProfile`. These two data fetches are independent and awaiting them sequentially introduces unnecessary additive network/database latency during a high-traffic operation.
**Action:** When a method requires multiple independent initialization parameters or lookups, combine them into a single `Promise.all` concurrent call to minimize the total blocking time before executing the core business logic.
## 2024-05-24 - [Replaced sequential safety checks with Promise.all in chat.service.ts]
**Learning:** Found sequential calls to `getBlockedAndBlockerIds` for sender and receiver in both `sendMessage` and `sendContact` functions of `chat.service.ts`. These independent queries cause unnecessary additive network latency.
**Action:** Used `Promise.all` to fetch both `receiverBlockedIds` and `senderBlockedIds` concurrently to optimize the database query execution and reduce wait times.
## 2026-08-25 - [Optimize bulk cache invalidation via Promise.all]
**Learning:** In the backend `reading-engine-cache.service.ts`, the `handleUserDataCleared` event listener sequentially iterated over cache namespaces, invoking `deletePattern` (which scans Redis) using `await` inside a `for...of` loop. This caused N separate sequential roundtrips to Redis during user data deletion, unnecessarily stalling the event loop and compounding network latency.
**Action:** When invalidating multiple independent cache keys or patterns within a single event handler, replace sequential `await` loops with a concurrent `Promise.all` mapping. This groups all Redis deletions into a single concurrent block, significantly reducing execution time.

## 2026-10-07 - [Optimize bulk cache invalidation loops via Promise.all]
**Learning:** In services like `discovery-cache-invalidation.service.ts`, `safety-cache-invalidation.service.ts`, and `video-calls-cache-invalidation.service.ts`, iterating over cache patterns or key prefixes and sequentially executing `redis.del` or `deleteByScan` (using `await` in a `for...of` loop) causes significant additive network latency.
**Action:** Replace sequential `for...of` loops performing independent Redis deletions with concurrent execution using `Promise.all` and `.map()`. Sum the returned deletion counts via `.reduce()` to maintain accurate reporting metrics. This standardizes concurrent execution for Redis teardowns.

## 2026-10-09 - [Optimize bulk cache invalidation via Promise.all mapping]
**Learning:** In backend cache invalidation services (like `safety-cache-invalidation.service.ts` and `video-calls-cache-invalidation.service.ts`), executing Redis `del` or `scan` operations sequentially using `await` inside a `for...of` loop causes unnecessary additive network/database latency. Waiting for one Redis query to resolve before issuing the next severely throttles the event loop during bulk operations.
**Action:** When bulk invalidating caches, replace sequential `await` loops with a concurrent mapping using `Promise.all`. This groups all Redis cache deletions into a single concurrent block, drastically reducing total Round-Trip Time (RTT). Calculate the total deleted keys via `results.reduce((sum, count) => sum + count, 0)`.

## 2026-10-10 - [Optimize discovery cache invalidation via Promise.all]
**Learning:** In the backend `discovery-cache-invalidation.service.ts`, event listeners like `handleUserProfileUpdated` sequentially executed `this.deleteByPattern()` and `this.getRedis().del()` using `await` inside a loop or sequence. Since these deletes are completely independent (matching different cache namespaces or keys), awaiting them sequentially unnecessarily compounded Redis network roundtrip delays, slowing down the processing of high-volume events like profile updates or cache purges.
**Action:** When executing multiple independent cache deletions or invalidations (e.g., across different patterns or namespaces), always wrap the promises in `Promise.all` to execute them concurrently. Furthermore, consolidate multiple exact key deletions into a single variadic `.del(key1, key2, ...)` call to minimize network overhead.

## 2024-05-25 - [Optimize bulk cache invalidation via Promise.all]
**Learning:** In both the `video-calls-cache-invalidation.service.ts` and `safety-cache-invalidation.service.ts` services, cache invalidation methods sequentially iterated over cache patterns invoking `await redis.del()` or `await redis.scan()` inside a `for...of` loop. This causes N separate sequential roundtrips to Redis, unnecessarily stalling the event loop and compounding network latency.
**Action:** When invalidating multiple independent cache keys or patterns, replace sequential `await` loops with a concurrent `Promise.all` mapping. Summing up deleted counts using a `reduce` handles the aggregation efficiently.

## 2026-10-12 - [OnPush Change Detection for List Components]
**Learning:** Components that render lists or are instantiated many times, especially those heavily utilizing Signals (`input()`, `computed()`), can significantly benefit from `ChangeDetectionStrategy.OnPush`. This prevents the framework from checking every instance during default change detection cycles, reducing main thread overhead.
**Action:** Always proactively configure heavily instantiated view components (like chat messages or list items) that rely on static data or signals to use `changeDetection: ChangeDetectionStrategy.OnPush`.

## 2026-10-12 - [Optimize Sequential Cache Invalidations in Discovery, Safety, and Video Calls]
**Learning:** Found sequential cache invalidation loops (e.g. iterating over `SAFETY_AFFECTED_CACHE_PATTERNS`, `VIDEO_CLASSROOM_CACHE_PATTERNS`, and user discovery cache `prefixes`) using `await` in a `for...of` loop in `safety-cache-invalidation.service.ts`, `video-calls-cache-invalidation.service.ts`, and `discovery-cache-invalidation.service.ts`. This causes unnecessary roundtrips to Redis, compounding network latency during bulk invalidations.
**Action:** Replaced these sequential cache invalidations loops with `Promise.all` allowing concurrent invalidations across Redis keys and patterns, dramatically reducing the execution time.

## 2026-10-13 - [Optimize cache invalidation loops via Promise.all]
**Learning:** Found sequential calls to cache invalidations in `video-calls-cache-invalidation.service.ts`, `safety-cache-invalidation.service.ts`, and `discovery-cache-invalidation.service.ts` where Redis scan/delete functions were run iteratively using `await` inside loops.
**Action:** Used `Promise.all` alongside `.map` and `.flatMap` to dispatch all Redis commands concurrently. This reduces network roundtrips and drastically lowers cache invalidation execution time.

## 2026-10-16 - [Optimize bulk cache invalidation loops via Promise.all]

**Learning:** When invalidating many Redis cache keys across several patterns within event handlers (such as in `video-calls-cache-invalidation.service.ts`, `safety-cache-invalidation.service.ts`, and `discovery-cache-invalidation.service.ts`), sequentially looping over prefixes and invoking `await redis.del` or `await this.deleteByScan` transforms parallelizable network I/O into a massive sequential latency bottleneck.
**Action:** When performing bulk cache pattern invalidations, avoid sequential `await` inside a `for...of` loop. Instead, `map()` the patterns to individual delete promises and process them concurrently using `Promise.all(promises)`. This batches N potential Redis roundtrips into a single block of execution latency.

## 2026-10-15 - [Optimize bulk cache invalidation via Promise.all]
**Learning:** In the backend \`safety-cache-invalidation.service.ts\`, the \`invalidateTrustAndSafetyCaches\` method sequentially iterated over cache patterns, invoking Redis deletion methods using \`await\` inside a \`for...of\` loop. This caused N separate sequential roundtrips to Redis during trust and safety cache invalidation, unnecessarily stalling the event loop and compounding network latency.
**Action:** When invalidating multiple independent cache keys or patterns within a single event handler, replace sequential \`await\` loops with a concurrent \`Promise.all\` mapping. This groups all Redis deletions into a single concurrent block, significantly reducing execution time.


## 2026-10-10 - Angular Change Detection Defaults
**Learning:** In this NestJS + Angular architecture, many components that render static data or use signals/observables fall back to default change detection, causing unnecessary main thread overhead during app-wide updates.
**Action:** When inspecting components in the feed or dashboard that only need updates on explicit inputs or signal mutations, proactively isolate their change detection tree by setting `changeDetection: ChangeDetectionStrategy.OnPush`.

## 2026-10-06 - Concurrent Redis Scan/Del for Cache Invalidation
**Learning:** In the video classroom cache invalidation service, we discovered a sequence of sequential `await` operations inside a `for...of` loop mapping over cache patterns. This forced Redis network round trips to block one another unnecessarily when doing `del` and `scan` operations for multiple static prefixes, amplifying total cache invalidation latency.
**Action:** Always map arrays of static cache invalidation patterns or independent I/O commands to an array of Promises and execute them concurrently via `Promise.all` (and aggregate the results with `reduce` if needed).
## 2026-08-25 - [Optimize sequential delete-then-insert with upsert]
**Learning:** In `backend/src/events/events.service.ts`, `createRsvp` first issued a `delete()` to remove any existing RSVP, followed sequentially by an `insert()`. This structure causes two independent roundtrips over the network, compounding database latency on write operations.
**Action:** When a table has a unique constraint covering the targeted identifiers (like `UNIQUE (event_id, user_id)`), replace sequential `delete` and `insert` calls with a single atomic `.upsert()` specifying the constraint fields in `onConflict`. This optimizes both network overhead and database operation efficiency.


## 2026-08-25 - [Optimize bulk cache invalidation via Promise.all]
**Learning:** In the backend `video-calls-cache-invalidation.service.ts`, the `invalidateAllVideoClassroomCaches` method sequentially iterated over cache patterns invoking `deleteByScan` or `redis.del` using `await` inside a `for...of` loop. This caused N separate sequential roundtrips to Redis during bulk cache invalidation, unnecessarily stalling the event loop and compounding network latency.
**Action:** When invalidating multiple independent cache keys or patterns within a method, replace sequential `await` loops with a concurrent `Promise.all` mapping. This groups all Redis deletions into a single concurrent block, significantly reducing execution time.

## 2026-08-26 - [Optimize sequential LLM calls via bounded concurrent chunking]
**Learning:** Generating daily tips iteratively inside a loop causes compounding network delays, particularly when waiting sequentially on the LLM proxy.
**Action:** Replace single sequential awaits in iterative generation jobs with bounded chunks (e.g., slicing by 10) mapped to concurrent promises using Promise.allSettled. This dramatically reduces total execution time without completely exhausting concurrent LLM request limits.
## 2024-05-25 - [Optimize frontend component change detection strategy]
**Learning:** The Angular frontend relies extensively on highly reactive signals and observables for components, but many components (e.g. ChatSystemBubbleComponent) lacked the `changeDetection: ChangeDetectionStrategy.OnPush` setting. This causes the main thread to constantly evaluate and re-render static signal data on every DOM event globally across the Angular change detection tree, incurring high unnecessary overhead for performance-sensitive UI components like chat bubbles.
**Action:** When creating or maintaining structural and UI rendering components in Angular that consume static inputs or Signals exclusively, proactively set `changeDetection: ChangeDetectionStrategy.OnPush` within the `@Component` decorator to isolate them from default global change detection.

## 2026-08-25 - [Optimize bulk LLM generation via bounded concurrent Promise.allSettled chunking]

**Learning:** In the backend `daily-tip.service.ts`, the cron job generating daily learning tips (`generateDailyTips`) used a sequential `for...of` loop with `await` to iteratively query the external LLM provider (`llmProxyService.proxyMessage`). The sequential execution of network calls for large datasets compounds latency to O(N) limits, causing severe performance bottlenecks during the daily scheduled generation window. Attempting unbounded `Promise.allSettled` execution runs the risk of exhausting external API concurrent request limits.
**Action:** When making bulk external API calls (e.g. LLM prompts) across numerous rows, implement a bounded chunking approach (e.g., slicing an array into chunks of 10) mapped into a concurrent `Promise.allSettled` execution block within an outer `for` loop. This drastically speeds up processing time while maintaining safe rate-limited bounds.

**Learning:** Found multiple Angular components rendering static or signal-driven data that were missing `changeDetection: ChangeDetectionStrategy.OnPush`. Without this strategy, Angular performs unnecessary main-thread change detection cycles, reducing application responsiveness and performance.
**Action:** Proactively configure Angular components that render static data or rely entirely on signals/observables to use `ChangeDetectionStrategy.OnPush` to minimize main thread change detection overhead.

## 2026-10-16 - [Optimize Main Thread Render via ChangeDetectionStrategy.OnPush]
**Learning:** Found multiple Angular components rendering static or signal-driven data that were missing `changeDetection: ChangeDetectionStrategy.OnPush`. Without this strategy, Angular performs unnecessary main-thread change detection cycles, reducing application responsiveness and performance.
**Action:** Proactively configure Angular components that render static data or rely entirely on signals/observables to use `ChangeDetectionStrategy.OnPush` to minimize main thread change detection overhead.

## 2026-08-25 - [Optimize bulk cache invalidation via Promise.all]
**Learning:** In the backend `safety-cache-invalidation.service.ts` and `video-calls-cache-invalidation.service.ts`, the `invalidateTrustAndSafetyCaches` and `invalidateAllVideoClassroomCaches` methods sequentially iterated over cache namespaces, invoking Redis commands (like `deleteByScan` or `del`) using `await` inside a `for...of` loop. This caused N separate sequential roundtrips to Redis during invalidation, unnecessarily stalling the event loop and compounding network latency.
**Action:** When invalidating multiple independent cache keys or patterns within a single method, replace sequential `await` loops with a concurrent `Promise.all` mapping. This groups all Redis deletions into a single concurrent block, significantly reducing execution time.

## 2026-10-17 - [Optimize main thread via OnPush change detection]
**Learning:** In the Angular frontend, proactively configure components that render static data or rely entirely on signals/observables to use `changeDetection: ChangeDetectionStrategy.OnPush`. Many structural or stateless components currently default to the default change detection strategy, leading to unnecessary main thread checks during heavy user interaction.
**Action:** When creating or reviewing Angular components that use `signal`s or `computed` exclusively for reactive state, add `changeDetection: ChangeDetectionStrategy.OnPush` to their `@Component` decorator to reduce change detection overhead.

## 2026-10-18 - [Optimize bulk cache invalidation via Promise.all mapping]

**Learning:** In the backend `video-calls-cache-invalidation.service.ts`, `invalidateAllVideoClassroomCaches` and `invalidateRoomCaches` sequentially awaited `deleteByScan` and `del` operations in loops. These calls were independent but incurred additive network latency when executed sequentially.
**Action:** When performing multiple independent cache deletions or scans, group the promises using array maps and pass them into `Promise.all` (or `Promise.allSettled`) to reduce total execution time from O(N) database roundtrips to an O(1) concurrent batch block. Ensure to sum up the resulting deletion counts after concurrent resolution.


















































