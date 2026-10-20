# Language Learning Audit Report

This report audits the application from a pedagogical perspective, evaluating how well its features align with evidence-based language learning principles such as Comprehensible Input, Retrieval Practice, Spaced Repetition, Active Production, and Meaningful Feedback.

## 1. Chat & Social Feed (Active Production & Meaningful Feedback)
- **Observation:** The application features real-time chat, group chats, and a social feed ('Moments'). Native speakers can correct others using a visual diff tool.
- **Pedagogical Value:** This provides high-quality, authentic active production opportunities. The visual diff correction tool offers excellent meaningful feedback.
- **Alignment:** Strong alignment with Active Production and Meaningful Feedback.

## 2. Interactive Reading Engine (Comprehensible Input & Spaced Repetition)
- **Observation:** The app includes a LingQ-style interactive reading engine with universal word tokenization. Users can click words to translate and save them to a flashcard system with Spaced Repetition System (SRS) levels.
- **Pedagogical Value:** This is a gold standard for Comprehensible Input. Linking encountering words in context to SRS directly bridges input and retrieval practice.
- **Alignment:** Exceptional alignment with Comprehensible Input, Retrieval Practice, and Spaced Repetition.

## 3. AI Conversations (Active Production, Retrieval Practice, Meaningful Feedback)
- **Observation:** The `ai-conversation.service.ts` heavily personalizes the AI system prompt. Crucially, it fetches the user's recent flashcards and instructs the AI to: `Deliberately reuse recently learned material (vocabulary listed above) to reinforce learning.` It also instructs the AI to provide i+1 input and gentle corrections.
- **Pedagogical Value:** This creates a dynamic, responsive environment that actively pulls vocabulary from the user's passive recognition (SRS) into active production through conversational retrieval practice.
- **Alignment:** Outstanding integration of all pedagogical pillars.

## 4. Streaks & Assessments (Motivation & Tracking)
- **Observation:** The app tracks study streaks and learner knowledge (proficiency levels and struggling concepts).
- **Pedagogical Value:** Gamification (streaks) encourages consistency, vital for language acquisition. The knowledge tracking informs the AI tutor, allowing for targeted support.
- **Alignment:** Supports the necessary consistency for the core pedagogical pillars to be effective.

## Conclusion
The application demonstrates an exceptionally strong, interwoven pedagogical design. The features are not siloed; they actively reinforce each other. The integration of saved flashcards directly into the AI conversation prompt is a masterclass in connecting passive review with active retrieval. The current implementation already maximizes the targeted pedagogical principles.

This report evaluates the application as a language-learning expert to determine whether chat, reading, corrections, vocabulary, AI conversations, pronunciation, lessons, streaks and assessments reinforce each other to maximise comprehensible input, retrieval practice, spaced repetition, active production and meaningful feedback.

## 1. Chat & AI Conversations (Active Production)
- **Observation (Verified):** The application features real-time chat and AI conversation capabilities (e.g., `frontend/src/app/ai-conversation/ai-conversation.component.ts`). Chat messages use tokenised text (`frontend/src/app/components/tokenised-text/tokenised-text.component.ts`) which integrates with the LingQ-style reading engine allowing click-to-translate and save.
- **Synergy:** Chat and AI conversations strongly reinforce Vocabulary through the LingQ reader flow. Users can actively produce language in chat and acquire new vocabulary directly from partner input or AI responses.

## 2. Reading Engine & Vocabulary (Comprehensible Input & Spaced Repetition)
- **Observation (Verified):** A robust "LingQ" style interactive reading engine is present (e.g., `frontend/src/app/components/tokenised-text/tokenised-text.component.ts`, `frontend/src/app/components/word-definition-modal/word-definition-modal.component.ts`, `frontend/src/app/services/vocabulary.store.ts`). Users can click words to see definitions and save them as Flashcards with SRS levels (0-4) and colour-coded styling.
- **Synergy:** Reading acts as the primary source of comprehensible input. The direct pipeline to the Spaced Repetition System (SRS) ensures vocabulary acquisition is systematically reinforced.

## 3. Corrections (Meaningful Feedback)
- **Observation (Verified):** The platform includes a visual diff correction tool (e.g., `frontend/src/app/components/visual-diff/visual-diff.component.ts`) allowing users to correct each other's text in chat and social feeds.
- **Synergy:** Corrections provide immediate, meaningful feedback on active production. The `frontend/src/app/components/visual-diff/visual-diff.component.ts` component includes a save action, linking feedback back to the SRS vocabulary system.

## 4. Pronunciation & Assessments (Retrieval Practice & Meaningful Feedback)
- **Observation (Verified):** Pronunciation scoring (e.g., `frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts`, `backend/src/nlp/dto/pronunciation-score.dto.ts`) provides feedback on spoken production. Proficiency assessments evaluate overall language level.
- **Synergy:** Pronunciation tools provide specific feedback on spoken production. Assessments help tailor content difficulty (comprehensible input).

## 5. Lessons (Comprehensible Input & Structured Learning)
- **Observation (Verified):** Structured lessons (e.g., `frontend/src/app/pages/lessons/lessons.component.ts`) provide guided learning with text and audio.
- **Synergy:** Lessons provide baseline comprehensible input and have now been tightly integrated with the universal tokenisation engine to allow direct SRS vocabulary extraction from lesson content.

## 6. Study Streaks (Motivation & Habit Formation)
- **Observation (Verified):** A study streak system (e.g., `frontend/src/app/services/study-streak.service.ts`, `frontend/src/app/components/study-streak-widget/study-streak-widget.component.ts`) encourages daily check-ins and consistent practice.
- **Synergy:** Streaks provide the motivational framework necessary to sustain spaced repetition and regular active production.

## Conclusion & Recommendations
The application possesses all the necessary features for a highly effective language learning ecosystem. The integration between features (e.g., tokenised text in chat saving to SRS, corrections saving to SRS) is generally strong and well-aligned with second language acquisition principles.

**Current state effectively reinforces:** Comprehensible input (Reading), Spaced Repetition (Vocabulary), Active Production (Chat/AI), and Meaningful Feedback (Corrections/Pronunciation).

