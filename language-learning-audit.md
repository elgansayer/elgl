# Language Learning Audit Report

## 1. Comprehensible Input
*   **Reading Engine:** The Reading Engine (`reading-engine.component.ts`) provides comprehensible input by allowing users to read articles at their level.
*   **Chat:** AI Chat prompts (like in `chat-llm-proxy.service.ts` and `chat.service.ts`) currently lack explicit instructions to provide comprehensible input (e.g., using i+1 language). This needs to be improved.
*   **AI Conversation:** The `ai-conversation.service.ts` explicitly includes instructions for comprehensible input ("Use natural, conversational language slightly above their ${level} level (i+1)"). This is excellent.

## 2. Retrieval Practice & Spaced Repetition
*   **Vocabulary/Flashcards:** The application has a dedicated vocabulary system (`vocabulary.store.ts`) with Spaced Repetition System (SRS) levels. It also has features to review cards.
*   **AI Conversation:** The `ai-conversation.service.ts` prompt includes instructions to "Deliberately reuse recently learned material (vocabulary listed above)".
*   **Premium AI:** The `premium-ai.service.ts` coach prompt could better integrate spaced repetition recommendations into the "Next steps" section.

## 3. Active Production
*   **Audio Rooms & AI Conversation:** These features directly encourage speaking. `ai-conversation.service.ts` includes prompts to "Ask engaging, open-ended questions".
*   **Chat:** Chat also requires active production, but AI prompts could be tweaked to encourage longer, more complex responses from the user.

## 4. Meaningful Feedback
*   **Grammar Corrections:** The `grammar-explanation.service.ts` and `grammar-check.service.ts` provide feedback, but the system prompts could be enhanced to explicitly ask the AI to explain the *why* behind corrections in a pedagogical way, reinforcing the "meaningful" aspect.
*   **Premium AI Report:** The `premium-ai.service.ts` provides a structured report, which is great. It could be instructed to provide more actionable pedagogical feedback.
*   **AI Conversation:** The `ai-conversation.service.ts` includes instructions to "gently and naturally rephrase their sentence correctly".

## Integration Assessment
*   **Strengths:** The app has a wide array of tools (chat, reading, vocabulary, AI conversation, assessments). The `learner-knowledge.service.ts` attempts to integrate flashcards, assessments, and lessons into a holistic profile. The AI Conversation explicitly references struggling vocabulary.
*   **Weaknesses:** The connection between reading/chat and the vocabulary system could be stronger. While vocabulary can be extracted from audio rooms (`audio-rooms.service.ts`), it's not clear if this seamlessly feeds into the SRS system. The AI chat prompts (outside of the dedicated AI conversation mode) are generic and don't leverage the user's specific learning context (i+1, specific vocabulary).

## Recommended Actions
1.  **Enhance Chat Prompts:** Update `chat.service.ts` and `chat-llm-proxy.service.ts` to mandate comprehensible input (i+1).
2.  **Enhance Grammar Feedback:** Update `grammar-explanation.service.ts` and `grammar-check.service.ts` to focus on *why* a correction is made.
3.  **Enhance Premium AI Coach:** Update `premium-ai.service.ts` to include explicit spaced repetition strategies in its "Next steps".
