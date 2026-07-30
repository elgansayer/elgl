---
Priority: High Impact
Description: Implement a robust Spaced Repetition System (SRS) engine (like SuperMemo or Anki) to manage user vocabulary and grammar retention. The system must dynamically adjust the review interval based on the user's demonstrated recall difficulty (Ease Factor) for specific words/concepts, rather than relying on fixed timelines.
Technical Implementation: Introduce a `VocabularyReview` service that calculates and queues review cards/lessons based on the Leitner box principle or SM-2 algorithm, calling these services before the lesson generation pipeline.
---

