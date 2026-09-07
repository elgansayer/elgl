# Audit Report: Partner Discovery

This audit evaluates the current implementation of partner discovery and recommendations based on the core requirements: complementary languages, proficiency, availability, interests, correction behaviour, learning seriousness, learning-goal compatibility, and explainability.

## 1. Complementary Languages

**Implementation Status: Verified**

- **Evidence:** `backend/src/recommendations/discovery-recommendations.service.ts`, `backend/src/discovery/discovery.service.ts`
- **Mechanism:** The recommendation algorithms natively filter for reciprocal language matches (`hasOverlap(nativeLanguages, ownTargets) && hasOverlap(targetLanguages, ownNative)`).

## 2. Proficiency

**Implementation Status: Verified**

- **Evidence:** `backend/src/discovery/discovery.service.ts`
- **Mechanism:** The `searchPartners` endpoint processes a `level` filter (`query.level`), comparing against the users' profiles or including users with unrecorded levels (`u.proficiency_level === undefined || u.proficiency_level === requestedLevel`) to prevent penalising new users.

## 3. Availability

**Implementation Status: Verified for profile-local availability**

- **Evidence:** `backend/src/recommendations/discovery-recommendations.service.ts`
- **Mechanism:** The ranking uses shared day-parts and validated `HH:mm` windows. Exact windows require positive-duration overlap, support overnight ranges, and treat malformed or endpoint-only ranges as neutral.
- **Boundary:** Profiles do not currently carry a verified timezone or UTC offset. The service therefore must not claim timezone-aware overlap; that requires a separately designed profile and privacy contract.

## 4. Interests

**Implementation Status: Verified**

- **Evidence:** `backend/src/recommendations/discovery-recommendations.service.ts`
- **Mechanism:** The recommendation ranking actively evaluates `shared_interest_count`, applying significant ranking score weights (15 points per shared interest) for candidates with up to 3 overlapping tags (`Math.min(3, sharedInterestCounts.get(candidate.id) ?? 0)`).

## 5. Response & Correction Behaviour

**Implementation Status: Verified**

- **Evidence:** `backend/src/discovery/discovery.service.ts`
- **Mechanism:** Users are scored on their `correction_ratio` as a measure of contribution quality. Furthermore, the "Partner of the Week" highlighting system relies on a composite score encompassing correction ratio (weight `0.3`) and corrector rating average (weight `0.35`).

## 6. Learning Seriousness

**Implementation Status: Verified**

- **Evidence:** `backend/src/recommendations/discovery-recommendations.service.ts`
- **Mechanism:** Seriousness is quantifiably measured via `study_streak_days`. Having a streak of 7 days or more, or an explicit `is_serious_learner` profile flag directly influences ranking scores (`score += 10`).

## 7. Explainability of Recommendations

**Implementation Status: Verified**

- **Evidence:** `backend/src/recommendations/discovery-recommendations.service.ts`
- **Mechanism:** The algorithm maps each ranking factor to a typed `RecommendationReason`, exposes the same enum through OpenAPI and the Angular client contract, and renders every value through translated labels.

## Conclusion

The partner discovery implementation goes well beyond basic language pairing, integrating multidimensional signals for matching and offering explicit explainability for each recommendation.
