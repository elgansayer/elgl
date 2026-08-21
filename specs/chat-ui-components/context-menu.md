# Context Menu Specification

## Purpose

Provide quick actions for chat messages: reply, copy, edit, delete, forward, favourite, report, and more.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│ [💬] Reply                          │
│ [📋] Copy                           │
│ [✏️] Edit (own messages only)       │
│ [⭐] Add to Favourites              │
│ [🔗] Share                          │
│ [📨] Forward                        │
│ ─────────────────────────────────    │
│ [🗑️] Delete (own messages only)    │
│ [🚩] Report                         │
└─────────────────────────────────────┘
```

### Dimensions

- **Width**: 200px
- **Item height**: 40px
- **Divider**: 1px, `bg-slate-700`
- **Icon size**: 18x18px
- **Padding**: 8px horizontal, 0px vertical

### Colour Scheme

- **Background**: `bg-slate-800` (`#1e293b`)
- **Border**: `border border-slate-700`
- **Item text**: `text-slate-200`
- **Item hover**: `bg-slate-700`
- **Icon**: `text-slate-400`
- **Danger items** (Delete, Report): `text-red-400`, hover `bg-red-900/20`
- **Divider**: `border-t border-slate-700`

### Menu Items

| Action    | Icon | Visibility        | Description                    |
| --------- | ---- | ----------------- | ------------------------------ |
| Reply     | 💬   | Always            | Quote and reply to message     |
| Copy      | 📋   | Always            | Copy message text to clipboard |
| Edit      | ✏️   | Own messages only | Edit sent message              |
| Favourite | ⭐   | Always            | Add/remove from favourites     |
| Share     | 🔗   | Always            | Share message externally       |
| Forward   | 📨   | Always            | Forward to another chat        |
| Delete    | 🗑️   | Own messages only | Delete for everyone            |
| Report    | 🚩   | Other's messages  | Report inappropriate content   |

## States

### Default

- Menu positioned near the message bubble
- All applicable items visible
- Smooth entrance animation

### Hover

- Item background: `bg-slate-700`
- Icon colour brightens
- Cursor: pointer

### Active/Pressed

- Background: `bg-slate-600`
- Scale: `scale(0.98)`

### Disabled

- Opacity: 40%
- No hover effect
- Tooltip explains why (e.g., "Can't edit after 24 hours")

## Animations

### Menu Open

```css
@keyframes menuScaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
/* Duration: 150ms, ease-out */
/* Origin: bottom-right for own messages, bottom-left for others */
```

### Menu Close

```css
@keyframes menuScaleOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}
/* Duration: 100ms, ease-in */
```

### Item Hover

```css
transition: background-colour 100ms ease;
```

## Positioning

- **Own messages**: Right-aligned, below the bubble
- **Other messages**: Left-aligned, below the bubble
- **Near edges**: Flips to opposite side if near screen edge
- **Scroll**: Stays fixed position, doesn't scroll with chat

## Accessibility

- `role="menu"` on container
- `role="menuitem"` on each action
- `aria-label="[Action name]"` on each item
- Keyboard: Arrow keys to navigate, Enter to select, Escape to close
- Focus trap when menu is open
- `aria-expanded` on the trigger button

## Edge Cases

- **Message too close to screen edge**: Flip menu to opposite side
- **Long press on mobile**: Trigger context menu (300ms hold)
- **Multiple menus**: Close other menus when opening new one
- **Message deleted while menu open**: Close menu gracefully
- **Network offline**: Disable actions that require network (delete, report)
- **24-hour edit limit**: Disable edit button with tooltip
