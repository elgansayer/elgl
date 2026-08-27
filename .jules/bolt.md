## 2026-08-27 - Batch Expired Archive Removals
**Learning:** Sequential `await` in loops over database or storage calls incurs significant additive network latency.
**Action:** When updating or removing multiple records iteratively (e.g., in `purgeExpiredArchives`), use `Promise.allSettled` to execute them concurrently, reducing total execution time.

## 2026-08-27 - Bounded Batch Expired Archive Removals
**Learning:** Sequential `await` in loops over database or storage calls incurs significant additive network latency.
**Action:** When updating or removing multiple records iteratively (e.g., in `purgeExpiredArchives`), use `Promise.allSettled` to execute them concurrently, reducing total execution time.
