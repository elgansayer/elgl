# Chat UI Component Specifications

## 1. Message Bubbles

### Container
- **Max width:** 75% of chat container
- **Border radius:** 16px (rounded-2xl) with 4px tail on sender side
- **Padding:** 12px 16px (p-3 px-4)
- **Margin bottom:** 8px between messages
- **Animation:** Fade in + slide up 4px over 200ms ease-out

### Sent Messages (right-aligned)
- **Background:** `bg-indigo-600` (hex #4F46E5)
- **Text color:** `text-white`
- **Tail:** Right side, 8px triangle using `::after` pseudo-element
- **Shadow:** `shadow-md`

### Received Messages (left-aligned)
- **Background:** `bg-gray-700` (hex #374151)
- **Text color:** `text-gray-100`
- **Tail:** Left side, 8px triangle
- **Shadow:** `shadow-sm`

### Timestamp
- **Font size:** 10px (text-[10px])
- **Color:** `text-gray-400` for sent, `text-gray-500` for received
- **Position:** Below message, 4px gap
- **Format:** HH:MM for today, "Mon HH:MM" for this week, "DD Mon HH:MM" for older

### Read Receipt
- **Icon:** Double checkmark (✓✓) using SVG
- **Size:** 12x12px
- **Color:** `text-indigo-300` when read, `text-gray-500` when delivered
- **Position:** Right of timestamp, 4px left margin

### Sender Name (group chats only)
- **Font size:** 11px (text-xs)
- **Font weight:** 600 (font-semibold)
- **Color:** `text-indigo-400`
- **Position:** Above message bubble, 2px bottom margin

---

## 2. Input Bar

### Container
- **Height:** 56px (h-14)
- **Background:** `bg-gray-800` (hex #1F2937)
- **Border top:** 1px solid `border-gray-700`
- **Padding:** 8px 12px (p-2 px-3)
- **Position:** Fixed at bottom of chat view

### Text Input
- **Height:** 40px (h-10)
- **Background:** `bg-gray-700`
- **Border radius:** 20px (rounded-full)
- **Padding:** 0 16px (px-4)
- **Font size:** 14px (text-sm)
- **Color:** `text-white`
- **Placeholder:** `text-gray-400`, "Type a message..."
- **Max lines:** 4 (auto-expand)
- **Focus ring:** `ring-1 ring-indigo-500`

### Action Buttons (left side)
- **Size:** 36x36px
- **Border radius:** 50% (rounded-full)
- **Background:** Transparent, `hover:bg-gray-700`
- **Icons:** 20x20px SVG
- **Order:** Emoji picker → Attachment menu → Voice note

### Send Button (right side)
- **Size:** 36x36px
- **Border radius:** 50% (rounded-full)
- **Background:** `bg-indigo-600`, `hover:bg-indigo-500`
- **Disabled:** `bg-gray-600`, `cursor-not-allowed`
- **Icon:** 18x18px send arrow SVG
- **Visible only when text input has content**

---

## 3. Emoji Picker

### Container
- **Width:** 288px (w-72)
- **Max height:** 320px (max-h-80)
- **Background:** `bg-gray-800`
- **Border:** 1px solid `border-gray-700`
- **Border radius:** 12px (rounded-xl)
- **Shadow:** `shadow-2xl`
- **Position:** Absolute above input bar, 8px gap

### Search Bar
- **Height:** 36px
- **Padding:** 8px (p-2)
- **Border bottom:** 1px solid `border-gray-700`
- **Input background:** `bg-gray-700`
- **Border radius:** 8px (rounded-lg)
- **Placeholder:** "Search emojis..."

### Category Tabs
- **Height:** 32px
- **Padding:** 0 8px
- **Scroll:** Horizontal, no scrollbar
- **Tab size:** 28x28px
- **Active tab:** `bg-gray-700` with `ring-1 ring-indigo-500`
- **Inactive tab:** Transparent, `hover:bg-gray-700`

### Emoji Grid
- **Columns:** 8 (grid-cols-8)
- **Gap:** 2px
- **Padding:** 8px
- **Emoji size:** 28x28px
- **Hover:** `bg-gray-700`, `rounded-md`
- **Scroll:** Vertical, custom thin scrollbar

### Recently Used Section
- **Divider:** 1px solid `border-gray-700` with "Recently Used" label
- **Label font:** 10px, `text-gray-400`, uppercase
- **Max items:** 16

---

## 4. Attachment Menu

### Container
- **Width:** 240px (w-60)
- **Background:** `bg-gray-800`
- **Border:** 1px solid `border-gray-700`
- **Border radius:** 12px (rounded-xl)
- **Shadow:** `shadow-2xl`
- **Position:** Absolute above input bar, 8px gap

### Grid Layout
- **Columns:** 3 (grid-cols-3)
- **Padding:** 12px
- **Gap:** 8px

### Attachment Items
- **Size:** 64x64px
- **Border radius:** 12px (rounded-xl)
- **Background:** `bg-gray-700`, `hover:bg-gray-600`
- **Icon size:** 24x24px
- **Label below icon:** 10px font, `text-gray-300`, center aligned

### Items (in order)
1. **Camera** - Camera icon, "Camera"
2. **Gallery** - Image icon, "Gallery"
3. **Document** - File icon, "Document"
4. **Doodle** - Pen icon, "Doodle"
5. **Location** - Pin icon, "Location"
6. **Contact** - Person icon, "Contact"

---

## 5. Voice Note Recorder

### Container
- **Height:** 56px (h-14)
- **Background:** `bg-gray-800`
- **Padding:** 8px 12px
- **Animation:** Slide up from input bar position

### Recording State
- **Red dot:** 8x8px pulsing circle, `bg-red-500`
- **Timer:** 14px font, `text-white`, monospace (MM:SS format)
- **Waveform:** 40px height, animated bars (4 bars, varying heights)
- **Max duration:** 60 seconds (auto-stop)

### Controls
- **Cancel button:** 32x32px, `bg-gray-700`, X icon, `hover:bg-gray-600`
- **Send button:** 32x32px, `bg-indigo-600`, checkmark icon, `hover:bg-indigo-500`
- **Lock button:** 32x32px, lock icon, slides up to lock recording
- **Spacing:** 12px between elements

### Locked State
- **Container:** Moves up 60px, shows full controls
- **Background:** `bg-gray-900` with `bg-opacity-90`
- **Additional buttons:** Play/pause, delete, send

---

## 6. Doodle Pad

### Container (Full Screen Modal)
- **Background:** `bg-black` with `bg-opacity-90`
- **Z-index:** 50 (z-50)
- **Animation:** Fade in over 200ms

### Canvas
- **Size:** Full screen minus toolbar height
- **Default brush:** 3px width, black color
- **Background:** White (#FFFFFF)

### Toolbar (Bottom)
- **Height:** 64px (h-16)
- **Background:** `bg-gray-900`
- **Padding:** 8px 16px
- **Border top:** 1px solid `border-gray-700`

### Tools
- **Color picker:** 6 preset colors (black, red, blue, green, yellow, white)
- **Brush size:** 3 options (2px, 4px, 8px)
- **Eraser:** Toggle button
- **Undo:** Arrow icon
- **Clear:** Trash icon
- **Each tool:** 36x36px, `rounded-lg`, `hover:bg-gray-700`

### Action Buttons
- **Cancel:** "Cancel" text button, `text-gray-400`
- **Send:** "Send" text button, `text-indigo-400`, `font-semibold`
- **Position:** Top right corner

---

## 7. Gift Picker

### Container (Bottom Sheet)
- **Max height:** 60% of screen
- **Background:** `bg-gray-800`
- **Border radius top:** 16px (rounded-t-2xl)
- **Animation:** Slide up from bottom over 300ms ease-out

### Handle Bar
- **Width:** 36px
- **Height:** 4px
- **Background:** `bg-gray-600`
- **Border radius:** 2px (rounded-full)
- **Position:** Center top, 8px margin

### Header
- **Title:** "Send a Gift", 16px font, `font-bold`, `text-white`
- **Coin balance:** Displayed top right, coin icon + number
- **Padding:** 16px

### Category Tabs
- **Height:** 40px
- **Scroll:** Horizontal
- **Tab padding:** 8px 16px
- **Active tab:** `text-indigo-400`, `border-b-2 border-indigo-400`
- **Inactive tab:** `text-gray-400`

### Gift Grid
- **Columns:** 3 (grid-cols-3)
- **Gap:** 12px
- **Padding:** 16px
- **Scroll:** Vertical

### Gift Item Card
- **Background:** `bg-gray-700`
- **Border radius:** 12px (rounded-xl)
- **Padding:** 12px
- **Hover:** `ring-2 ring-indigo-500`
- **Emoji size:** 40px
- **Name:** 12px font, `text-gray-300`, center
- **Cost:** 10px font, `text-yellow-400`, coin icon + number

### Send Button
- **Full width:** `w-full`
- **Height:** 44px
- **Background:** `bg-indigo-600`
- **Border radius:** 12px (rounded-xl)
- **Font:** 14px, `font-bold`, `text-white`
- **Disabled:** `bg-gray-600`, `cursor-not-allowed`

---

## 8. Favourites Tab

### Container
- **Full height** of chat sidebar or modal
- **Background:** `bg-gray-900`

### Header
- **Title:** "Favourites", 18px font, `font-bold`, `text-white`
- **Count:** "12 items", 12px font, `text-gray-400`
- **Padding:** 16px
- **Border bottom:** 1px solid `border-gray-700`

### Filter Tabs
- **All** | **Messages** | **Corrections** | **Audio**
- **Height:** 36px
- **Tab padding:** 8px 16px
- **Active:** `bg-gray-700`, `text-white`, `rounded-full`
- **Inactive:** `text-gray-400`

### Favourite Item
- **Padding:** 12px 16px
- **Border bottom:** 1px solid `border-gray-800`
- **Hover:** `bg-gray-800`

### Item Content
- **Type icon:** 16x16px, left side
- **Preview text:** 14px, `text-gray-200`, max 2 lines
- **Timestamp:** 10px, `text-gray-500`
- **Notes indicator:** Small note icon if notes exist

### Notes Section
- **Background:** `bg-gray-800`
- **Border radius:** 8px (rounded-lg)
- **Padding:** 8px 12px
- **Text:** 12px, `text-gray-400`, italic
- **Edit button:** Pencil icon, 16x16px

### Empty State
- **Icon:** 48px bookmark icon
- **Title:** "No favourites yet"
- **Description:** "Long-press messages to add them to your favourites"
- **Center aligned**

---

## 9. Search Bar

### Container
- **Width:** 320px (w-80)
- **Max height:** 384px (max-h-96)
- **Background:** `bg-gray-800`
- **Border:** 1px solid `border-gray-700`
- **Border radius:** 12px (rounded-xl)
- **Shadow:** `shadow-2xl`
- **Position:** Absolute, top of chat area

### Search Input
- **Height:** 40px
- **Padding:** 8px 12px
- **Border bottom:** 1px solid `border-gray-700`
- **Icon:** 16x16px search icon, left side
- **Input:** Full width, `bg-transparent`, `text-white`, 14px font
- **Clear button:** X icon, right side, visible when input has text

### Filter Chips
- **Scroll:** Horizontal
- **Chip height:** 28px
- **Chip padding:** 6px 12px
- **Chip border radius:** 14px (rounded-full)
- **Active chip:** `bg-indigo-600`, `text-white`
- **Inactive chip:** `bg-gray-700`, `text-gray-300`
- **Chips:** All, Text, Voice, Corrections, Doodles

### Results List
- **Max height:** 280px
- **Scroll:** Vertical, custom thin scrollbar

### Result Item
- **Padding:** 8px 12px
- **Hover:** `bg-gray-700`
- **Border bottom:** 1px solid `border-gray-700` (last item excluded)

### Result Content
- **Type badge:** 16x16px icon, left side
- **Preview:** 13px font, `text-gray-200`, max 1 line with ellipsis
- **Context:** 11px font, `text-gray-500`, "in: Chat with John"
- **Timestamp:** 10px font, `text-gray-500`

### Empty State
- **Icon:** 32px search icon
- **Text:** "No messages found"
- **Center aligned, padding 24px**

---

## 10. Typing Indicator

### Container
- **Height:** 24px
- **Padding:** 0 16px
- **Margin bottom:** 4px

### Animation
- **3 dots:** 6x6px each
- **Background:** `bg-gray-500`
- **Border radius:** 50% (rounded-full)
- **Spacing:** 4px between dots
- **Animation:** Bounce up and down with 0.3s delay between each dot
- **Duration:** 1.2s infinite

### Text
- **Font:** 11px, `text-gray-400`, italic
- **Content:** "Username is typing..."
- **Position:** Left of dots, 8px gap

### Multiple Typers
- **Format:** "User1 and User2 are typing..."
- **Max display:** 2 names + "and X others"

---

## 11. Read Receipts

### Icon
- **SVG:** Double checkmark (✓✓)
- **Size:** 14x10px viewBox
- **Stroke width:** 2px

### States
- **Sending:** Single gray checkmark, `text-gray-600`
- **Sent:** Single white checkmark, `text-gray-400`
- **Delivered:** Double checkmark, `text-gray-400`
- **Read:** Double checkmark, `text-indigo-400`

### Position
- **Bottom right** of message bubble
- **Margin:** 4px from bubble edge
- **Z-index:** 1

### Tooltip (on hover)
- **Content:** "Read by John at 14:32"
- **Background:** `bg-gray-900`
- **Border radius:** 6px (rounded-lg)
- **Padding:** 4px 8px
- **Font:** 11px, `text-white`

---

## 12. Context Menu

### Container
- **Min width:** 160px
- **Background:** `bg-gray-800`
- **Border:** 1px solid `border-gray-700`
- **Border radius:** 10px (rounded-xl)
- **Shadow:** `shadow-2xl`
- **Position:** Absolute, near long-press location
- **Z-index:** 60

### Menu Items
- **Height:** 36px
- **Padding:** 0 12px
- **Hover:** `bg-gray-700`
- **First item:** `rounded-t-xl`
- **Last item:** `rounded-b-xl`

### Item Content
- **Icon:** 16x16px, left side, `text-gray-400`
- **Label:** 13px font, `text-gray-200`
- **Danger items:** `text-red-400` icon and label

### Items (in order)
1. **Reply** - Reply icon
2. **Copy** - Copy icon
3. **Forward** - Forward icon
4. **Favourite** - Star icon (filled if already favourited)
5. **Translate** - Translate icon
6. **Report** - Flag icon (danger)
7. **Delete** - Trash icon (danger, own messages only)

### Divider
- **Height:** 1px
- **Background:** `border-gray-700`
- **Margin:** 4px 0

### Keyboard Shortcuts (shown on hover)
- **Font:** 11px, `text-gray-500`
- **Position:** Right aligned in menu item
- **Examples:** "Ctrl+C", "Ctrl+R"

---

## 13. Message Status Indicators

### Sending
- **Icon:** Clock or spinner
- **Size:** 12x12px
- **Color:** `text-gray-500`
- **Position:** Below message, left of timestamp

### Failed
- **Icon:** Warning triangle with exclamation
- **Size:** 14x14px
- **Color:** `text-red-400`
- **Tooltip:** "Message failed to send. Tap to retry."
- **Action:** Tap to retry sending

### Edited
- **Label:** "(edited)"
- **Font:** 10px, `text-gray-500`, italic
- **Position:** End of message text, 4px left margin

---

## 14. Reply Preview

### Container
- **Height:** 44px
- **Background:** `bg-gray-700`
- **Border left:** 3px solid `border-indigo-500`
- **Border radius:** 8px (rounded-lg)
- **Padding:** 6px 10px
- **Margin bottom:** 4px

### Content
- **Sender name:** 11px, `font-semibold`, `text-indigo-400`
- **Preview text:** 12px, `text-gray-400`, max 1 line with ellipsis
- **Close button:** X icon, 16x16px, top right

### Media Preview
- **Image:** 32x32px thumbnail, `rounded-md`
- **Voice:** 12px waveform icon + duration text
- **Doodle:** 32x32px thumbnail

---

## 15. Date Separator

### Container
- **Height:** 32px
- **Display:** Flex, center aligned

### Line
- **Height:** 1px
- **Background:** `border-gray-700`
- **Flex:** 1

### Label
- **Padding:** 0 12px
- **Font:** 11px, `text-gray-500`, uppercase
- **Background:** `bg-gray-900` (to hide line behind text)

### Format
- **Today:** "Today"
- **Yesterday:** "Yesterday"
- **This week:** "Monday", "Tuesday", etc.
- **Older:** "12 June 2024"

---

## 16. System Messages

### Container
- **Text align:** Center
- **Padding:** 8px 16px

### Content
- **Font:** 11px, `text-gray-500`, italic
- **Icon:** Optional, 12x12px, left of text

### Types
- **User joined:** "{name} joined the chat"
- **User left:** "{name} left the chat"
- **Group created:** "Group created"
- **Group renamed:** "Group renamed to {name}"
- **Call started:** "Voice call started" with phone icon
- **Call ended:** "Call ended - duration 12:34"

---

## 17. Scroll to Bottom Button

### Container
- **Size:** 36x36px
- **Background:** `bg-gray-700`
- **Border radius:** 50% (rounded-full)
- **Shadow:** `shadow-lg`
- **Position:** Fixed, bottom right of chat area (above input bar)
- **Z-index:** 10
- **Animation:** Fade in/out based on scroll position

### Icon
- **Arrow down:** 18x18px SVG
- **Color:** `text-white`

### Badge (unread count)
- **Size:** 16x16px
- **Background:** `bg-red-500`
- **Text:** 10px, `text-white`, `font-bold`
- **Position:** Top right of button, -4px offset

---

## 18. Chat Background

### Default
- **Color:** `bg-gray-900` (hex #111827)
- **Pattern:** Subtle dots or grid pattern at 5% opacity
- **Pattern size:** 20x20px

### Custom (future feature)
- **User upload:** Max 2MB, JPG/PNG
- **Opacity:** 30% overlay
- **Blur:** 2px blur on image

---

## 19. Loading States

### Initial Load
- **Skeleton messages:** 3-5 placeholder bubbles
- **Skeleton height:** 40-80px random
- **Skeleton width:** 40-60% of container
- **Animation:** Shimmer effect (gradient sweep)
- **Duration:** 1.5s infinite

### Pagination Load
- **Spinner:** 24x24px, `text-indigo-400`
- **Position:** Center, between message groups
- **Text:** "Loading older messages..." below spinner

---

## 20. Error States

### Network Error
- **Banner:** Top of chat area
- **Background:** `bg-red-900` with `bg-opacity-80`
- **Text:** "Connection lost. Reconnecting..."
- **Icon:** Warning icon
- **Height:** 36px
- **Animation:** Slide down from top

### Message Send Error
- **Inline:** Below failed message
- **Background:** `bg-red-900` with `bg-opacity-50`
- **Border radius:** 8px (rounded-lg)
- **Padding:** 4px 8px
- **Text:** 11px, `text-red-300`
- **Retry button:** 20x20px refresh icon

### Empty Chat
- **Center aligned** in chat area
- **Icon:** 64px chat bubble with plus
- **Title:** "No messages yet"
- **Description:** "Send a message to start the conversation"
- **Suggested actions:** "Say hello! 👋" button
