# AI grammar checker pre-send contract

Issues #1343 and #1698 describe the same capability as #979. Behaviour, the API contract, failure handling, observability, accessibility, verification, rollout and known limits are documented once, in [`grammar-check-pre-send.md`](grammar-check-pre-send.md). This file only records the product boundary, so the behaviour is not split across competing services again.

## Product boundary

- `POST /nlp/grammar-check` is the single backend grammar-check boundary and `GrammarCheckService` is its only implementation. Do not add a second grammar path, and do not fall back to a fabricated "your text appears correct" result when a provider is missing.
- A changed sentence is returned to the existing editable composer and the learner reviews it before anything is sent. Provider suggestions are never transmitted automatically. Chat and Moments share the same review model.
- The checker is advisory. An unavailable provider, a spent quota or a failed request degrades to sending the learner's own wording, so chat and Moments never depend on an AI provider being up.
- Grammar text is private: `Cache-Control: private, no-store`, never persisted, and never written to logs. Authentication, the per-minute limit and the daily AI quota stay in front of the provider call.

If the grammar provider or quota policy changes later, preserve the authenticated `/nlp/grammar-check` boundary and the explicit learner-review step unless a separately approved product change replaces this contract.
