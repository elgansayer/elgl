# Language Learning Efficacy Audit Report

This report evaluates the current implementation of language learning mechanics (chat, reading, corrections, vocabulary, AI conversations, pronunciation, lessons, streaks, and assessments) from a pedagogical perspective, rather than purely architectural. It analyses how well these features reinforce each other to maximise comprehensible input, retrieval practice, spaced repetition, active production, and meaningful feedback.

## 1. Comprehensible Input (Reading & Chat)
- **Observation:** The application implements interactive reading and real-time chat with transliteration, translation, and text-to-speech support. These tools lower the affective filter and provide immediate scaffolding.
- **Analysis:** While isolated input is strong, there is a gap in systemic integration. Reading texts do not dynamically adapt to the user's specific SRS vocabulary level.
- **Recommendation:** Integrate vocabulary tracking more deeply into the reading selection process to provide truly comprehensible input ("i+1" principle).

## 2. Meaningful Feedback (Corrections & Pronunciation)
- **Observation:** Visual diff corrections via native speakers and AI pronunciation scoring offer direct, actionable feedback on active production.
- **Analysis:** At baseline, correction explanation generation (`chat.service.ts`) used a generic prompt. This change adds a grammatical rationale and usage example, while native-language explanations and follow-up retrieval exercises remain future integration gaps.
- **Recommendation:** Extend the new pedagogical prompt with the learner's native language and targeted retrieval practice opportunities.

## 3. Retrieval Practice & Spaced Repetition (Vocabulary & Flashcards)
- **Observation:** The SRS flashcard system allows users to save vocabulary from interests and reading sessions.
- **Analysis:** Flashcard generation from interests (`interests.service.ts`) historically left `original_context` blank. Meaningful spaced repetition relies on contextual cues rather than isolated rote memorisation.
- **Recommendation:** Implement automated contextual sentence generation when saving vocabulary to provide associative hooks for retrieval practice.

## 4. Active Production (AI Conversations & Chat)
- **Observation:** AI conversations and peer chat encourage output. The AI proxies (e.g. text simplification in `nlp.service.ts`) help maintain conversational flow.
- **Analysis:** Active production is isolated from the structured lessons. Learners might not apply the specific grammar or vocabulary they just studied.
- **Recommendation:** Prompt AI conversation partners and suggest chat topics that explicitly incorporate the user's current 'due' SRS vocabulary or recently completed lesson objectives.

## 5. Motivation & Consistency (Streaks & Assessments)
- **Observation:** Streaks and assessments provide gamification and progress tracking.
- **Analysis:** Streaks are primarily volume-based (days active) rather than quality-based (spaced repetition adherence). Assessments accurately gauge skill but do not automatically adjust the difficulty of subsequent reading materials or AI chat complexity.
- **Recommendation:** Tie streak maintenance to completing due SRS reviews, ensuring that the gamification directly supports long-term retention.

## Conclusion & Code Implementation Plan
The individual features are robust but operate largely in silos. To transform this from a feature-rich app into a cohesive language acquisition engine, the systems must interact.

**Immediate Changes Implemented:**
1. **Contextual Flashcard Generation:** Modified `interests.service.ts` to populate `original_context` for flashcards that lack context, using bounded batched LLM requests and leaving failed or invalid generations null for a later retry.
2. **Pedagogical Correction Explanations:** Upgraded the AI prompt in `chat.service.ts` (`generateCorrectionPayloadIfNeeded`) to provide grammatical rationale and usage examples rather than just a simple explanation.
