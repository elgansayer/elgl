<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Typing Indicator Component Specification

## Overview

Displays animated dots showing which users are currently typing in the chat room.

## Props / Inputs

- `typingUsers`: TypingUser[] (required) - Array of users currently typing
- `maxVisible`: number (default 3) - Maximum avatars to show before "+N more"

## TypingUser Interface

```typescript
interface TypingUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}
```

## States

1. **Hidden**: No users typing, component not rendered
2. **Single**: One user typing, shows "Alice is typing..."
3. **Multiple**: 2-3 users, shows "Alice, Bob are typing..."
4. **Many**: 4+ users, shows "Alice, Bob and 2 others are typing..."
5. **Animated**: Three bouncing dots animation

## Visual Design

- **Container**: `flex items-center gap-2 px-4 py-1.5 bg-gray-800/80 rounded-t-lg`
- **Avatars**: `w-5 h-5 rounded-full ring-2 ring-gray-700` overlapping slightly
- **Text**: `text-xs text-gray-400 italic`
- **Dots animation**: Three dots with staggered bounce animation
  - `@keyframes typingBounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-4px) } }`
  - Each dot has `animation-delay: 0ms, 150ms, 300ms`

## Behavior

- Subscribes to Centrifugo channel `chat_{roomId}_typing`
- Updates `typingUsers` signal with 3-second debounce (user stops typing after 3s of no update)
- Component auto-hides when array is empty
- Throttles own typing events to 1 per 2 seconds

## Accessibility

- `aria-live="polite"` for screen reader announcements
- `role="status"` on container
- Announce text: "Alice is typing" or "Multiple users are typing"

## Edge Cases

- User leaves room while typing: Remove from list immediately via disconnect event
- Rapid typing on/off: Debounce to prevent flicker
- 100+ users typing: Show "Many people are typing" without listing names
- Own typing indicator: Don't show self in the list
