# Provider terminal output and account health

Neptune issue621 was discovered while the existing shared factory reviewed
Elgl9789. Codex's retained error tail ends with a model-capacity error after
successful focused tests, but the shared breaker recorded authentication failure
and its configured six-hour auth cooldown. The tail contains no auth marker;
the generic classifier scanned the earlier complete verbose output. That complete
historical transcript was not retained, so the precise earlier marker is unknown.
An installed CLI login-status probe reported ChatGPT authentication; this does
not establish usable model capacity. Claude's actual weekly-limit message was
also classified as transport failure.

The adapters now select errors from provider envelopes. Code, issue text, tool
output and model-authored text are not account-health evidence.

| Adapter | Success evidence | Failure evidence |
| --- | --- | --- |
| Codex | Zero process exit and a complete JSONL turn ending in `turn.completed` | Typed outer `turn.failed`, or an otherwise-final `error` with failed process exit; startup stderr before JSONL |
| Claude | Zero exit and a typed JSON success result with `is_error=false` | Typed error result, execution errors or bounded recognised startup quota diagnostic |

Codex uses `exec --json`. The parser follows the
[official non-interactive interface](https://learn.chatgpt.com/docs/non-interactive-mode)
and the inspected [0.166.0 event definitions](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/exec/src/exec_events.rs).
The pinned [JSONL event processor](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs)
can emit an error notification before a later completed turn. The final turn
status owns the outcome; a recovered earlier error does not poison account health.
Claude uses `--output-format json`, following its
[headless interface](https://code.claude.com/docs/en/headless) and
[result-message reference](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage).
Configured safe mode, approval boundaries, models, reasoning, turn limits,
subscription authentication and outer process isolation remain in place.

The parser requires bounded complete output and rejects malformed/duplicate JSON,
missing terminal records, contradictory exit/status, truncated output and events
after a terminal turn. It ignores tool and agent text when classifying provider
errors, while retaining a redacted final agent summary. Cancellation, timeout,
crash and missing-executable results take precedence over partial transcripts.
Task turn/budget exhaustion remains a task failure, not account quota exhaustion.
Unknown error subtypes fail rather than becoming success. Other legacy text
providers retain their existing adapters and need separate protocol validation.

An explicit capacity message is retryable rate/overload evidence. The observed
weekly-limit diagnostic is quota evidence. Existing routing, retry/cooldown
settings, shared capacity and provider-health ownership determine the response.
The change does not reset a breaker, quota, allowance or account. Previously
recorded cooldowns are preserved; deployment alone is not proof of recovery.
Do not reauthenticate or change models merely because a transcript contained an
auth word, or treat a stored login as a successful inference.

Validation includes owned protocol fixtures, three old-source counterexamples
through the public adapter interface, actual installed CLI flag/startup probes
with network disabled and credentials absent, and mandatory namespace tests.
These probes invoke no model. Live review/recovery under the deployed adapter
remains separate acceptance. Existing failed jobs and their original evidence
stay resumable. The first local full-suite run hit Node's WebAssembly virtual
reservation under a3GiB address-space bound; the retained rerun uses
`--disable-wasm-trap-handler` and a512MiB Node heap with the same address bound.
No production limit was changed. The optional live-provider probes remain
explicitly opt-in; they are not substitutes for mandatory containment checks.
