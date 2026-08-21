<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Favourites Tab Component Specification

## Overview

A tab panel displaying bookmarked messages, corrections, and audio clips for study reference.

## Props / Inputs

- `userId`: string (required) - Current user's ID

## Outputs / Events

- `messageSelected`: emits `{ message: ChatMessage, roomId: string }` - Navigate to message in chat
- `removeFavourite`: emits `{ favouriteId: string }`

## States

1. **Loading**: Skeleton placeholders (3 rows of shimmer animation)
2. **Empty**: AppEmptyStateComponent with icon "📌", title "No favourites yet", description "Bookmark messages to study them later"
3. **Populated**: List of favourite items grouped by type
4. **Error**: Error message with retry button

## Visual Design

- **Tabs**: Three tab buttons at top: "Messages" (💬), "Corrections" (✏️), "Audio" (🎵)
  - Active tab: `bg-blue-600 text-white`
  - Inactive tab: `bg-gray-700 text-gray-300 hover:bg-gray-600`
- **List**: `flex flex-col gap-2 p-2`
- **Item card**: `bg-gray-800 rounded-xl p-3 border border-gray-700`
  - Header: type icon + timestamp, `text-xs text-gray-400`
  - Content: truncated preview (2 lines max)
  - Footer: "View in chat" link + remove button (X icon)
- **Correction items**: Show original (strikethrough) and corrected text side by side
- **Audio items**: Show play button + duration + transcript preview

## Behavior

- Fetches favourites from `GET /favourites?userId={userId}` on init
- Supports infinite scroll (20 items per page)
- Clicking "View in chat" emits `messageSelected` with room ID and message ID
- Removing favourite shows confirmation toast "Removed from favourites"
- Real-time updates via Centrifugo channel `user_{userId}_favourites`

## Accessibility

- `role="tablist"` on tab container
- `role="tab"` on each tab button with `aria-selected`
- `role="tabpanel"` on content area
- Keyboard: Left/Right arrows to switch tabs
- Focus management: Focus first item when tab changes

## Edge Cases

- Network failure during fetch: Show error state with retry
- Item deleted from original chat: Show "This message is no longer available" placeholder
- Rapid tab switching: Cancel previous request, debounce 300ms
- Empty category: Show category-specific empty state
