Priority: High Impact

Description:
The current chat implements a basic inline text correction (`text-xs line-through` vs `text-green-400 font-medium`). While functional, it isn't as robust or easy to parse as HelloTalk or HiNative, where corrections are highly structured. We need a side-by-side or clearly delineated top-bottom view for original vs. corrected text, making it obvious what changed.

Technical Implementation:
1.  **Correction UI Component:** Extract the inline correction logic in `ChatPageComponent` into a standalone, reusable `CorrectionMessageComponent` (presentational, `ChangeDetectionStrategy.OnPush`).
2.  **Diff Highlighting:** Instead of just crossing out the whole original sentence, implement a basic word-level diff. Use a utility function to compare the original and corrected strings and wrap added words in `<ins class="text-green-400 no-underline bg-green-900/30">` and removed words in `<del class="text-red-400 line-through bg-red-900/30">`.
3.  **Layout:** Display the diff prominently within a distinct card inside the message bubble. E.g., a dark inset panel (`bg-surface-300 rounded p-2`). If an explanation is provided, show it below a subtle divider.
4.  **Correction Input UI:** The current correction input is inline at the bottom of the chat. Move this to an anchored overlay/popover directly above or below the message being corrected, using `@angular/cdk/overlay`. This keeps context strictly tied to the message. Include an option to record an audio pronunciation of the correction.