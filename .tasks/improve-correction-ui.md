Priority: Medium Impact

Description:
Currently, the language correction feature (`correction-modal.component.html`) relies on a large modal dialog. This approach interrupts the user's conversational flow, forcing context switching away from the chat interface. Drawing inspiration from HelloTalk and HiNative, the correction UI should be more deeply integrated and frictionless. Moving towards inline, side-by-side editing within the chat context will significantly lower the barrier to providing helpful feedback.

Technical Implementation:
- **Inline Editing:** Instead of triggering a full-screen or large modal, implement correction capabilities directly within a contextual popover or an expanded area beneath the original message in `chat-view.component.ts`.
- **Tap-to-Correct (Visual Diff):** Enhance `visual-diff.component.ts` (which currently uses `Intl.Segmenter` to parse differences) to allow interactive editing. Users should be able to tap a specific word or sentence segment directly in the chat view to initiate a targeted replacement, without having to re-type the entire surrounding sentence.
- **Side-by-side View:** For longer texts, employ a split-pane or side-by-side text area layout using CSS Grid or Flexbox, ensuring the original text remains fully visible alongside the input field.
- **Audio Integration:** Increase the prominence and accessibility of the audio recording button near the text input area. Ensure it acts as a quick push-to-talk mechanism to encourage spontaneous spoken corrections or pronunciation feedback, styled distinctively (e.g., a floating action button or a brightly coloured inline icon).
