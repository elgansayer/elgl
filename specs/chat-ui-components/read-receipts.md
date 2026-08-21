# Read Receipts Specification

## Purpose

Indicate the delivery and read status of sent messages.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│       ┌──────────────────┐          │
│       │ Message content  │          │
│       │ 12:34 PM    ✓    │          │ ← Sent (single check)
│       └──────────────────┘          │
│                                     │
│       ┌──────────────────┐          │
│       │ Message content  │          │
│       │ 12:35 PM    ✓✓   │          │ ← Delivered (double check)
│       └──────────────────┘          │
│                                     │
│       ┌──────────────────┐          │
│       │ Message content  │          │
│       │ 12:36 PM    ✓✓   │          │ ← Read (blue double check)
│       └──────────────────┘          │
│                                     │
└─────────────────────────────────────┘
```

### Icon Specifications

- **Sent**: Single checkmark ✓ (14x14px)
- **Delivered**: Double checkmark ✓✓ (14x14px)
- **Read**: Blue double checkmark ✓✓ (14x14px, `text-blue-400`)
- **Failed**: Red exclamation ! (14x14px, `text-red-400`)

### Colour Scheme

- **Sent**: `text-slate-500`
- **Delivered**: `text-slate-400`
- **Read**: `text-blue-400`
- **Failed**: `text-red-400`

### Positioning

- Right of timestamp
- 4px gap between timestamp and icon
- Aligned to bottom of bubble

## States

### Sending

- Spinner icon (rotating)
- No checkmark visible
- Opacity: 70%

### Sent

- Single gray checkmark
- "Sent" tooltip on hover

### Delivered

- Double gray checkmark
- "Delivered" tooltip on hover

### Read

- Double blue checkmark
- "Read" tooltip on hover
- Timestamp of when it was read (on hover)

### Failed

- Red exclamation icon
- "Tap to retry" tooltip
- Message bubble has red border

## Animations

### Status Transition

```css
@keyframes statusChange {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
/* Duration: 200ms, applied when status changes */
```

### Read Receipt Animation

```css
@keyframes readReceipt {
  0% {
    colour: #94a3b8;
  } /* slate-400 */
  100% {
    colour: #60a5fa;
  } /* blue-400 */
}
/* Duration: 300ms, smooth colour transition */
```

## Accessibility

- `aria-label="Message status: [sent/delivered/read/failed]"`
- Tooltip provides additional details on hover/focus
- Failed status: `role="button"`, `aria-label="Tap to retry sending"`
- Screen reader announces status changes

## Edge Cases

- **Group chats**: Show "Read by [number]" instead of individual receipts
- **Read receipts disabled**: Don't show read status, only delivered
- **User blocked**: Show as sent (not delivered)
- **Deleted account**: Show as delivered (cannot confirm read)
- **Privacy mode**: Respect user's read receipt privacy settings
