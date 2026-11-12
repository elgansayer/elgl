/**
 * Redis keys owned by the daily partner recommendation job.
 *
 * Both live outside the `recommendations:daily:` cache prefix on purpose: the
 * cache invalidation sweeps delete, and the metrics SCAN counts, every key
 * under that prefix, so a control key there would be dropped or miscounted.
 */

/** Single-flight lock; expires on its own if the holder dies. */
export const DAILY_RECOMMENDATIONS_LOCK_KEY = 'jobs:recommendations:daily:lock';

/**
 * Unix seconds of the last run that refreshed the cache (success or partial).
 * Kept in Redis, not in process memory, so replicas and restarts agree and the
 * metrics aggregator can publish a staleness signal that survives a deploy.
 */
export const DAILY_RECOMMENDATIONS_LAST_COMPLETED_KEY =
  'jobs:recommendations:daily:last-completed';
