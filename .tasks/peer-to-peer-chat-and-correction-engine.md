---
Priority: High Impact
Description: Implement a full, real-time, direct messaging system (text and audio) that facilitates peer-to-peer exchange. Crucially, this chat must include a robust, built-in "Correction" mode where users can tap a problematic word/phrase to receive automated suggestions, grammar explanations, and the source grammar rule.
Technical Implementation: Integrate a WebSocket connection layer for real-time chat and build a microservice `CorrectionEngine` that utilizes NLP/LLM APIs to provide contextual corrections and explanations upon request.
---

