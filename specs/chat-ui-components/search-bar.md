# Search Bar Specification

## Purpose

Allow users to search through chat history by text content, message type, date range, and sender.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│ [🔙]  Search Messages               │ ← Header
├─────────────────────────────────────┤
│ ┌──────────────────────────────┐ [X]│ ← Search input
│ │ 🔍 Search in this chat...    │    │
│ └──────────────────────────────┘    │
├─────────────────────────────────────┤
│ Filters:                            │
│ [All] [Text] [Voice] [Corrections]  │ ← Type filter chips
│                                     │
│ [Any time] [Today] [This week] [Custom] │ ← Date filter
├─────────────────────────────────────┤
│ Results (3):                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💬 ...how **are** you...        │ │ ← Result with highlight
│ │ 👤 John Doe · 2 hours ago       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💬 Where **are** you from?      │ │
│ │ 👤 Jane Doe · Yesterday         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✏️ You **are** welcome          │ │ ← Correction result
│ │ 👤 System · 3 days ago          │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Dimensions

- **Full screen** on mobile, **modal** (500px width) on desktop
- **Search input**: 44px height
- **Filter chips**: 32px height
- **Result item**: Auto (min 64px)
- **Highlight padding**: 2px

### Colour Scheme

- **Background**: `bg-slate-900`
- **Search input background**: `bg-slate-800`
- **Search input border**: `border-slate-600`, focus `border-purple-500`
- **Filter chip active**: `bg-purple-600 text-white`
- **Filter chip inactive**: `bg-slate-700 text-slate-300`
- **Result background**: `bg-slate-800`, hover `bg-slate-750`
- **Highlight**: `bg-yellow-500/30 text-yellow-200`
- **Result count**: `text-slate-400`, 13px

## States

### Default (Empty)

- Search input focused
- Placeholder text visible
- No results shown
- Filter chips all inactive

### Typing

- Real-time search (debounced 300ms)
- Loading spinner in input
- Results update as user types

### Results Found

- Result count displayed
- Results listed with highlights
- Click result to navigate to message

### No Results

```
┌─────────────────────────────────────┐
│                                     │
│           🔍                         │
│     No messages found               │
│     Try different keywords          │
│                                     │
└─────────────────────────────────────┘
```

### Error

- Red border on input
- Error message: "Search failed. Please try again."
- Retry button

## Animations

### Search Debounce

```css
/* No visual animation, but 300ms delay before search executes */
```

### Results Appear

```css
@keyframes resultFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Staggered: 50ms delay per result */
```

### Highlight Pulse

```css
@keyframes highlightPulse {
  0%,
  100% {
    background-colour: rgba(234, 179, 8, 0.3);
  }
  50% {
    background-colour: rgba(234, 179, 8, 0.5);
  }
}
/* Applied to search term highlights */
```

## Accessibility

- `role="search"` on container
- `aria-label="Search messages"` on input
- Live region (`aria-live="polite"`) for result count updates
- Result items: `role="button"`, `aria-label="Message from [sender]: [preview]"`
- Keyboard: Enter to search, Escape to clear/close, Arrow keys to navigate results

## Edge Cases

- **Very long chat history**: Server-side search with pagination (20 results per page)
- **Special characters**: Escape regex special characters in search query
- **RTL search terms**: Handle RTL text in search
- **Deleted messages**: Exclude from search results
- **Media messages**: Search by filename or caption if available
