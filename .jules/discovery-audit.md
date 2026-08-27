# Partner Discovery Ranking Signals Audit

This document outlines recommended ranking signals for the "Best Match" partner discovery sorting, beyond basic language pairing. The recommendations are designed to build a truly personalised discovery experience by replacing the cascading strict evaluation with a weighted composite score. Each candidate user should be scored against the searching user based on the following signals:

## 1. Complementary Languages (Reciprocity Score)
**Why:** The core of language exchange is mutual benefit. A user who natively speaks the language you are learning, and is learning the language you natively speak, is the ideal partner. The current system relies on binary language pair matching. Scoring reciprocity addresses this by strongly favouring mutually beneficial pairs, while still allowing for one-way matches if needed.

## 2. Proficiency Level Gap
**Why:** Conversations flow best when both users have a similar ability to communicate, or when the gap is complementary (e.g., an advanced speaker helping a beginner). Two A1 speakers might struggle to maintain a conversation. Currently, proficiency is just a hard filter. Adding it as a ranking signal helps surface users who are better suited for meaningful interaction based on their relative language skills.

## 3. Timezone / Active Hours Overlap
**Why:** Language exchange fails if users are awake at completely different times. Currently, timezone matching relies on manual availability blocks, which are high friction and rarely updated by users. Explicit timezone overlap scoring eliminates this friction by automatically favouring partners who share waking hours.

## 4. Interest & Hobby Overlap
**Why:** Shared interests provide immediate conversation starters and increase the likelihood of a long-term connection. Currently, interests are used as a hard filter, artificially limiting discovery. Transitioning this to a weighted scoring system (e.g., using TF-IDF for rare interests) surfaces users with common ground without entirely hiding those who don't match perfectly.

## 5. Response Behaviour (Responsiveness Score)
**Why:** Users get frustrated when they send messages and receive no reply. The current sorting algorithm ignores behavioural compatibility. Promoting users who actively engage in new conversations (e.g., high reply rate within 24 hours) ensures searchers are connected with active, responsive partners.

## 6. Correction Behaviour (Helpfulness)
**Why:** Users highly value corrections in a language exchange platform. While the platform currently tracks `correction_ratio` and uses it as a fallback in the `best_match` sort, it is applied as a generic platform-wide metric. Scaling this dynamically alongside a `corrector_score` elevates genuinely helpful users.

## 7. Learning Seriousness (Dedication)
**Why:** Casual learners often drop off, frustrating serious learners. Currently, the "Serious Learner" toggle is a strict gate. Integrating dedication metrics (like `study_streak_days`) as a spectrum allows the algorithm to match serious learners with other serious learners, while down-weighting the signal for casual learners who might prefer a less intense commitment.

## 8. Conversation Compatibility (Past Success)
**Why:** If a user tends to have long, successful conversations with users from a specific country or age group, the algorithm should learn and prioritise this preference. This adds a layer of personalization that goes beyond explicit profile settings, adapting to the user's actual successful interactions.
