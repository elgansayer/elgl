# Audit Partner Discovery & Recommendations

## Current State Analysis
The current partner discovery algorithm in HelloTalk heavily relies on basic language pairing (native and target languages), some demographic filtering (age, gender, location), and rudimentary metrics like study streak days and correction ratio. It lacks nuanced signals that account for actual conversational compatibility, user engagement styles, and practical logistical overlaps (like timezones).

## Recommended Ranking Signals

### 1. Complementary Languages
**Why:** Basic native/target pairing isn't enough. We need to measure the *reciprocity* of the exchange.
**Signal:** A score based on the overlap of User A's target languages and User B's native languages, weighted by proficiency. A perfect score occurs when both users are learning each other's native languages and have a similar gap in proficiency that they can help close.

### 2. Proficiency Alignment
**Why:** A beginner (A1) paired with an advanced learner (C1) often leads to unbalanced exchanges where the advanced learner becomes a de facto teacher.
**Signal:** A delta score between self-assessed or tested proficiency levels. Pairs with closer proficiency levels (or intentional asymmetric pairs if users opt-in to a mentor/mentee dynamic) should be ranked higher for standard language exchanges.

### 3. Timezone Overlap & Availability
**Why:** Even the perfect match will fail if users are awake at completely different times. Current availability flags (morning, afternoon, evening) are too broad.
**Signal:** Calculate the overlapping waking/active hours based on timezone or explicit exact availability times. Rank users higher if their historical activity times align with the searcher's typical usage patterns.

### 4. Shared Interests & Hobbies
**Why:** Sustaining a language exchange requires having things to talk about beyond the language itself.
**Signal:** A similarity score based on overlapping interest tags, learning goals, and potentially analyzed keywords from bios or past public Moments. The more niche the shared interest, the higher the weight.

### 5. Response Behaviour (Responsiveness)
**Why:** Users get frustrated when they reach out and never hear back.
**Signal:** Calculate a "Response Rate" (percentage of first messages replied to) and "Average Response Time." Users who are highly responsive should be boosted in the ranking to ensure active engagement.

### 6. Correction Behaviour
**Why:** The goal is language learning, not just chatting. Some users want strict corrections; others want conversational flow.
**Signal:** Beyond the current `correction_ratio`, we should track the *style* of corrections (frequency, detail level). We can match users based on their preference for receiving corrections vs. the partner's tendency to give them.

### 7. Learning Seriousness
**Why:** Casual learners often drop off, frustrating dedicated learners.
**Signal:** Enhance the current boolean `is_serious_learner` check. Create a continuous "Dedication Score" factoring in session length, frequency of app usage, consistent streaks, and completion of learning goals or lessons.

### 8. Conversation Compatibility (Chat Retention)
**Why:** The ultimate metric of a good match is whether the conversation lasts.
**Signal:** A machine learning model (or heuristic) that looks at historical chat data: average conversation length (in messages or days) of past partners. If a user typically sustains long conversations with a certain demographic or interest profile, boost similar profiles.
