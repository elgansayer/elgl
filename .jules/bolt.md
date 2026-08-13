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

## 2026-08-11 - [Optimize user data wiping by replacing sequential awaits with Promise.allSettled]
**Learning:** In the backend `data-retention.service.ts`, wiping user data sequentially loops through 28 distinct database queries (deletes and updates) using `await`. In a simulated environment, sequentially awaiting 28 database operations takes ~550-600ms, whereas running them concurrently with `Promise.allSettled` completes in ~20-30ms, mitigating a severe deletion bottleneck.
**Action:** When a service requires bulk independent operations (like GDPR user wipes across many tables), do not await them sequentially. Use `Promise.allSettled` to execute them concurrently to drastically improve network latency, and map over the results to ensure errors aren't swallowed.

## 2026-08-12 - [Optimize GDPR data collection by replacing sequential awaits with Promise.allSettled]
**Learning:** In the backend `privacy.service.ts`, exporting user data (`collectUserData`) sequentially loops through 15-17 distinct database queries using `await supabase`. In a simulated environment with 30ms latency, sequentially awaiting 15 queries takes ~450ms, whereas running them concurrently completes in ~30ms, mitigating a major bottleneck.
**Action:** When a service requires bulk independent operations (like GDPR user wipes OR data exports across many tables), do not await them sequentially. Use `Promise.allSettled` to execute them concurrently to drastically improve network latency, mapping over the results to handle errors appropriately. Be mindful of relational dependencies (e.g. querying a junction table based on fetched IDs), running those specific subqueries sequentially afterward.
## 2026-08-12 - [Supabase N+1 batching within Promise.all]
**Learning:** For NestJS/Supabase queries that must fetch relations iteratively inside a \`Promise.all\`, we can batch a sequential N+1 bottleneck. If the parent dataset is already mapped, we can extract the IDs, fetch all relations with an \`.in()\` batch query upfront, and then stitch the dataset in the \`map\` step. If the relational table is too large for \`.in()\` counts or groups, retaining the \`Promise.all\` exclusively for the reduced query surface (e.g., fetching counts) and batching everything else cuts database latency significantly.
**Action:** When inspecting sequential queries, look for \`Promise.all\` blocks executing multiple queries per item. Split the batchable queries to run before the \`Promise.all\`, retaining parallel execution only for the queries that fundamentally require it (like exact aggregations).

## 2026-08-12 - [Social Learning Integration]
**Learning:** Implemented a new SocialLearningService to mock generating discussion questions, vocabulary challenges (from user flashcards), and conversation starters, integrated gracefully with Angular signals in the Reading Engine component.
**Action:** Always ensure UI template updates correspond exactly with newly added component logic methods and signals.
## 2026-08-12 - [Optimize user data fetching by replacing sequential awaits with Promise.allSettled]
**Learning:** In the backend `privacy.service.ts`, assembling user data for the GDPR archive export sequentially looped through 15 distinct database queries (selects) using `await`. Running them concurrently with `Promise.allSettled` eliminates the sequential network roundtrips, completing much faster while avoiding the rejection of the entire batch if a single query fails.
**Action:** When a service requires bulk independent operations (like GDPR user archives across many tables), do not await them sequentially. Use `Promise.allSettled` to execute them concurrently to drastically improve network latency, and map over the results to safely extract the data.
## 2026-08-12 - [Optimize Sequential I/O in Loop using Promise.all]
**Learning:** In the backend `chat.service.ts` method `forwardMessage`, checking if room members block a user was done sequentially inside a `for...of` loop with `await`. This causes an N+1 query problem, making latency scale linearly with the number of members in the target room.
**Action:** Replaced the sequential `for...of` loop with a concurrent approach by mapping the array to `Promise.all`. This reduces the latency of checking all members to a single concurrent roundtrip.

## 2026-08-13 - [Optimize challenge prize distribution using Promise.allSettled]
**Learning:** In the backend `language-challenges.service.ts`, awarding prizes (`addCoins`) to challenge completers sequentially loops through database updates using `await`. Running them concurrently with `Promise.allSettled` eliminates sequential network roundtrips, completing faster. Furthermore, using a type predicate in `.filter((result): result is PromiseRejectedResult => result.status === 'rejected')` is necessary to safely cast `.reason` as an `Error` and satisfy the TypeScript compiler without breaking the build.
**Action:** When replacing sequential `await` operations in a loop with `Promise.allSettled`, ensure you use a type predicate when filtering for rejected promises to satisfy strict TypeScript typings, and maintain the original exception semantics (e.g., throwing a generic `Error` for a 500 status rather than a 400 Bad Request for a server-side failure).
## 2026-08-14 - [Optimize Quests Service Data Processing via Batching and Concurrency]
**Learning:** In the backend `quests.service.ts`, creating default quests (`ensureDefaults`) iterated over standard quests executing sequential queries to check and insert missing items, triggering N+1 roundtrips. Additionally, updating progress for an array of active user quests (`incrementProgress`) executed updates in a sequential `for...of` loop.
**Action:** Replaced sequential query checks and single row inserts in `ensureDefaults` with a single bulk fetch using `.select` followed by calculating differences in memory, culminating in a single bulk `.insert()`. Transformed sequential loop updates in `incrementProgress` into a concurrent execution model mapped over `.map()` resolving via `Promise.allSettled()`. This comprehensively collapses database overhead from O(N) linear time to near O(1) concurrent time for quest management.
