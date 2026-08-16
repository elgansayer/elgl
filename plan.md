1. **Analyze `backend/src/events/events.service.ts`:**
   - In `checkReminders`, there is a `for...of` loop sequentially awaiting `sendRemindersBatch` for each event:
     ```typescript
     for (const event of typedEvents) {
       const userIds = rsvpsByEventId.get(event.id);
       if (!userIds) continue;
       await this.sendRemindersBatch(event.id, event.title, userIds);
     }
     ```
   - This causes sequential database and API operations across multiple events.

2. **Replace sequential `await` with `Promise.allSettled`:**
   - Change the loop to map over `typedEvents` and run `sendRemindersBatch` concurrently.
   - Using `Promise.allSettled` ensures that if one event's reminders fail, it doesn't block the reminders for other events.
   - Example implementation:
     ```typescript
     // ⚡ Bolt Optimization: Replaced sequential awaits in a for...of loop with a concurrent
     // Promise.allSettled batch to drastically reduce network latency when sending event reminders.
     const reminderPromises = typedEvents.map(async (event) => {
       const userIds = rsvpsByEventId.get(event.id);
       if (!userIds) return;
       await this.sendRemindersBatch(event.id, event.title, userIds);
     });

     await Promise.allSettled(reminderPromises);
     ```

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run linter: `npx eslint --fix backend/src/events/events.service.ts`
   - Run tests: `npm run test -- backend/src/events/events.service.spec.ts`

4. **Submit PR**
   - Title: "⚡ Bolt: [optimize event reminders]"
   - Description: Include what, why, impact, and measurement.
