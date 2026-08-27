<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Input Bar Component Specification

## Overview

The main message composition area at the bottom of the chat view, supporting text input, attachments, and message sending.

## Props / Inputs

- `roomId`: string (required)
- `placeholder`: string (default "Type a message...")
- `disabled`: boolean (default false)
- `replyToMessage`: ChatMessage | null (default null) - Message being replied to

## Outputs / Events

- `messageSent`: emits `{ type: string, content: any }`
- `attachmentTriggered`: emits `{ type: 'emoji' | 'gift' | 'doodle' | 'voice' | 'attachment' }`

## States

1. **Empty**: Placeholder text visible, send button disabled
2. **Typing**: Text entered, send button enabled, character count (if near limit)
3. **Reply Mode**: Reply preview bar above input, showing quoted message
4. **Recording**: Voice recorder replaces input area
5. **Disabled**: Grayed out, "You cannot send messages in this room" text

## Visual Design

- **Container**: `bg-gray-900 border-t border-gray-700 px-4 py-3`
- **Reply preview**: `bg-gray-800 rounded-t-lg px-3 py-2 flex items-center gap-2`
  - Quoted message preview (1 line, truncated)
  - Close button (X) to cancel reply
- **Input area**: `flex items-end gap-2`
- **Text input**: `flex-1 bg-gray-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-500 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none max-h-[120px]`
- **Attachment button**: Paperclip icon, `text-gray-400 hover:text-white`
- **Emoji button**: Smiley icon, `text-gray-400 hover:text-white`
- **Send button**: Arrow up icon in circle, `bg-blue-600 hover:bg-blue-500 text-white rounded-full w-9 h-9 flex items-center justify-center`, disabled when input empty
- **Voice button**: Microphone icon (when input empty), replaces send button

## Behavior

- Auto-resize textarea as user types (up to 4 lines)
- Enter sends message, Shift+Enter adds new line
- Ctrl+Enter or Cmd+Enter also sends
- Typing indicator: Emits typing event every 2 seconds while user is typing
- Character limit: 2000 characters, show counter at 1800
- Paste handling: Paste images triggers upload, paste text works normally
- Drop files: Drag-and-drop images into input area triggers upload

## Accessibility

- `role="form"` on container
- `aria-label="Message input"` on textarea
- Keyboard: Tab through all buttons, Enter to send
- Focus management: Auto-focus input when chat opens
- Screen reader: Announce reply mode when active

## Edge Cases

- Network offline: Show "No internet connection" warning, queue message for retry
- Message too long: Show character count in red, disable send
- Empty message with attachment: Send attachment without text
- Rapid sending: Debounce to prevent double-send (300ms)
- Input sanitization: Strip dangerous HTML/scripts
