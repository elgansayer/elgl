/**
 * Bounds for the Moments `For You` pipeline (retrieval, ranking and hydration).
 *
 * Every stage is capped so a request has a fixed worst-case cost that does not
 * grow with the size of the Moments table or the viewer's follow graph.
 */

/** Newest Moments from the whole network: the out-of-network candidate source. */
export const FOR_YOU_RECENT_SOURCE_LIMIT = 100;

/** Newest Moments from followed authors: the in-network candidate source. */
export const FOR_YOU_IN_NETWORK_SOURCE_LIMIT = 40;

/**
 * Followed authors resolved from the follow graph when the Redis timeline is
 * cold. Keeps the `IN` filter (and therefore the request URL) small.
 */
export const FOR_YOU_FOLLOWED_AUTHOR_LIMIT = 100;

/**
 * Filtered candidates handed to the ranker. This also bounds the author and
 * like hydration that runs before ranking.
 */
export const FOR_YOU_CANDIDATE_POOL_LIMIT = 100;

/** Ranked Moments returned to the client. */
export const FOR_YOU_RESULT_LIMIT = 50;
