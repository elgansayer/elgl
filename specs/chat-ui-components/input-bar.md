# Input Bar Specification

## Purpose

Primary text input for composing and sending chat messages, with quick-access buttons for attachments, emoji, voice notes, and gifts.

## Visual Design

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [+]  [😊]  [🎤]  ┌──────────────────────────────────┐ [📎] │
│                    │ Type a message...                 │      │
│                    └──────────────────────────────────┘      │
│  [🎁]  [✏️]  [🔍]                                           │
└──────────────────────────────────────────────────────────────┘
```

### Dimensions

- **Height**: 56px (single line), expands to max 120px (3 lines)
- **Padding**: 8px horizontal, 8px vertical
- **Input field**: Flexible width, min 200px
- **Icon buttons**: 36x36px each
- **Send button**: 40x40px (appears when text is non-empty)

### Colour Scheme

- **Background**: `bg-slate-900` (`#0f172a`)
- **Border top**: `border-t border-slate-700`
- **Input background**: `bg-slate-800` (`#1e293b`)
- **Input text**: `text-slate-100` (`#f1f5f9`)
- **Input placeholder**: `text-slate-500` (`#64748b`)
- **Icon buttons**: `text-slate-400`, hover `text-slate-200`
- **Send button**: `bg-purple-600`, hover `bg-purple-700`, disabled `bg-slate-700`

### Typography

- **Input text**: 15px, `font-normal`
- **Placeholder**: 15px, `text-slate-500`
- **Character count**: 11px, `text-slate-500`, positioned bottom-right

## States

### Default (Empty)

- Placeholder text: "Type a message..."
- Send button hidden
- All accessory buttons visible

### Active (Focused)

- Input field: `ring-2 ring-purple-500/50`
- Border: `border-purple-500`
- Cursor: Blinking at insertion point

### Typing (Non-empty)

- Send button visible with scale-in animation
- Character count visible (if approaching limit)
- Placeholder hidden

### Disabled

- Opacity: 50%
- No interaction possible
- Cursor: `not-allowed`
- Placeholder: "Cannot send messages in this chat"

### Error

- Input border: `border-red-500`
- Error message below input: 12px, `text-red-400`
- Shake animation on the input bar

### Character Limit (500 characters)

- Counter turns yellow at 450 characters
- Counter turns red at 500 characters
- Input stops accepting new characters at 500
- Visual indicator: progress bar below input

## Animations

### Send Button Appear

```css
@keyframes sendButtonIn {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
/* Duration: 200ms, spring easing */
```

### Input Expand

```css
/* Smooth height transition */
transition: height 150ms ease;
```

### Send Animation

```css
@keyframes messageSent {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}
/* Applied to send button on click */
```

## Responsive Behavior

- **Mobile**: Full width, no padding on sides, smaller icon buttons (32x32px)
- **Tablet/Desktop**: Max width 768px, centered, standard sizing

## Accessibility

- `role="form"` on the input bar container
- `aria-label="Message input"` on the textarea
- Send button: `aria-label="Send message"`
- Voice button: `aria-label="Record voice message"`
- Emoji button: `aria-label="Open emoji picker"`
- Keyboard: Enter to send (Shift+Enter for new line)
- Focus trap when emoji picker or attachment menu is open

## Edge Cases

- **Very long messages**: Auto-expand to max 3 lines, then scroll
- **Paste images**: Detect clipboard image data, show preview
- **Mentions**: Type "@" triggers user search dropdown
- **Commands**: Type "/" shows available slash commands
- **Network offline**: Show offline indicator, queue message for sending
