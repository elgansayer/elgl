<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Emoji Picker Component Specification

## Overview

A searchable emoji picker for inserting emojis into chat messages.

## Props / Inputs

- `isOpen`: boolean (required)

## Outputs / Events

- `emojiSelected`: emits `{ emoji: string }`
- `pickerClosed`: emits void

## States

1. **Closed**: Not rendered
2. **Open**: Picker visible with categories and search
3. **Searching**: Filtered results based on search query
4. **Empty Search**: "No emojis found" message

## Visual Design

- **Container**: `bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-72 max-h-80`
- **Search input**: `w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500`
- **Category tabs**: Horizontal scrollable row, `flex gap-1 p-2 border-b border-gray-700`
  - Each tab: emoji icon, `w-8 h-8 rounded-lg hover:bg-gray-700`, active: `bg-gray-700 ring-1 ring-gray-600`
- **Emoji grid**: `grid grid-cols-8 gap-1 p-2 overflow-y-auto max-h-52`
  - Each emoji: `w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-700 rounded cursor-pointer`
- **Category label**: `text-xs text-gray-500 font-semibold px-2 pt-2 pb-1`

## Categories

Smileys, People, Animals, Food, Travel, Activities, Objects, Symbols, Flags

## Behavior

- Search filters emojis by name (using emoji data with keywords)
- Click emoji: emits emoji character, keeps picker open for multiple selections
- Click outside or Escape: closes picker
- Category scroll sync: Active category updates as user scrolls
- Recently used: First category shows 20 most recently used emojis (stored in localStorage)

## Accessibility

- `role="dialog"` on container
- `aria-label="Emoji picker"`
- `role="tablist"` on categories
- `role="tab"` on each category with `aria-selected`
- `role="grid"` on emoji grid
- `aria-label` on each emoji button with emoji name
- Keyboard: Arrow keys to navigate grid, Enter to select, Escape to close

## Edge Cases

- Very long search (> 20 chars): Trim to 20 chars
- No results: Show "No emojis found for '{query}'"
- Performance with 1000+ emojis: Virtual scroll or lazy render categories
- RTL support: Grid remains LTR, search input respects dir
