# Language corrections source audit

Scope: implementation and caller review. No timed usability study, tone assessment, translated-session test or end-to-end SRS persistence test was performed. The presence of a method or translation key does not demonstrate those outcomes.

## Authoring and presentation

`CorrectionModalComponent` pre-fills an editable correction from the source text and emits corrected text with an optional explanation. The existing chat-room authoring path also needs to be considered separately: PR #8921 proposes consolidating it into the shared modal. This audit does not mark that proposed change as shipped.

`VisualDiffComponent` uses Intl.Segmenter for multilingual token boundaries. That API does not guarantee minimal edits or fast rendering for arbitrary input lengths. PR #7632 bounds the proposed LCS implementation and adds long-input regressions; algorithm and performance claims must match the version actually deployed. Test CJK, Thai, punctuation, repeated words, whitespace and large messages.

## Translation and reuse

Static UI text uses the translation infrastructure. Explanation translation and flashcard creation are conditional component behaviours: callers must pass the explanation and enable the relevant action. Inspect each caller in chat messages, chat rooms, Moments, the correction modal and Favourites independently. Do not infer complete coverage from VisualDiff's API alone.

PR #7588 addresses missing explanation propagation in the correction modal preview. This source review therefore does not conclude that every surface is already complete. Existing inline chat authoring and shared-modal authoring also have different integration paths.

## Validation still required

- Measure the steps and time to create a correction, including cancellation and failure recovery.
- Review tone with learners and speakers of the target languages; positive-sounding translation keys alone do not establish neutrality.
- Exercise explanation translation success, failure, language changes and cache behaviour.
- Create an SRS card from each enabled surface and verify saved source, corrected text and explanation, including truncation limits and duplicate actions.
- Check semantic additions/removals with a screen reader, long text, RTL, high zoom and both themes.

These are validation requirements, not a claim that every item is broken or already complete.
