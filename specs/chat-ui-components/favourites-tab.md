# Favourites Tab Specification

## Purpose

Display bookmarked messages, corrections, and audio clips for easy reference and study.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│ [🔙]  Favourites           [🔍]     │ ← Header
├─────────────────────────────────────┤
│ [All] [Messages] [Corrections] [Audio] │ ← Filter tabs
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💬 "I goes to school"          │ │ ← Favourite item
│ │ ✏️ "I go to school"            │ │
│ │ 📝 Subject-verb agreement      │ │
│ │ 📅 2 hours ago                 │ │
│ │ [🗑️] [📋]                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🎵 Voice note - 14s            │ │ ← Audio favourite
│ │ ▶️ [=====░░░░░░░]              │ │
│ │ 📅 Yesterday                    │ │
│ │ [🗑️] [📋]                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💬 "How are you?"              │ │ ← Message favourite
│ │ 👤 John Doe                     │ │
│ │ 📅 3 days ago                   │ │
│ │ [🗑️] [📋]                      │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Dimensions

- **Full screen** on mobile, **modal** (480px width) on desktop
- **Item height**: Auto (min 80px)
- **Item padding**: 12px
- **Filter tabs**: 44px height
- **Action buttons**: 32x32px

### Colour Scheme

- **Background**: `bg-slate-900`
- **Item background**: `bg-slate-800`, hover `bg-slate-750`
- **Item border**: `border border-slate-700`
- **Filter tab active**: `text-purple-400 border-b-2 border-purple-400`
- **Filter tab inactive**: `text-slate-400`
- **Type icon**: `text-purple-400`
- **Timestamp**: `text-slate-500`, 12px
- **Action buttons**: `text-slate-400`, hover `text-slate-200`

### Item Types

1. **Messages**: 💬 icon, message text preview, sender name, timestamp
2. **Corrections**: ✏️ icon, original text (strikethrough), corrected text, explanation
3. **Audio**: 🎵 icon, play button with waveform, duration, timestamp

## States

### Default

- Shows all favourites sorted by date (newest first)
- "All" filter selected
- Empty state if no favourites

### Filtered

- Shows only selected type
- Active filter tab highlighted
- Smooth transition between filters

### Empty State

```
┌─────────────────────────────────────┐
│                                     │
│           ⭐                         │
│     No favourites yet               │
│     Long-press on a message         │
│     to add it to favourites         │
│                                     │
└─────────────────────────────────────┘
```

### Hover (on item)

- Background: `bg-slate-750`
- Slight scale: `scale(1.01)`
- Action buttons become fully visible

### Playing Audio

- Play button becomes pause button
- Waveform animates
- Progress indicator moves

## Animations

### Item Entry

```css
@keyframes itemSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
/* Staggered delay for each item */
```

### Filter Switch

```css
transition: opacity 150ms ease;
/* Items fade out, new items fade in */
```

### Delete Item

```css
@keyframes itemDelete {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
/* Duration: 200ms */
```

## Accessibility

- `role="list"` on items container
- `role="listitem"` on each favourite
- `aria-label="Favourite [type]: [preview]"` on each item
- Filter tabs: `role="tab"`, `aria-selected`
- Delete button: `aria-label="Remove from favourites"`
- Copy button: `aria-label="Copy to clipboard"`

## Edge Cases

- **No favourites**: Show helpful empty state with instructions
- **Very long notes**: Truncate with "..." and "Show more" link
- **Deleted original message**: Show "Original message deleted" with grey text
- **User blocked**: Hide favourites from blocked user
- **Sync across devices**: Real-time update via Centrifugo
