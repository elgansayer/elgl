<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Read Receipts Component Specification

## Overview

Shows delivery and read status indicators for sent messages, with detailed view of who has read the message.

## Props / Inputs

- `messageId`: string (required)
- `status`: 'sending' | 'sent' | 'delivered' | 'read' (required)
- `readBy`: ReadReceiptUser[] (optional) - Users who have read the message
- `isGroupChat`: boolean (default false)

## ReadReceiptUser Interface

```typescript
interface ReadReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  readAt: string; // ISO timestamp
}
```

## States

1. **Sending**: Grey clock icon ⏳
2. **Sent**: Grey checkmark ✓
3. **Delivered**: Grey double checkmark ✓✓
4. **Read**: Blue double checkmark ✓✓ (blue-400)
5. **Detailed**: On hover/click, shows tooltip/popover with list of readers

## Visual Design

- **Icon container**: `inline-flex items-center`, `w-4 h-4`
- **Single check**: `text-gray-400 text-xs`
- **Double check**: `text-gray-400 text-xs` (delivered), `text-blue-400 text-xs` (read)
- **Clock**: `text-gray-400 text-xs animate-pulse`
- **Tooltip**: `bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-xl`
  - Each reader: avatar + name + "Read 2m ago"
  - Max 5 shown, then "+3 more"

## Behavior

- Updates in real-time via Centrifugo channel `chat_{roomId}_receipts`
- On message sent: status transitions sending → sent
- On server delivery: sent → delivered
- On recipient opens chat: delivered → read (for 1-on-1)
- For group chats: shows count "Read by 5 of 12"
- Tooltip appears on hover (desktop) or tap (mobile)

## Accessibility

- `aria-label` changes based on status: "Sending", "Sent", "Delivered", "Read by 3 people"
- `role="status"` on icon
- Tooltip: `role="tooltip"` with `aria-describedby` on icon

## Edge Cases

- Message failed to send: Show red exclamation icon with "Tap to retry"
- User blocks sender: Show "delivered" only, never "read"
- User deleted message: Remove receipt tracking
- Group chat with 100+ members: Show "Read by 45" without listing all
