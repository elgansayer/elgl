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
## 2026-08-12 - [Optimize Sequential I/O in Loop using Promise.all]
**Learning:** In the backend `chat.service.ts` method `forwardMessage`, checking if room members block a user was done sequentially inside a `for...of` loop with `await`. This causes an N+1 query problem, making latency scale linearly with the number of members in the target room.
**Action:** Replaced the sequential `for...of` loop with a concurrent approach by mapping the array to `Promise.all`. This reduces the latency of checking all members to a single concurrent roundtrip.
