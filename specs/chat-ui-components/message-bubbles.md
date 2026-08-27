# Message Bubbles Specification

## Purpose

Display chat messages with support for text, voice, corrections, doodles, and gifts. Bubbles differentiate between own messages and other users' messages.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  [Avatar]  ┌──────────────────┐     │  ← Other user's message
│            │ Message content  │     │     (left-aligned)
│            │ 12:34 PM         │     │
│            └──────────────────┘     │
│                                     │
│       ┌──────────────────┐ [Avatar] │  ← Own message
│       │ Message content  │          │     (right-aligned)
│       │ 12:34 PM    ✓✓   │          │
│       └──────────────────┘          │
│                                     │
└─────────────────────────────────────┘
```

### Dimensions

- **Max width**: 75% of container (70% on mobile)
- **Min width**: 48px (single emoji)
- **Avatar size**: 32x32px (rounded-full)
- **Avatar margin**: 8px from bubble
- **Timestamp**: 11px, text-muted, right-aligned
- **Read receipt**: 14x14px icon, positioned right of timestamp

### Colour Scheme

- **Own bubble**: `bg-purple-600` (`#7c3aed`), `text-white`
- **Other bubble**: `bg-slate-800` (`#1e293b`), `text-slate-100`
- **Correction bubble**: `bg-amber-900/40` with `border-l-4 border-amber-400`
- **Voice bubble**: `bg-indigo-900/40` with waveform visualization
- **Gift bubble**: `bg-gradient-to-r from-pink-600 to-purple-600` with sparkle overlay

### Typography

- **Message text**: 15px, `font-normal`, `leading-relaxed`
- **Sender name** (group chats only): 12px, `font-semibold`, `text-purple-400`
- **Timestamp**: 11px, `text-slate-400`
- **Correction original**: 13px, `line-through`, `text-red-400`
- **Correction fixed**: 13px, `font-semibold`, `text-green-400`

### Border Radius

- **Own bubble**: `rounded-2xl rounded-br-sm` (bottom-right slightly flattened)
- **Other bubble**: `rounded-2xl rounded-bl-sm` (bottom-left slightly flattened)
- **Correction bubble**: `rounded-2xl` with left border accent

## States

### Default

- Solid background with proper border radius
- Timestamp visible
- Read receipt icon (if own message)

### Hover

- Slight scale transform: `scale(1.01)`
- Background opacity increases by 5%
- Timestamp becomes more opaque
- Context menu trigger appears (three dots icon)

### Active/Pressed

- Scale: `scale(0.98)`
- Background darkens by 10%

### Selected (for multi-select)

- `ring-2 ring-purple-400`
- Checkbox overlay in top-left corner
- Background tint: `bg-purple-900/20`

### Loading (sending)

- Opacity: 70%
- Pulsing animation on the bubble
- Spinner icon replacing timestamp
- "Sending..." text in muted colour

### Error (failed to send)

- `border-2 border-red-500`
- Red exclamation icon in top-right
- "Tap to retry" hint on hover
- Background: `bg-red-900/20`

### Deleted

- Italic text: "This message was deleted"
- Opacity: 50%
- No avatar or timestamp shown

## Animations

### Message Entry

```css
@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
/* Duration: 200ms, Easing: ease-out */
```

### Typing Indicator Entry

```css
@keyframes typingFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 150ms */
```

## Responsive Behavior

- **Mobile (< 640px)**: Max width 70%, smaller padding (8px), smaller font (14px)
- **Tablet (640-1024px)**: Max width 70%, standard padding (12px)
- **Desktop (> 1024px)**: Max width 65%, standard padding (12px), hover effects enabled

## Accessibility

- `role="listitem"` on each bubble
- `aria-label="Message from [sender] at [time]"`
- Correction bubbles: `aria-label="Correction: [original] corrected to [fixed]"`
- Voice bubbles: `aria-label="Voice message, [duration] seconds"`
- Keyboard: Enter to open context menu, Escape to close
- Focus visible ring on interactive elements

## Edge Cases

- **Long messages**: Word-break with `overflow-wrap: break-word`, max-height with scroll for extremely long content
- **Single emoji**: Enlarged to 48px font size, centered
- **URLs**: Auto-detected and rendered as clickable links (`text-violet-400 underline`)
- **RTL text**: Auto-detected via Unicode ranges, `dir="auto"` on bubble content
- **Deleted user**: Avatar shows default silhouette, name shows "Deleted User"
- **Blocked user**: Messages hidden with "You blocked this user" placeholder
