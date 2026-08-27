# Typing Indicator Specification

## Purpose

Show when other users in the chat are currently typing a message.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  [Avatar]  ● ● ●  John is typing...│
│                                     │
└─────────────────────────────────────┘
```

### Dimensions

- **Height**: 36px
- **Avatar size**: 24x24px (if showing specific user)
- **Dots**: 6x6px each, 4px gap
- **Text**: 13px

### Colour Scheme

- **Background**: Transparent (inherits from chat background)
- **Dots**: `bg-purple-400`
- **Text**: `text-slate-400`, 13px
- **Avatar border**: `ring-2 ring-purple-400` (if showing avatar)

### Typing Animation (Dots)

```css
@keyframes typingDot {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.dot-1 {
  animation: typingDot 1.4s ease-in-out infinite;
}
.dot-2 {
  animation: typingDot 1.4s ease-in-out 0.2s infinite;
}
.dot-3 {
  animation: typingDot 1.4s ease-in-out 0.4s infinite;
}
```

## States

### Hidden

- Not visible
- No users typing

### Single User

- Shows one avatar (or generic icon)
- "[Name] is typing..."
- Three animated dots

### Multiple Users

- Shows first avatar + "+2" badge
- "John and 2 others are typing..."
- Three animated dots

### Group Chat (Many Users)

- "Several people are typing..."
- No individual names shown
- Three animated dots

## Animations

### Appear

```css
@keyframes typingSlideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 150ms, ease-out */
```

### Disappear

```css
@keyframes typingSlideDown {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(10px);
  }
}
/* Duration: 150ms, ease-in */
```

### Dot Bounce

```css
/* Continuous animation while typing indicator is visible */
animation: typingDot 1.4s ease-in-out infinite;
```

## Accessibility

- `role="status"` with `aria-live="polite"`
- `aria-label="[Name] is typing"` or "Multiple users are typing"
- Screen reader announces when typing starts and stops
- No keyboard interaction needed (informational only)

## Edge Cases

- **User stops typing**: Remove indicator after 3 seconds of inactivity
- **User sends message**: Immediately remove indicator
- **Multiple users typing simultaneously**: Aggregate into single indicator
- **User blocked**: Don't show typing indicator from blocked users
- **Network delay**: Use heartbeat mechanism (every 3 seconds) to confirm still typing
