# Partner Discovery Ranking Signals Audit

This document outlines recommended ranking signals for the "Best Match" partner discovery sorting, beyond basic language pairing.

## 1. Complementary Languages
**Why:** The core of language exchange is mutual benefit. A user who natively speaks the language you are learning, and is learning the language you natively speak, is the ideal partner.

## 2. Proficiency Level Gap
**Why:** Conversations flow best when both users have a similar ability to communicate, or when the gap is complementary (e.g., an advanced speaker helping a beginner). Two A1 speakers might struggle to maintain a conversation.

## 3. Timezone / Active Hours Overlap
**Why:** Language exchange fails if users are awake at completely different times. Explicit timezone overlap scoring eliminates the friction of manual availability blocks.

## 4. Interests
**Why:** Shared interests provide immediate conversation starters and increase the likelihood of a long-term connection, transitioning from a hard filter to a weighted scoring system.

## 5. Response Behaviour
**Why:** Users get frustrated when they send messages and receive no reply. We should promote users who actively engage in new conversations (high reply rate).

## 6. Correction Behaviour
**Why:** Users highly value corrections. By scaling the correction ratio alongside the corrector score, helpful users are elevated.

## 7. Learning Seriousness
**Why:** Casual learners often drop off, frustrating serious learners. Integrating study streak days ensures dedicated users are matched appropriately.

## 8. Conversation Compatibility
**Why:** If a user tends to have long, successful conversations with users from a specific country or age group, the algorithm should learn and prioritise this preference.

# Partner discovery ranking proposals

This is a design proposal, not evidence that a scoring experiment improves conversation quality. Current behaviour is split between discovery sorting and the recommendation service; do not describe all paths as a language-only binary filter. Inspect `backend/src/discovery/discovery.service.ts` and `backend/src/recommendations/discovery-recommendations.service.ts` for the deployed weights, privacy gates and candidate selection.

| Signal | Proposed use | Evidence or constraint required |
| --- | --- | --- |
| Language reciprocity | Prefer mutual native/target language compatibility | Preserve explicit user filters and validate ranking against the actual endpoint. |
| Proficiency | Consider relative learning levels | Treat missing data neutrally; no claim that one pairing guarantees a better exchange. |
| Availability | Compare stated time preferences | Clock times alone do not establish simultaneous availability across timezones. Use explicit timezone context before claiming actual overlap. |
| Interests | Use shared topics as conversation starters | The existing recommendation ranker already considers shared interests; evaluate improvements against that baseline. |
| Response behaviour | Explore aggregate responsiveness | Define consent, retention, minimum sample/cohort sizes, uncertainty and opt-out before collecting or exposing a behavioural score. Do not expose private contacts or individual response histories. |
| Corrections | Consider established helpfulness signals | A high correction count or ratio is not proof of correctness or quality; measure abuse and learner outcomes. |
| Learning goals and consistency | Match stated goals and suitable participation cadence | Preserve hard eligibility and privacy settings. Do not convert a consent or safety gate into a soft ranking preference. |
| Conversation preferences | Prefer explicitly stated communication style | Do not infer sensitive preferences from age, nationality or message content. Start with optional user-supplied preferences. |

Keep blocked, hidden and otherwise ineligible users excluded before ranking. Missing or sparse signals should not fabricate a strong preference. Any new metric needs a documented sample threshold, privacy-preserving aggregation and failure behaviour before implementation.

Compare proposals using a controlled evaluation with clear quality and fairness measures, including cold-start users. Source inspection cannot establish retention gains, reduced drop-off or learning effectiveness. Proposed weights and collection mechanisms are not approved or shipped by this document.

