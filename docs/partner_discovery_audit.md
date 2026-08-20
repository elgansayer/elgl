# Partner Discovery Audit & Ranking Enhancements

## 1. Current State of Partner Discovery

The current partner discovery system (`backend/src/discovery/discovery.service.ts`) primarily relies on hard filtering and basic sorting. The available features include:

- **Hard Filters:**
  - Native & target languages (basic array intersection).
  - Proficiency level (exact match).
  - Age range (min/max).
  - Gender (VIP only).
  - Location (country, city, and proximity via PostGIS `ST_DWithin`).
  - Interests (PostgreSQL array overlaps).
  - "Serious Learner" toggle (requires an active study streak of at least 7 days, with streak activity in the last 24 hours).
  - Presence of an audio intro.
  - Active voice room.
  - Availability blocks (morning, afternoon, evening, and exact Tandem-style time overlap).

- **Sorting (`best_match`):**
  - Currently, the `best_match` sorting algorithm is extremely rudimentary. It uses a cascading strict evaluation:
    1.  `is_partner_of_week` (boolean flag, PoW users are pushed to the top).
    2.  `study_streak_days` (descending).
    3.  `correction_ratio` (descending).

**Limitations of the Current System:**

- The `best_match` sort does not actually match users based on compatibility; it merely promotes the most active/helpful users platform-wide.
- Language pair matching is binary (either they have the target language or they don't). It doesn't score reciprocity (e.g., User A is native in Spanish learning English, User B is native in English learning Spanish).
- There is no consideration for timezone overlap beyond the manual "availability blocks" which the user must explicitly set and query.
- Behavioural compatibility (response rates, conversation length) is ignored.
- Interest overlap is a hard filter rather than a ranking signal.

---

## 2. Recommended Ranking Signals for "Best Match"

To build a truly personalised discovery experience, we should replace the cascading strict evaluation with a **weighted composite score**. Each candidate user should be scored against the searching user based on the following signals:

### A. Complementary Languages (Reciprocity Score)

**Why:** The core of language exchange is mutual benefit. A user who natively speaks the language you are learning, _and_ is learning the language you natively speak, is the ideal partner.
**Implementation:**

- +50 points if `candidate.native_languages` intersects with `searcher.target_languages` AND `candidate.target_languages` intersects with `searcher.native_languages`.
- +20 points if only a one-way match exists (e.g., they speak what you learn, but aren't learning what you speak).

### B. Proficiency Level Gap

**Why:** Conversations flow best when both users have a similar ability to communicate, or when the gap is complementary (e.g., an advanced speaker helping a beginner). Two A1 speakers might struggle to maintain a conversation.
**Implementation:**

- If both users have the same target language proficiency (e.g., B1 and B1), +10 points.
- If User A is C1 in Language X and User B is A1 in Language X, this could be scored highly if User B is C1 in User A's target language (complementary imbalance).

### C. Timezone / Active Hours Overlap

**Why:** Language exchange fails if users are awake at completely different times. Manual availability blocks (morning/evening) are high friction and rarely updated by users.
**Implementation:**

- Calculate the user's inferred timezone (either from device data or by analyzing their `last_active_at` distribution over 30 days).
- Calculate the overlapping waking hours (e.g., 08:00 - 23:00 local time) between the searcher and the candidate.
- +10 points for every hour of overlap, up to a maximum of +50.

### D. Interest & Hobby Overlap

**Why:** Shared interests provide immediate conversation starters and increase the likelihood of a long-term connection. Currently, interests are a hard filter, which artificially limits discovery.
**Implementation:**

- Convert the existing `overlaps` hard filter into a scoring mechanism.
- +10 points for each shared interest between `searcher.interests` and `candidate.interests`.
- TF-IDF weighting: Rare interests (e.g., "Astrophysics") should score higher than common interests (e.g., "Music").

### E. Response Behaviour (Responsiveness Score)

**Why:** Users get frustrated when they send messages and receive no reply. We should promote users who actively engage in new conversations.
**Implementation:**

- Track a `reply_rate` (percentage of first messages replied to within 24 hours).
- Track `average_response_time`.
- +30 points for users in the top quartile of `reply_rate`.

### F. Correction Behaviour (Helpfulness)

**Why:** HelloTalk users highly value corrections. The platform already tracks `correction_ratio`, but it shouldn't just be a generic platform-wide metric.
**Implementation:**

- Continue using `correction_ratio` and `corrector_score` (from `CorrectorScoreService`), but scale it dynamically.
- Calculate a composite score based on `(correction_ratio * 0.4) + (corrector_score / 5 * 0.6)`.
- Add up to +40 points based on this helpfulness metric.

### G. Learning Seriousness (Dedication)

**Why:** Casual learners often drop off, frustrating serious learners. The current "Serious Learner" toggle is a strict gate; it should be a spectrum.
**Implementation:**

- Score based on `study_streak_days`.
- Calculate `app_sessions_per_week`.
- If the searcher has `is_serious_learner = true`, heavily weight the candidate's dedication metrics (+50 points for high streaks). If the searcher is casual, down-weight this signal to prefer other casual learners.

### H. Conversation Compatibility (Past Success)

**Why:** If a user tends to have long, successful conversations with users from a specific country or age group, the algorithm should learn this preference.
**Implementation:**

- Track "successful conversations" (e.g., chats exceeding 50 messages).
- If a candidate matches the demographic profile (age, country, gender) of the searcher's historical successful partners, apply a small boost (+10-15 points).
