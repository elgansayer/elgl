Priority: High Impact

Description:
Enhance the language correction workflow to match the intuitive and multi-modal feedback loops seen in HelloTalk and HiNative. The goal is to make providing corrections faster, more descriptive, and accessible. Specifically, adding the ability for a native speaker to quickly record an audio pronunciation guide alongside their text correction is a vital pedagogical feature currently missing.

Technical Implementation:
- In `frontend/src/app/components/correction-modal/correction-modal.component.html`, modify the UI to include a dedicated voice recording button alongside or below the explanation input.
- Import and utilize the existing `VoiceRecorder` or `AudioRecorder` component into the `CorrectionModalComponent` and manage its resulting payload alongside the text correction submission.
- Review the `VisualDiff` component's styling (red strikethrough/green text) to ensure it meets WCAG AA color contrast guidelines against the dark `#121212` / `bg-surface-400` backgrounds. Adjust SCSS variables if necessary for better legibility (e.g., using a slightly lighter green and red).