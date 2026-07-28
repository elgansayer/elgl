# Chat UI Component Analysis

## Overview

This document analyzes the chat UI screenshots and documents all required UI components for the HelloTalk chat interface, mapping them to existing primitives and identifying gaps.

## Screenshot Analysis

### 1. Chat List View (Inbox)

**Required Components:**

- Chat list item (avatar, name, last message preview, timestamp, unread badge)
- Search bar for conversations
- Filter tabs (All, Unread, Groups)

**Existing Primitives Used:**

- `AppCardComponent` - for chat list items
- `AppPillComponent` - for unread count badges
- `AppInputComponent` - for search bar

**Gaps:**

- No dedicated chat list item component exists
- No conversation filter tabs component

### 2. Chat Message View

**Required Components:**

- Message bubble (sent/received variants)
- Text message with optional reply preview
- Voice note message with play button and waveform
- Correction message with original/fixed text
- Doodle/image message with thumbnail
- Timestamp separator
- Date header
- Typing indicator
- Read receipts

**Existing Primitives Used:**

- `AppCardComponent` - for message bubbles
- `AppPillComponent` - for correction badges
- `TextToSpeechComponent` - for voice playback

**Gaps:**

- No message bubble component with sent/received variants
- No voice note player component
- No correction display component
- No typing indicator component
- No date separator component

### 3. Chat Input Area

**Required Components:**

- Text input with emoji button
- Voice recording button (hold to record)
- Attachment button (image, doodle, file)
- Send button
- Gift button
- Reply preview bar

**Existing Primitives Used:**

- `AppInputComponent` - for text input
- `AppButtonPrimaryComponent` - for send button
- `AppButtonSecondaryComponent` - for attachment buttons

**Gaps:**

- No emoji picker integration component
- No voice recording UI component
- No reply preview bar component
- No gift picker trigger component

### 4. Chat Features

**Required Components:**

- Emoji picker (categories, search, recent)
- Gift picker (categories, coin cost display)
- Chat search (filter by type, date range)
- Favourites/bookmarks view
- Correction tool (select text, suggest correction)

**Existing Primitives Used:**

- `EmojiPickerComponent` - exists but needs integration
- `GiftPickerComponent` - exists but needs integration
- `ChatSearchComponent` - exists but needs refinement

**Gaps:**

- No correction tool component
- No favourites view component
- No date range filter for search

## Component Hierarchy

```
ChatContainer
├── ChatListPanel
│   ├── ChatSearchBar (AppInputComponent)
│   ├── ChatFilterTabs
│   └── ChatListItem[]
│       ├── AvatarComponent
│       ├── AppPillComponent (unread badge)
│       └── LastMessagePreview
├── ChatMessagePanel
│   ├── ChatHeader
│   │   ├── AvatarComponent
│   │   ├── UserName
│   │   └── OnlineStatus
│   ├── MessageList (virtual scroll)
│   │   ├── DateSeparator
│   │   ├── MessageBubble (sent/received)
│   │   │   ├── TextMessage
│   │   │   ├── VoiceNoteMessage
│   │   │   │   └── TextToSpeechComponent
│   │   │   ├── CorrectionMessage
│   │   │   ├── DoodleMessage
│   │   │   └── GiftMessage
│   │   ├── TypingIndicator
│   │   └── ReadReceipt
│   └── ChatInputArea
│       ├── ReplyPreviewBar
│       ├── TextInput (AppInputComponent)
│       ├── EmojiButton
│       │   └── EmojiPickerComponent
│       ├── VoiceRecordButton
│       ├── AttachmentButton
│       ├── GiftButton
│       │   └── GiftPickerComponent
│       └── SendButton (AppButtonPrimaryComponent)
└── ChatSearchPanel
    ├── SearchInput (AppInputComponent)
    ├── FilterByType (AppPillComponent)
    ├── DateRangeFilter
    └── SearchResults[]
        └── ChatMessage (highlighted)
```

## Required New Components

### 1. `ChatMessageBubbleComponent`

- **Inputs:** message (ChatMessage), isSent (boolean), showTimestamp (boolean)
- **Outputs:** reply, favourite, delete, report
- **States:** default, highlighted (search match), selected (multi-select)

### 2. `VoiceNotePlayerComponent`

- **Inputs:** audioUrl (string), duration (number), waveformData (number[])
- **Outputs:** play, pause, seek
- **States:** idle, playing, paused, loading

### 3. `CorrectionDisplayComponent`

- **Inputs:** original (string), corrected (string), explanation (string)
- **Outputs:** accept, reject, edit
- **States:** default, accepted, rejected

### 4. `TypingIndicatorComponent`

- **Inputs:** users (string[]) - list of typing user names
- **States:** idle, typing

### 5. `DateSeparatorComponent`

- **Inputs:** date (Date)
- **States:** today, yesterday, this week, older

### 6. `ReplyPreviewBarComponent`

- **Inputs:** message (ChatMessage)
- **Outputs:** cancel
- **States:** hidden, visible

### 7. `VoiceRecordButtonComponent`

- **Inputs:** maxDuration (number)
- **Outputs:** recordingComplete (Blob), recordingCancel
- **States:** idle, recording, processing

### 8. `ChatFilterTabsComponent`

- **Inputs:** tabs (string[]), selected (string)
- **Outputs:** tabChange
- **States:** default, active

## Integration Points

### Centrifugo Real-time Events

- `message:new` - New message received
- `message:read` - Message read receipt
- `typing:start` / `typing:stop` - Typing indicators
- `voice:recording` - Voice note status

### Backend API Endpoints

- `POST /chat/messages` - Send message
- `GET /chat/messages/:roomId` - Get messages (paginated)
- `POST /chat/favourites` - Add to favourites
- `GET /chat/search` - Search messages
- `POST /chat/corrections` - Submit correction

## Accessibility Requirements

- All interactive elements must have `aria-label`
- Message bubbles must have `role="log"` and `aria-live="polite"`
- Voice recorder must have `aria-label="Record voice message"`
- Emoji picker must be keyboard navigable
- All icons must have `aria-hidden="true"`

## Performance Considerations

- Virtual scrolling for message lists (use `@angular/cdk/scrolling`)
- Lazy load voice note waveforms
- Debounce search input (300ms)
- Cache emoji data locally
- Use `trackBy` for message list rendering
