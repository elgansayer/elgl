# Pedagogical Architecture Audit Report

This report evaluates the application as a language-learning expert to determine if core features (chat, reading, corrections, vocabulary, AI conversations, pronunciation, lessons, streaks, and assessments) reinforce each other to maximize comprehensible input, retrieval practice, spaced repetition, active production, and meaningful feedback.

## 1. Comprehensible Input (Reading & Chat)
- **Observation (Verified):** The application features LingQ-style interactive reading (per `README.md`) and curated learning articles (`backend/src/database/migrations/002_create_curated_learning_tables.sql`).
- **Analysis:** Provides robust input. The reading engine allows users to consume texts.

## 2. Active Production (Chat, Audio Rooms & AI Conversations)
- **Observation (Verified):** The platform supports multi-user language exchange rooms (`LiveKit` integration per `README.md`) and AI conversations. AI system prompts explicitly mandate "Active Production: Ask engaging, open-ended questions related to their interests to prompt them to speak and produce language" (`backend/src/ai-conversation/ai-conversation.service.ts`).
- **Analysis:** Highly effective for spoken and written production.
- **Integration:** Audio rooms and AI conversations provide distinct production environments (spontaneous human vs. low-pressure AI).

## 3. Meaningful Feedback (Corrections)
- **Observation (Verified):** The platform includes a correction tool for both direct and group chats.
- **Analysis:** Structured corrections provide immediate, explicit feedback on grammar and vocabulary.

## 4. Retrieval Practice & Spaced Repetition (Vocabulary & Flashcards)
- **Observation (Verified):** The `FlashcardsService` implements an algorithm for spaced repetition (`backend/src/flashcards/flashcards.service.ts`). It evaluates review quality to calculate the `easiness_factor` and `interval_days`. The system also suggests flashcards from chat messages (`backend/src/flashcards/suggest-flashcards.service.ts`).
- **Analysis:** Core SRS mechanics are well-implemented.
- **Integration:** The AI conversation service explicitly lists instructions to use recently learned material to reinforce learning via Spaced Repetition (`backend/src/ai-conversation/ai-conversation.service.ts`).

## 5. Motivation & Consistency (Streaks & Assessments)
- **Observation (Verified):** `AssessmentsService` evaluates self-reported skills and difficulty levels (`backend/src/assessments/assessments.service.ts`).
- **Analysis:** Assessments provide a sense of progression.

## Conclusion & Opportunities
The architecture demonstrates a high degree of integration between features. The AI tutor's explicit prompting to reuse recently learned material during natural conversation is a best-in-class implementation of contextual retrieval practice.

**Potential Enhancements:**
- Automatically generate flashcards from user errors in the correction tool, turning community feedback directly into SRS material.
