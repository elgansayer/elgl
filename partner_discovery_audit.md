# Partner Discovery Algorithm Audit

## Introduction

The partner discovery algorithm is responsible for surfacing recommendations to users. Currently, the algorithm evaluates several signals but lacks a comprehensive scoring mechanism for others (e.g., timezone overlap, correction behaviour, and conversation compatibility). This audit examines the current implementation and proposes enhancements.

## Core Ranking Signals Analysed

### 1. Complementary Languages
- **Signal**: `reciprocalLanguageMatch`
- **Implementation**: Validates if the user's target language overlaps with the candidate's native language AND the user's native language overlaps with the candidate's target language (`hasOverlap(nativeLanguages, ownTargets) && hasOverlap(targetLanguages, ownNative)`).
- **Weight**: +50 score.
- **Reason Tag**: `language_exchange`
- **Recommendation**: Continue using this as the primary matching signal.

### 2. Interests (Shared)
- **Signal**: `sharedInterestCount`
- **Implementation**: Counts the number of matching tags from `user_interests`. Capped at 3 matches for scoring purposes (`Math.max(0, Math.min(3, sharedInterestCounts.get(candidate.id) ?? 0))`).
- **Weight**: +15 score per shared interest (up to +45 total).
- **Reason Tag**: `shared_interests`
- **Recommendation**: Continue using this signal to improve engagement.

### 3. Response Behaviour & Activity
- **Signal**: `activityRank`
- **Implementation**: Checks `last_active_at` and `privacy_hide_online_status`. Tier 2 (Active in last 24h): +20 score. Tier 1 (Active in last 7 days): +10 score. Tier 0 (Inactive/Hidden): +0 score.
- **Reason Tag**: `active_recently`
- **Recommendation**: Continue using this signal to ensure users find active partners.

### 4. Learning Seriousness
- **Signal**: `hasStudyStreak` & `is_serious_learner`
- **Implementation**: Evaluates if the candidate has a study streak ≥ 7 days (`(candidate.study_streak_days ?? 0) >= 7`) OR explicitly has the `is_serious_learner` flag set to true.
- **Weight**: +10 score.
- **Reason Tag**: `study_streak`
- **Recommendation**: Continue using this signal to reward dedicated learners.

### 5. Proficiency Level
- **Signal**: `proficiency_level`
- **Status**: Captured in schema (`A1` to `C2`), used in PostGIS PostgREST filters (`GDPR_MATCHMAKING_FILTERS`), but explicitly **not** used as a direct scoring mechanism in the `DiscoveryRecommendationsService` ranking loop.
- **Recommendation**: While not currently ranked, it's used for filtering.

### 6. Timezone Overlap
- **Signal**: `location` / Geography
- **Status**: Extensively used via PostGIS `search_nearby_users` RPC for proximity discovery, but not translated into a scoring signal for general "Recommended for You" carousel ranking. The system lacks a direct timezone offset calculation.
- **Recommendation**: While not currently ranked, proximity is used for filtering.

### 7. Correction Behaviour
- **Signal**: `correction_ratio`
- **Status**: Maintained in database (default 1.0) and evaluated as a secondary tie-breaker in fallback pipelines (`recommendationsByInterests` and `recommendationsByLanguageExchange`), but completely excluded from the live carousel ranking algorithm.
- **Recommendation**: Currently used as a fallback tie-breaker.

### 8. Conversation Compatibility
- **Signal**: N/A
- **Status**: Not explicitly modelled beyond shared interests and language exchange overlap.
- **Recommendation**: Currently not implemented.

## Conclusion
The current implementation focuses primarily on languages, interests, and recent activity, completely omitting proficiency, timezone, correction behaviour, and conversation compatibility from the live carousel ranking.
