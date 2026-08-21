# Attachment Menu Specification

## Purpose

Provide quick access to media attachment options: camera, photo library, document, location sharing, and contact sharing.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ 📷   │  │ 🖼️  │  │ 📄   │      │
│  │Camera│  │Photos│  │Document│     │
│  └──────┘  └──────┘  └──────┘      │
│                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ 📍   │  │ 👤   │  │ 🎵   │      │
│  │Location│Contact│  │Audio │      │
│  └──────┘  └──────┘  └──────┘      │
│                                     │
└─────────────────────────────────────┘
```

### Dimensions

- **Width**: 280px (mobile), 320px (desktop)
- **Height**: Auto (based on content)
- **Grid**: 3 columns
- **Item size**: 80x80px (icon area), 80x100px (with label)
- **Icon size**: 32x32px
- **Padding**: 16px

### Colour Scheme

- **Background**: `bg-slate-800` (`#1e293b`)
- **Border**: `border border-slate-700`
- **Item background**: `bg-slate-700`, hover `bg-slate-600`
- **Icon**: `text-purple-400`
- **Label**: `text-slate-300`, 12px, `font-medium`

## States

### Default

- Grid of attachment options
- Each option has icon and label

### Hover

- Item background: `bg-slate-600`
- Scale: `scale(1.05)`
- Icon colour brightens

### Disabled

- Opacity: 40%
- Cursor: `not-allowed`
- Tooltip: "Permission required" or "Not available"

### Loading

- Spinner overlay on the selected option
- "Processing..." text below

## Animations

### Menu Open

```css
@keyframes menuScaleIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
/* Duration: 200ms, ease-out */
```

### Item Hover

```css
transition:
  transform 150ms ease,
  background-colour 150ms ease;
```

## Accessibility

- `role="menu"` on container
- `role="menuitem"` on each option
- `aria-label="[Action] - [Description]"` on each item
- Keyboard: Arrow keys to navigate, Enter to select, Escape to close
- Focus trap when menu is open

## Edge Cases

- **No camera available**: Hide or disable camera option
- **Permission denied**: Show error toast, disable relevant options
- **File too large**: Show error message with size limit
- **Unsupported file type**: Show error message
- **Multiple selection**: Allow up to 9 images/videos
