1. **Optimize Event Service `getEvent` method in `backend/src/events/events.service.ts`**
   - The current implementation sequentially awaits `attendingCount` and `interestedCount` queries for the event, resulting in a minimum of two unnecessary independent roundtrips when they can be run in parallel.
   - Use `replace_with_git_merge_diff` to modify `backend/src/events/events.service.ts` and replace the sequential `attendingCount` and `interestedCount` queries with a concurrent `Promise.all` execution.
2. **Verify changes by running backend tests**
   - Execute `npm run test` from the repository root to verify that the refactored code passes existing tests. Note that we must ignore tests that were already failing prior to our changes and verify that only our specific file's tests pass. We will run `cd backend && npx vitest run src/events/events.service.spec.ts` for our check. The failure in `createRsvp` is unrelated to `getEvent` and was pre-existing.
3. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
4. **Submit the change**
   - Submit with title "⚡ Bolt: [optimize event rsvp queries]" and a descriptive branch and commit message.
