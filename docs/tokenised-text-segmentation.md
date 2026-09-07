# Tokenised text segmentation

`TokenisedTextComponent` is the shared browser-side word-token rendering boundary used by chat, Moments, and learning surfaces. It implements the contract tracked by #1336.

## Runtime contract

The component segments source text with the browser's native `Intl.Segmenter` API using `granularity: 'word'`. Each returned segment preserves its source index and `isWordLike` flag. Only word-like segments become interactive vocabulary tokens; whitespace and punctuation remain ordinary text.

Word-like tokens are keyboard focusable and can be activated with click, Enter, or Space. Activation emits the selected token plus the complete source context to the parent. Vocabulary status styling is additive and is not the only indication that the token is actionable: interactive segments also expose button semantics and keyboard focus.

The source text container uses `dir="auto"`, allowing mixed left-to-right and right-to-left content to inherit direction from the text itself without changing the explicit left-to-right transliteration line.

## Failure and compatibility behaviour

Token rendering must not make a chat message, Moment, or lesson unreadable because a browser capability is missing.

- If the requested locale cannot construct an `Intl.Segmenter`, tokenisation retries with the runtime's default locale.
- If `Intl.Segmenter` is unavailable, or segmentation still fails, the exact original text is rendered as one non-interactive segment. The component does not guess word boundaries with a regex fallback.
- Transliteration is progressive enhancement. A transliteration failure suppresses that secondary line but does not suppress or crash the source text.
- Empty input produces no token nodes.

The fallback intentionally disables vocabulary clicks because treating an unsegmented sentence as one word could create incorrect dictionary/SRS requests.

## Privacy and security

Segmentation and transliteration orchestration are local component operations. Tokenisation itself performs no network request, persistence, logging, or analytics and does not add user text to diagnostics. A word activation only emits data to the owning Angular surface; any downstream dictionary, translation, or flashcard operation remains subject to its existing authenticated API boundary and input limits.

Selected-text flashcard creation continues to use the existing bounded context-menu contract. This change does not widen the persisted selection, context, or translation limits.

## Performance

The component performs segmentation inside an Angular `computed`, so results are reused until source text, language, or a reactive dependency changes. `Intl.Segmenter` is constructed only for an actual tokenisation pass, and no network dependency is introduced into message rendering.

## Verification

`frontend/src/app/components/tokenised-text/tokenised-text.component.spec.ts` covers:

- English word, whitespace, and source-index segmentation;
- non-Latin segmentation;
- missing-Segmenter text preservation;
- invalid-locale fallback;
- interactive versus non-interactive token semantics;
- click, Enter, and Space activation;
- source-context emission; and
- transliteration failure isolation.

The component remains part of the normal frontend unit, static-analysis, build, translation-safety, and repository CI gates.

## Rollout and rollback

There is no schema, API, stored-data, or backend rollout dependency. Deploy as a normal frontend release. Mixed frontend versions are safe because the component's input/output contract is unchanged.

Rollback is a normal revert of the component and regression-test changes. No data repair or migration rollback is required.
