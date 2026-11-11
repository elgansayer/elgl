# LLM prompt-injection protection

## Decision

Every AI-backed tool treats user, partner and provider content as data, never as
instructions. The protection is structural and shared: callers build messages
with `backend/src/llm-guard/prompt-guard.ts`, and both provider clients run the
same hardening gate before any HTTP request.

Duplicate prompt handling is not permitted. A new AI feature composes the
existing builders and screeners instead of adding its own delimiter scheme.

## Threat model

| Source | Trust | Example |
|---|---|---|
| Application instructions | trusted | tutor persona, JSON output contract |
| Requester text | untrusted data | learner message, text to simplify |
| Other people's text | untrusted data | partner profile, chat transcript, audio room captions |
| Client-supplied history | untrusted data | `role` and `content` from the browser |
| Model output | untrusted data | explanation, summary, translation, report |

An attacker may control any untrusted row. The goal is to stop that text from
changing the task, revealing the system prompt or credentials, publishing a
link, or becoming active markup for another user.

## Structural rules

1. Instructions and data never share a message. Trusted instructions are static
   strings in the system message; untrusted values travel as one JSON document
   in the user message, or as real conversation turns for conversational tools.
2. Only application code creates a system message. Client history is reduced to
   bounded user and assistant turns; any other role is dropped.
3. Invisible characters and model control tokens are removed from everything
   that reaches the provider. Zero-width joiners, non-joiners and direction
   marks that legitimate scripts need are preserved.
4. Third-party strings carrying a strong injection signal are withheld and
   replaced with a fixed placeholder. Requester-owned text is preserved but the
   signal is counted.
5. Model output is screened before it is stored or shown. Hidden characters,
   active HTML, and links that did not appear in the source are removed.

## Shared API

`untrusted-text.ts` provides the pure primitives:

- `sanitiseUntrustedText` normalises line endings, removes hidden characters and
  defuses model control tokens under a length limit.
- `detectInjectionSignals` reports a closed set of categories and never returns
  the matched text.
- `encodeUntrustedData` serialises data as escaped JSON so no value can close a
  quote, add a newline or forge a delimiter.
- `screenModelOutput` cleans stored or displayed model output.
- `summary-output.ts` parses the shared summary and vocabulary JSON contract.

`prompt-guard.ts` provides the builders and the last line of defence:

- `buildDataPrompt` for tools that process user or third-party content.
- `buildConversationPrompt` for tools where the learner's turns are the
  conversation.
- `hardenMessages` validates structure, roles, size and sanitisation even when a
  caller bypassed the builders.
- `requireScreenedReply` rejects an unusable model reply with a 502.

A private `WeakMap` registers prompts created by the builders. Copying or editing
a messages array drops that registration, so the provider client treats it as
`unguarded` and reports it. Telemetry therefore detects a new AI tool that forgot
the guard.

## Covered tools

| Tool label | Surface |
|---|---|
| `ai_conversation` | scenario-based AI conversation reply |
| `ai_partner_reply` | AI reply in a chat room |
| `audio_room_archive_summary` | archived audio room transcript summary |
| `audio_room_session_summary` | live audio room session summary |
| `chat_correction_explanation` | correction explanation in chat |
| `chat_llm_proxy` | conversation partner proxy |
| `conversation_starters` | partner-specific starter questions |
| `daily_tip` | scheduled daily learning tip |
| `flashcard_context` | vocabulary example sentences |
| `grammar_check` | pre-send grammar check |
| `grammar_explanation` | grammar explanation |
| `message_simplify` | message simplification |
| `message_translate` | translation |
| `premium_conversation_report` | premium AI conversation report |
| `session_summary` | audio room summary through the NLP service |
| `suggested_replies` | chat reply suggestions |

Provider clients: `LlmProxyService` and `ChatLlmService`. Both should be reached
through the builders. `unguarded` is a telemetry label, not an accepted mode.

## Failure behaviour

- A malformed, empty, oversized or misordered prompt throws `PromptGuardError`
  before a provider request is made. The error message is fixed and does not
  repeat the offending text.
- A rejected provider response becomes a 502 when the feature has no safe
  fallback.
- Features with deterministic fallbacks (conversation starters, daily tips,
  grammar explanations, summaries, premium reports) fall back locally instead of
  showing a failure.
- Telemetry failures are swallowed. They must never turn a working AI request
  into an error.

## Observability

`ProviderPromptGate` emits one structured warning per finding and increments the
`hellotalk_llm_prompt_guard_events_total` counter with bounded `tool` and
`event` labels. Recorded events are categories and counts only:

- `signal_<category>` for each detected injection signal;
- `quarantined`, `history_dropped`, `sanitised`;
- `rejected_<reason>` for a rejected prompt;
- `unguarded_call` for a provider request that bypassed the builders.

The prompt, matched text, provider response and user identifiers are never
logged or used as metric labels.

Example warning:

```json
{
  "event": "llm_prompt_guard_finding",
  "client": "chat_llm",
  "tool": "message_simplify",
  "signals": ["instruction_override"],
  "quarantined": 0,
  "droppedHistoryEntries": 0,
  "sanitised": 0
}
```

Alert on a sustained rise in `unguarded_call`, `rejected_too_large` or
`quarantined`: they indicate a new tool that missed the guard, an oversized
payload, or attempted injection.

## Testing

Tests live beside the implementation:

- `prompt-guard.spec.ts` covers separation of instructions and data, delimiter
  breakout attempts, hidden characters, third-party quarantine, size limits and
  immutability.
- `untrusted-text.spec.ts` covers multilingual preservation, control-token
  defusing, signal detection, output screening and bounded-time behaviour on
  adversarial input.
- `provider-prompt-gate.spec.ts` covers telemetry, redaction and failure
  isolation.
- `summary-output.spec.ts` covers the summary contract and link removal.
- Each migrated tool has a service spec asserting the new call shape and its
  fallback path.

## Rollout and rollback

This change is backward compatible at the API boundary: endpoint routes and
response shapes are unchanged. Prompt construction changes internally, and model
wording may change slightly.

To roll out, deploy the backend normally. The guard is always on; there is no
feature flag that disables it. If a tool produces unusable output, fix its
instructions or fallback rather than bypassing the gate.

To roll back, revert the guard commit. That restores the previous prompt strings
and removes the counter and log lines. No database migration is involved, so
there is no data rollback.
