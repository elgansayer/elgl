---
Priority: Medium Impact
Description: Move beyond isolated vocabulary drills. Introduce scenario-based, context-aware mini-lessons that force users to construct full sentences using the target grammar and vocabulary within a realistic scenario (e.g., "Ordering coffee," "Asking for directions").
Technical Implementation: Modify the lesson generation service to dynamically load a `ScenarioContext` object, which defines the inputs, available vocabulary pool, and required grammar structures for a mini-dialogue.
---

