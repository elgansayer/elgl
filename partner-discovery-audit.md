# Audit Report: Partner Discovery

## Current State

The current partner discovery heavily relies on basic language pairing. In `backend/src/recommendations/recommendations.service.ts`, the function `recommendationsByLanguageExchange` relies on basic `.overlaps` of `native_languages` and `target_languages`, and ordering by `is_serious_learner` and `study_streak_days`.

While this establishes baseline linguistic compatibility, it lacks sophisticated scoring for predicting long-term conversation success. We need to expand ranking signals as requested.

## Proposed Ranking Signals & Explanation

### 1. Complementary Languages
*   **What:** Not just direct matches (A learns B, B learns A), but also assessing secondary languages or bridging languages (e.g. both speak C at an intermediate level).
*   **Why:** Even if the direct native/target match is imperfect, a shared bridge language significantly reduces early-stage communication friction, lowering drop-off rates and helping users explain concepts more effectively.

### 2. Proficiency
*   **What:** Evaluating the delta between users' proficiency levels in their respective target languages (e.g., using `proficiency_level` in `UserProfile`).
*   **Why:** A large disparity (e.g., C2 matching with A1) often leads to a one-sided teaching dynamic rather than a reciprocal language exchange. Matching users with comparable relative proficiencies (or a deliberate slight offset where one is slightly stronger) yields more balanced and mutually beneficial conversations.

### 3. Timezone Overlap
*   **What:** Calculating the number of waking/active hours overlapping based on timezone or location data (or `available_time_start` / `available_time_end` fields in `UserProfile`).
*   **Why:** A perfect language match is useless if the users are never awake at the same time. Synchronous communication is a huge driver of engagement in language exchange apps. Higher timezone overlap increases the probability of real-time chatting and voice calls.

### 4. Interests
*   **What:** Jaccard similarity or TF-IDF scoring on the `interests` and `hobbies` arrays in `UserProfile`.
*   **Why:** Language is a medium, not the subject. Having shared interests (e.g., both like 'tech' and 'travel') provides immediate, natural conversation starters (icebreakers) and sustains long-term dialogue beyond basic introductions.

### 5. Response Behaviour
*   **What:** Historical metrics such as median response time, reply rate to new messages, and ghosting frequency.
*   **Why:** Users who frequently initiate or promptly reply to messages are high-value network nodes. Surfacing users with healthy response behaviours prevents new users from sending messages into a void, thereby improving overall platform retention.

### 6. Correction Behaviour
*   **What:** Utilizing the existing `correction_ratio` and `corrector_score` in `UserProfile`.
*   **Why:** A core value proposition of the app is getting native corrections. Users who actively and accurately correct others' mistakes (high ratio and score) should be promoted, as they directly contribute to the learning outcomes of their partners.

### 7. Learning Seriousness
*   **What:** Combining `is_serious_learner` (boolean), `study_streak_days`, and session frequency/duration.
*   **Why:** Filtering out casual or low-intent users. Users with high study streaks and the 'Serious Learner' flag have demonstrated commitment. Matching them with similarly committed peers prevents frustration caused by flakey partners.

### 8. Conversation Compatibility
*   **What:** A predictive score based on historical chat length, average message size, and vocabulary overlap, perhaps utilizing the `learning_goals` field.
*   **Why:** Some users prefer short, frequent chat messages, while others prefer long, detailed pen-pal style paragraphs. Matching based on conversation style ensures the cadence and depth of the exchange meet both users' expectations.
