<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Chat Search Bar Component Specification

## Overview

A search interface for finding messages within the current chat room.

## Props / Inputs

- `roomId`: string (required)

## Outputs / Events

- `messageSelected`: emits `{ message: ChatMessage }`
- `searchClosed`: emits void

## States

1. **Closed**: Not visible
2. **Open - Empty**: Search input focused, no query yet
3. **Searching**: Loading spinner while fetching results
4. **Results**: List of matching messages
5. **No Results**: "No messages found" empty state
6. **Error**: Error message with retry

## Visual Design

- **Container**: `bg-gray-800 border-b border-gray-700 p-3`
- **Search input**: `w-full bg-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500`
  - Search icon: `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400`
  - Clear button: X icon, appears when query is not empty
- **Filter chips**: Below input, `flex gap-2 mt-2`
  - "All", "Text", "Voice", "Corrections", "Media"
  - Active: `bg-blue-600 text-white`
  - Inactive: `bg-gray-700 text-gray-300 hover:bg-gray-600`
- **Results list**: `max-h-60 overflow-y-auto`
  - Each result: `flex items-start gap-3 p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0`
  - Message preview: truncated to 2 lines
  - Type icon + timestamp
  - Highlighted matching text in yellow
- **Close button**: X icon in top-right corner

## Behavior

- Debounced search (300ms after user stops typing)
- Minimum 2 characters to trigger search
- Searches via `GET /chat/{roomId}/search?q={query}&type={filter}`
- Results sorted by relevance (most recent first for ties)
- Click result: emits `messageSelected`, closes search, scrolls to message in chat
- Clear button: Resets query and results
- Filter chips: Refine search by message type

## Accessibility

- `role="search"` on container
- `aria-label="Search messages"`
- `aria-live="polite"` on results count
- Keyboard: Escape to close, Enter to search, Arrow keys to navigate results
- Focus management: Auto-focus input on open

## Edge Cases

- Very long query (> 100 chars): Trim to 100 chars
- Special characters: Escape regex special characters for safe search
- No results for filter: Show "No {type} messages found"
- Network error: Show "Search failed" with retry button
- Rapid typing: Cancel previous request before sending new one
