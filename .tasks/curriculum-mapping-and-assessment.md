---
Priority: Medium Impact
Description: Formalize the learning path by integrating industry standards (CEFR or JLPT/HSK) into the content structure. Users must see a clear map showing which modules unlock higher proficiency levels, and the app must dynamically adjust required grammar/vocabulary checks to align with the target CEFR descriptor (e.g., "B1 Speaking Competency").
Technical Implementation: Redesign the `Curriculum` model to include `required_proficiency_level` and implement a state machine logic in the lesson service to gate access to content based on successful completion milestones.
---

