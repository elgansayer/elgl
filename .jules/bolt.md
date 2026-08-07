## Performance Optimizations
- **Date:** 2026-08-06
- **Context:** Resolving N+1 query in `EventsService.checkReminders` (backend)
- **Bottleneck:** Iterating over events and calling `.eq()` for each event RSVP fetch leads to significant database roundtrips (N queries for N events).
- **Optimization Strategy:** Extract all `event_ids` into an array and perform a single batch lookup using the Supabase `.in('event_id', eventIds)` operator. Afterwards, map the results back to the original objects in-memory using a `Map`.
- **Edge Case Addressed:** Before executing `.in()`, always ensure the provided array is not empty (`if (typedEvents.length === 0) return;`) to avoid Supabase API errors with invalid queries.
- **Measured Impact:** Simulated execution time for 1,000 events dropped from ~10,325ms down to ~43ms.

## 2026-08-06 - N+1 Optimization on Frequently Triggered Event Listeners
**Learning:** In the `evaluateAchievements` function, iterating through multiple achievement checks (`hasAchievement`) resulted in an N+1 query issue for every `message.sent` event trigger. Each milestone check ran a `select` call over the network independently, severely impacting the hot path when lots of messages were sent.
**Action:** Instead of querying existence independently via `hasAchievement`, always retrieve all earned achievements up front and populate a Javascript `Set` (`const earnedCodes = new Set(...)`). Then conditionally execute additional counting functions like `getUserMessageCount` only if unearned achievements still remain, effectively reducing multiple independent queries down to a single constant query for max-tier users.
