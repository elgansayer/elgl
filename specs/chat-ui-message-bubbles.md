<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Message Bubbles Component Specification

## Overview

Renders individual chat messages with appropriate styling based on message type, sender, and status.

## Props / Inputs

- `message`: ChatMessage (required)
- `isOwn`: boolean (required)
- `showSender`: boolean (default false) - Show sender name/avatar (for group chats)
- `previousMessageFromSameSender`: boolean (default false) - Merge bubbles

## Sub-Components

- TextMessageBubble
- VoiceMessageBubble
- CorrectionMessageBubble
- DoodleMessageBubble
- GiftMessageBubble
- SystemMessageBubble (join/leave/rename)

## States

1. **Sent**: Normal display
2. **Pending**: Grey overlay with spinner (message not yet confirmed by server)
3. **Failed**: Red border with "Tap to retry" overlay
4. **Highlighted**: Yellow background flash (for newly arrived messages or search results)
5. **Selected**: Blue border for multi-select mode

## Visual Design

- **Own messages**: `self-end`, `bg-blue-600 text-white rounded-2xl rounded-br-md`
- **Other messages**: `self-start`, `bg-gray-700 text-gray-100 rounded-2xl rounded-bl-md`
- **Merged bubbles**: Remove rounded corner on merged side, reduce vertical gap to 2px
- **Sender info** (group): Avatar (24x24) + name above bubble, `text-xs text-gray-400`
- **Timestamp**: Below bubble, `text-[10px] text-gray-500`, right-aligned for own, left-aligned for others
- **Max width**: `max-w-[75%]` on desktop, `max-w-[85%]` on mobile

## Message Type Rendering

- **Text**: Plain text with auto-link detection, `whitespace-pre-wrap break-words`
- **Voice**: Play button + waveform thumbnail + duration, `bg-gray-600/50 rounded-xl p-2`
- **Correction**: Original text (strikethrough, red) → corrected text (green), explanation below
- **Doodle**: Image thumbnail, click to expand full-size
- **Gift**: Gift animation + "sent a gift" text, coin icon with value
- **System**: Centered, `text-xs text-gray-500 italic`, no bubble

## Behavior

- Auto-scroll to bottom on new message (unless user scrolled up)
- Click on voice message: Play/pause with progress bar
- Click on doodle: Open in lightbox overlay
- Click on gift: Play animation
- Long-press: Trigger context menu
- Double-click: Quick reply

## Accessibility

- `role="listitem"` on each bubble
- `aria-label` includes sender name and message preview
- Voice messages: `aria-label="Voice message, duration 14 seconds"`
- Keyboard: Tab to focus bubbles, Enter to interact

## Edge Cases

- Very long messages (> 500 chars): Show "Show more" link after 3 lines
- RTL text: Auto-detect and apply `dir="rtl"` to bubble content
- Deleted messages: Show "This message was deleted" placeholder
- Media loading failure: Show broken image icon with retry
- Date separator: Insert "Today", "Yesterday", or date header between messages from different days
