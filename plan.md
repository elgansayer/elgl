1. **Optimize `createRsvp` in `events.service.ts` to use `upsert`:**
   - Currently, `createRsvp` does a `.delete()` followed by an `.insert()`. This requires two sequential database calls over the network.
   - We can replace this with a single `.upsert()` call using `onConflict: 'event_id, user_id'`.
   - The `event_rsvps` table has a `UNIQUE (event_id, user_id)` constraint, so `upsert` is perfectly suited here to reduce latency and improve database operation efficiency by combining the delete-then-insert into a single atomic upsert operation.

2. **Add a Bolt journal entry:**
   - Add a journal entry to `.jules/bolt.md` documenting this learning about optimizing sequential `delete` then `insert` operations with a single `upsert`.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run tests and lint checks.

4. **Submit PR.**
   - Submit with title "⚡ Bolt: [performance improvement] Optimize RSVP creation via upsert"
