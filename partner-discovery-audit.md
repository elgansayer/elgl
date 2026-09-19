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
