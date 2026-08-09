<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Context Menu Component Specification

## Overview

A right-click (or long-press) context menu for chat messages with actions like reply, copy, edit, delete, favourite, report.

## Props / Inputs

- `message`: ChatMessage (required)
- `isOwnMessage`: boolean (required)
- `position`: { x: number, y: number } (required) - Menu position

## Outputs / Events

- `actionSelected`: emits `{ action: ContextMenuAction, message: ChatMessage }`
- `menuClosed`: emits void

## ContextMenuAction Type

```typescript
type ContextMenuAction =
  'reply' | 'copy' | 'edit' | 'delete' | 'favourite' | 'report' | 'translate' | 'speak';
```

## States

1. **Open**: Menu visible at cursor position
2. **Closing**: Fade-out animation (150ms)
3. **Action Feedback**: Brief visual feedback on selected action

## Visual Design

- **Container**: `bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[180px]`
- **Menu items**: `flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-700 cursor-pointer`
  - Icon (16x16) + label text
  - Danger items (delete, report): `text-red-400 hover:bg-red-900/30`
- **Divider**: `border-t border-gray-700 my-1`
- **Position**: Calculated to stay within viewport, flips if near edge

## Menu Items (Conditional)

- **Reply**: Always shown, icon ↩️
- **Copy text**: Only for text/correction messages, icon 📋
- **Edit**: Only for own messages within 5 minutes, icon ✏️
- **Delete**: Only for own messages, icon 🗑️ (red)
- **Favourite**: Always shown, icon ⭐ (filled if already favourited)
- **Report**: Always shown, icon 🚩 (red)
- **Translate**: For non-native language messages, icon 🌐
- **Speak**: For text messages, icon 🔊

## Behavior

- Closes on click outside, Escape key, or scroll
- Prevents default browser context menu on chat messages
- Long-press (500ms) on mobile triggers menu at touch position
- Action feedback: Brief toast "Message copied" or "Added to favourites"
- Delete requires confirmation dialog

## Accessibility

- `role="menu"` on container
- `role="menuitem"` on each item
- Keyboard navigation: Up/Down arrows, Enter to select, Escape to close
- Focus trap while menu is open
- `aria-label` on menu: "Message actions"

## Edge Cases

- Menu near viewport edge: Flip position (show above cursor if near bottom, show left if near right edge)
- Very long messages: Menu still shows at click position, not at message start
- Multiple menus: Close previous before opening new one
- Mobile vs desktop: Different trigger (long-press vs right-click)
