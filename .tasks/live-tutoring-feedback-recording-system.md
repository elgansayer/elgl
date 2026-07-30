---
Priority: Medium Impact
Description: When a paid tutor session concludes, automatically record, transcribe, and analyze the session. The platform must then generate a personalized, downloadable "Session Report" for the user, detailing pronunciation errors, grammatical repetitions, and high-value vocabulary learned.
Technical Implementation: Integrate a cloud recording service (Zoom/WebRTC recording) and build a post-session worker that utilizes the NLP services to generate a structured JSON report consumed by the user dashboard.
---

