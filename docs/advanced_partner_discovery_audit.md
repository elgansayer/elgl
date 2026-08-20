# Advanced Partner Discovery Audit & Ranking Enhancements

## Overview
This document outlines recommended ranking signals to improve partner discovery beyond basic language pairing. A personalized discovery experience should evaluate candidates based on a weighted composite score of multiple compatibility factors.

## Recommended Ranking Signals

### 1. Complementary Languages (Reciprocity)
**Why:** Language exchange thrives on mutual benefit. A partner who speaks the language you are learning natively and is learning your native language is ideal.
**Recommendation:** Implement a reciprocal language matching score that awards points when native and target languages align in both directions.

### 2. Proficiency Level Compatibility
**Why:** Conversations are most productive between users with similar proficiency or a balanced, complementary skill gap (e.g., an advanced speaker aiding a beginner).
**Recommendation:** Score candidates based on matching or complementary proficiency levels to ensure balanced exchanges.

### 3. Timezone / Active Hours Overlap
**Why:** Real-time conversation requires overlapping waking hours. Relying solely on manual availability blocks is ineffective.
**Recommendation:** Analyze inferred timezones or activity patterns to calculate overlapping active hours and award points accordingly.

### 4. Interest & Hobby Alignment
**Why:** Shared interests act as natural icebreakers and foster longer-lasting connections.
**Recommendation:** Transition from treating interests as hard filters to ranking signals, using TF-IDF weighting to value rare shared interests more heavily than common ones.

### 5. Response Behaviour
**Why:** Users value responsiveness. High response rates and quick reply times lead to better discovery outcomes.
**Recommendation:** Track metrics such as reply rate (within 24 hours) and average response time, awarding points to users in the top percentiles.

### 6. Correction Behaviour (Helpfulness)
**Why:** Providing corrections is a core value of the platform.
**Recommendation:** Combine existing metrics like `correction_ratio` and `corrector_score` into a composite helpfulness score to boost highly helpful candidates.

### 7. Learning Seriousness (Dedication)
**Why:** Dedicated learners prefer matching with similarly committed peers.
**Recommendation:** Use metrics like `study_streak_days` and weekly app sessions to gauge dedication, scaling the importance of this signal based on the searcher's own seriousness level.

### 8. Conversation Compatibility (Past Success)
**Why:** Historical success with specific demographics (e.g., age, country) indicates compatibility preferences.
**Recommendation:** Analyze past successful conversations (e.g., chats with >50 messages) and boost candidates who match those successful profiles.
