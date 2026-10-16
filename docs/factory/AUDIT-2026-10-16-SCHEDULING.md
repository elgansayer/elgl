# Factory scheduling follow-up - 16 October 2026

The live daemon reported three active jobs, one free worker and zero provider
slots while an Angular build owned the exclusive host gate. A CI-green critical
Factory PR could not advance its CI state until those builds released the gate.

The scheduler now permits one free worker to poll CI, merge an approved head or
record a completed merge during exclusive verification. It filters this lane to
`CI_PENDING`, `MERGE_QUEUED` and `MERGED`; implementation, review and repair work
remain subject to provider capacity. Any changed head that requires verification
still acquires the existing exclusive gate. Pause, storage reserve, exact-head
review, required CI, serial merge and GitHub branch rules remain enforced.

Regression coverage also exposed an existing admission error: with one worker
free and three review lanes configured, `select_batch` returned three PRs. Cap
review selection at the smaller of review capacity and remaining worker capacity
so queued work cannot exceed the advertised worker envelope.

Validation covers a saturated verifier with three active review jobs, CI/merge
progress in the remaining worker, exclusion of provider-backed states, unchanged
normal selection and bounded review admission. The full Factory pytest suite,
Ruff formatting/lint and mypy also pass.

The online host diagnostic separately found an obsolete optional OpenCode API
model. The authenticated catalogue exposes `deepseek-v4.1-flash`, replacing the
old `deepseek-v4-flash` setting in the host's common environment. After that
configuration correction, `doctor --online` passed all required checks. Claude
and Codex are usable; Google and Pi remain governed by their recovery circuits.

## Model-specific routing evidence

The adaptive router combined every model's history for a provider. Claude's
retired Haiku review route had 64 failures, while Sonnet had 58 successful reviews
out of 58. Aggregation penalised the working Sonnet route. Conversely, Google's
240 successful reviews on a retired Gemini model promoted its unproven
replacement ahead of Sonnet. Score only the model currently configured for each
phase. Preserve historical metrics for reporting and existing fallback behaviour.
Regression cases cover both independent review and implementation.
