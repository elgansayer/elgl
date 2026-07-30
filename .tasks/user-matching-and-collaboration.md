---
Priority: Medium Impact
Description: Develop sophisticated matching algorithms (similar to HelloTalk) that match users based not just on language interest, but on specific skill gaps (e.g., "Needs help with Japanese particles," "Good at casual English conversation"). Implement group exchange sessions.
Technical Implementation: Refactor the `User` model to include detailed `skill_gaps` and `skill_strengths` vectors, and implement a matching algorithm (e.g., weighted cosine similarity) that suggests optimal pairs for mutual improvement.
---

