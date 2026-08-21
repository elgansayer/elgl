# Emoji Picker Specification

## Purpose

Allow users to browse, search, and select emojis to insert into chat messages.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│ [🔍 Search emojis...          ]     │
├─────────────────────────────────────┤
│ [😊] [👍] [❤️] [🎉] [🔥] [💯] [✨] │ ← Recently used
├─────────────────────────────────────┤
│ [😊] [😄] [😃] [😀] [😅] [😂] [🤣] │ ← Category grid
│ [😇] [🙂] [🙃] [😉] [😌] [😍] [🥰] │
│ [😘] [😗] [😙] [😚] [😋] [😛] [😜] │
│ [🤪] [😝] [🤑] [🤗] [🤭] [🤫] [🤔] │
│ ...                                │
├─────────────────────────────────────┤
│ [😊] [👍] [❤️] [🎉] [🔥] [💯] [✨] │ ← Category tabs
└─────────────────────────────────────┘
```

### Dimensions

- **Width**: 320px (mobile), 360px (desktop)
- **Height**: 400px (max)
- **Emoji cell**: 36x36px
- **Grid columns**: 7 per row
- **Category tabs**: 40px height
- **Search bar**: 36px height

### Colour Scheme

- **Background**: `bg-slate-800` (`#1e293b`)
- **Border**: `border border-slate-700`
- **Search background**: `bg-slate-700`
- **Search text**: `text-slate-100`
- **Search placeholder**: `text-slate-400`
- **Emoji hover**: `bg-slate-700` rounded-lg
- **Category tab active**: `text-purple-400 border-b-2 border-purple-400`
- **Category tab inactive**: `text-slate-400`

### Typography

- **Emoji**: Native emoji rendering (system font)
- **Search**: 14px
- **Category label**: 11px, uppercase, `text-slate-500`, `font-semibold`

## States

### Default

- Shows recently used emojis at top
- First category selected
- Grid of emojis displayed

### Search Active

- Keyboard focus in search input
- Grid filters in real-time as user types
- "No results" empty state if no match
- Clear button (X) appears when search has text

### Hover (on emoji)

- Background: `bg-slate-700`
- Scale: `scale(1.2)`
- Transition: 100ms

### Selected (clicked)

- Scale animation: `scale(0.8)` then `scale(1)`
- Ripple effect on click
- Emoji inserted at cursor position in input
- Picker stays open (for multiple selections)

### Empty State (Search)

```
┌─────────────────────────────────────┐
│                                     │
│           🔍                        │
│     No emojis found                 │
│     Try a different search term     │
│                                     │
└─────────────────────────────────────┘
```

## Animations

### Picker Open

```css
@keyframes pickerSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
/* Duration: 200ms, ease-out */
```

### Emoji Hover

```css
transition:
  transform 100ms ease,
  background-colour 100ms ease;
```

### Category Switch

```css
/* Smooth scroll to category section */
scroll-behavior: smooth;
```

## Responsive Behavior

- **Mobile**: Full-width (100vw), positioned above keyboard, max-height 50vh
- **Tablet/Desktop**: Fixed width 360px, positioned above input bar

## Accessibility

- `role="dialog"` with `aria-label="Emoji picker"`
- `aria-roledescription="emoji picker"`
- Each emoji: `role="button"`, `aria-label="[emoji name]"`
- Keyboard navigation: Arrow keys to navigate grid, Enter to select
- Escape to close picker
- Focus trap within picker when open
- Search input auto-focused when picker opens

## Edge Cases

- **No recently used emojis**: Hide the recently used section
- **Search with no results**: Show empty state with suggestion
- **Skin tone modifiers**: Show skin tone picker on long-press of certain emojis
- **Emoji version differences**: Use native emoji rendering, no custom images
- **RTL**: Emoji picker remains LTR regardless of app direction
