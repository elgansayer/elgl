# Voice Note Recorder Specification

## Purpose

Record, preview, and send voice messages up to 60 seconds in duration.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ████████████░░░░░░░░░░░░░░  │    │ ← Waveform visualization
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [🔙]      [⏹️]      [➡️]          │
│  Cancel    Record    Send           │
│                                     │
│           00:32 / 01:00             │ ← Timer
│                                     │
└─────────────────────────────────────┘
```

### Dimensions

- **Height**: 120px (recording), 100px (idle)
- **Width**: 100% of input bar area
- **Waveform height**: 48px
- **Button size**: 44x44px (minimum touch target)
- **Record button**: 56x56px (pulsing when recording)

### Colour Scheme

- **Background**: `bg-slate-900` (`#0f172a`)
- **Waveform**: `bg-purple-500` (recording), `bg-slate-600` (inactive)
- **Timer**: `text-slate-300`, 14px, `font-mono`
- **Record button**: `bg-red-500`, pulsing
- **Send button**: `bg-purple-600`, hover `bg-purple-700`
- **Cancel button**: `bg-slate-700`, hover `bg-slate-600`

## States

### Idle

- Microphone icon centered
- "Hold to record" text below
- No waveform visible

### Recording

- Waveform animating in real-time
- Timer counting up
- Record button pulsing red
- "Release to send" / "Swipe left to cancel" hint

### Recording (Locked)

- After swiping up: lock icon appears
- "Tap to stop recording" hint
- Waveform continues

### Preview

- Play button replaces record button
- Waveform shows recorded audio
- Timer shows duration
- Send and delete buttons visible

### Playing

- Play button becomes pause button
- Waveform animates with playback position
- Timer shows current position / total duration

### Error

- Red border
- Error message: "Recording failed. Please try again."
- Retry button

### Limit Reached (60 seconds)

- Auto-stop recording
- Haptic feedback (mobile)
- "Maximum duration reached" toast

## Animations

### Waveform Animation

```css
@keyframes waveformBounce {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 32px;
  }
}
/* Each bar has staggered delay */
```

### Record Button Pulse

```css
@keyframes recordPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(239, 68, 68, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}
/* Duration: 1.5s, infinite */
```

### Slide to Cancel

```css
/* Smooth translation of the entire recorder */
transition: transform 200ms ease;
```

## Accessibility

- `role="application"` with `aria-label="Voice note recorder"`
- Record button: `aria-label="Start recording"`
- Stop button: `aria-label="Stop recording"`
- Send button: `aria-label="Send voice note"`
- Cancel button: `aria-label="Cancel recording"`
- Live region for timer updates
- Haptic feedback on recording start/stop (mobile)

## Edge Cases

- **Microphone permission denied**: Show permission request dialog
- **Recording interrupted** (call incoming): Auto-save draft, show notification
- **Very short recording** (< 1 second): Show "Recording too short" warning
- **Background noise warning**: Show "Quiet environment recommended" hint
- **Storage full**: Show error message
