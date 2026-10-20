# Flashcard grading haptic feedback

Issue: #1692

## User experience

Flashcard grading uses short, non-essential vibration cues after the learner chooses a grade:

| Grade | Cue | Purpose |
| --- | --- | --- |
| Again | `light` (10 ms) | Gentle acknowledgement that the card stays in learning |
| Good | `medium` (20 ms) | Clear acknowledgement of normal progress |
| Known | `selection` (5 ms, 10 ms pause, 5 ms) | Distinct success cue for a mastered card |

The cue is emitted once per accepted grading action. While an SRS save is in flight the component ignores further grading actions, preventing duplicate vibration, duplicate session statistics, and duplicate persistence attempts.

Haptics are enhancement-only. Unsupported browsers, denied vibration access, storage failures, and runtime `navigator.vibrate` failures never block grading or SRS persistence. The visible grade labels, icons, progress, and completion state remain authoritative so no information is communicated by vibration alone.

## Preference and privacy behavior

`HapticFeedbackService` respects the existing `app_vibration_enabled` preference. An explicit stored `false` disables all vibration. Missing, malformed, or unreadable storage falls back to the historical enabled default, while `setEnabled()` still updates in-memory state if persistence is unavailable.

No flashcard text, translation, user identifier, SRS state, or other learner content is included in vibration calls or local-storage values. The only persisted value owned by the service is the boolean vibration preference.

## Failure handling

- No Vibration API: no-op.
- User disabled vibration: no-op.
- Browser throws from `navigator.vibrate`: swallowed; grading continues.
- `localStorage` read/write fails: use a safe in-memory/default preference; grading continues.
- SRS persistence fails or falls back offline: the already-accepted grading cue remains best-effort and the existing SRS recovery path owns persistence recovery.
- Repeated click/tap while a grade is saving: ignored by the existing `isSaving` guard, so only one cue is emitted.

## Verification

Automated coverage verifies:

- each generic haptic intensity maps to its bounded vibration pattern;
- Again, Good, and Known map to their intended semantic grading cues;
- stored opt-out suppresses vibration;
- malformed and unavailable storage are safe;
- Vibration API exceptions do not escape;
- flashcard grading emits exactly one matching cue and SRS update;
- persistence failures do not make haptics fatal;
- concurrent duplicate grading attempts do not emit duplicate cues;
- the review component's progress and RTL/accessibility contracts remain active.

The flashcard review component suite is no longer globally skipped, so the grading/haptic contract participates in normal frontend CI.

## Rollout and rollback

This is a client-only additive hardening change. It adds no schema, API, background-job, or server configuration dependency and is safe for mixed frontend versions.

Rollback consists of reverting the haptic service/test changes. Existing SRS data is unaffected because haptic feedback does not alter persistence semantics or stored flashcard records.
