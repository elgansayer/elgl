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

## 2026-08-20 - [Avoid Silent Error Swallowing with Promise.allSettled]
**Learning:** When using `Promise.allSettled` to execute concurrent tasks (like database inserts or remote service calls in `chat.service.ts`), simply awaiting the call without capturing the result completely swallows any `PromiseRejectedResult`. This leads to silent failures in production, meaning failed network requests, blocked exceptions, or connection timeouts will not propagate or alert the system, leading to code review rejection.
**Action:** When utilizing `Promise.allSettled` for concurrent execution, always capture and inspect the returned array of results. Explicitly filter for and handle rejections (e.g., by throwing the first `.reason` or logging aggressively) to preserve system visibility and prevent silent error swallowing.

## 2026-08-21 - [Optimize full achievements lookup via Promise.all]

**Learning:** In the backend `achievements.service.ts`, `getFullAchievements` executed three independent queries sequentially: `getUserAchievements`, `getUserMessageCount`, and `getStudyStreakDays`. In an isolated benchmark simulating network delay, fetching these sequentially takes more time, whereas fetching them concurrently reduces the execution time.
**Action:** When a function requires multiple independent database lookups or calculations, always group them into a single concurrent `Promise.all` operation rather than executing them sequentially to mitigate additive network latency.

## 2024-05-24 - [Replaced sequential safety checks with Promise.all in chat.service.ts]
**Learning:** Found sequential calls to `getBlockedAndBlockerIds` for sender and receiver in both `sendMessage` and `sendContact` functions of `chat.service.ts`. These independent queries cause unnecessary additive network latency.
**Action:** Used `Promise.all` to fetch both `receiverBlockedIds` and `senderBlockedIds` concurrently to optimize the database query execution and reduce wait times.
