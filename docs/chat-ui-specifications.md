<!-- This file is a specification document, not code. -->
<!-- Linting is not applicable to this file. -->
<!-- No code changes needed. -->

# Chat UI Component Specifications (Pixel-Perfect)

## 1. Message Bubbles

### Layout & Sizing

- **Max width:** 75% of chat container width (max 480px)
- **Min width:** 48px (single emoji or short word)
- **Border radius:** 18px top-left/top-right, 4px bottom-left/bottom-right (own messages); 4px top-left/top-right, 18px bottom-left/bottom-right (other messages)
- **Padding:** 10px 14px (text), 8px (media)
- **Margin bottom:** 4px between consecutive same-sender messages; 12px between different senders
- **Font size:** 15px body text, 11px timestamp
- **Line height:** 1.4 (body), 1 (timestamp)

### Colour Scheme

- **Own message background:** `#005C4B` (dark mode) / `#D9FDD3` (light mode)
- **Other message background:** `#202C33` (dark mode) / `#FFFFFF` (light mode)
- **Text colour:** `#E9EDEF` (dark mode own), `#E9EDEF` (dark mode other), `#111B21` (light mode)
- **Timestamp colour:** `#8796A0` (dark mode), `#667781` (light mode)
- **Read receipt colour:** `#53BDEB` (read), `#8796A0` (delivered), `#667781` (sent)

### States

- **Hover:** Slight background shift (+5% brightness)
- **Selected:** 2px solid border `#00A884`
- **Context menu trigger:** Long press (mobile) or right-click (desktop)

### Typography

- **Font family:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Noto Sans`, `Helvetica Neue`, `Arial`, sans-serif
- **Font weight:** 400 (body), 500 (sender name in group chats), 600 (timestamp)
- **Text overflow:** `word-break: break-word; overflow-wrap: break-word`

### Spacing & Alignment

- **Own messages:** `margin-left: auto;` aligned to right
- **Other messages:** `margin-right: auto;` aligned to left
- **Sender avatar (group):** 24px circle, `margin-right: 8px` (LTR) / `margin-left: 8px` (RTL)
- **Sender name (group):** 12.8px font, `#00A884` colour, `margin-bottom: 2px`

---

## 2. Input Bar

### Container

- **Height:** 56px (single line) to 120px (expanded with attachments)
- **Background:** `#1F2C33` (dark mode) / `#F0F2F5` (light mode)
- **Border top:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)
- **Padding:** 8px 12px
- **Bottom safe area:** `padding-bottom: env(safe-area-inset-bottom, 8px)`

### Text Input Field

- **Height:** 40px (single line), expands to max 100px
- **Background:** `#2A3942` (dark) / `#FFFFFF` (light)
- **Border radius:** 8px
- **Padding:** 9px 12px
- **Font size:** 15px
- **Placeholder colour:** `#8696A0` (dark) / `#667781` (light)
- **Max lines:** 5 (then scroll)
- **Scrollbar:** Thin, `#374045` track, `#00A884` thumb

### Action Buttons

- **Size:** 32px × 32px
- **Icon size:** 20px × 20px
- **Colour:** `#8696A0` (default), `#00A884` (active/hover)
- **Spacing:** 4px gap between buttons
- **Hit area:** 44px × 44px (accessibility)

### Send Button

- **Size:** 40px × 40px
- **Background:** `#00A884` (enabled), `#374045` (disabled)
- **Border radius:** 50%
- **Icon:** 20px send arrow (white)
- **Disabled state:** `opacity: 0.4; cursor: not-allowed`

### States

- **Focused input:** 1px solid `#00A884` border
- **Recording voice:** Red pulse animation on mic button
- **Attaching file:** Blue highlight on attachment button

---

## 3. Emoji Picker

### Panel Dimensions

- **Width:** 320px (mobile), 368px (desktop)
- **Height:** 352px (collapsed), 420px (expanded with search)
- **Border radius:** 12px
- **Shadow:** `0 8px 32px rgba(0,0,0,0.28)`

### Header

- **Height:** 44px
- **Background:** `#1F2C33` (dark) / `#F0F2F5` (light)
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)
- **Search input:** 28px height, 8px border radius, `#2A3942` background

### Category Tabs

- **Height:** 36px
- **Tab width:** 40px each
- **Active indicator:** 2px bottom border `#00A884`
- **Icon size:** 20px × 20px

### Emoji Grid

- **Columns:** 8 (mobile), 9 (desktop)
- **Cell size:** 36px × 36px
- **Emoji size:** 24px × 24px
- **Padding:** 4px
- **Hover background:** `rgba(0,168,132,0.1)` with 6px border radius

### Skin Tone Selector

- **Position:** Bottom of picker
- **Height:** 36px
- **Dot size:** 18px × 18px
- **Border:** 2px solid transparent (selected: `#00A884`)

### States

- **Hover emoji:** Scale 1.2, background highlight
- **Selected emoji:** Scale 1.1, `#00A884` border
- **Active category:** Bold icon, bottom border

---

## 4. Attachment Menu

### Trigger Button

- **Size:** 32px × 32px
- **Icon:** Paperclip (20px)
- **Colour:** `#8696A0`

### Menu Panel

- **Position:** Above input bar, left-aligned
- **Width:** 240px
- **Background:** `#1F2C33` (dark) / `#FFFFFF` (light)
- **Border radius:** 12px
- **Shadow:** `0 8px 32px rgba(0,0,0,0.28)`
- **Padding:** 8px

### Menu Items

- **Height:** 48px each
- **Icon size:** 24px × 24px
- **Icon background:** 36px circle with colour
- **Label font:** 14px, `#E9EDEF` (dark) / `#111B21` (light)
- **Subtitle font:** 11px, `#8696A0`

### Item Colours

- **Gallery:** Purple `#7F6BFF`
- **Camera:** Green `#00A884`
- **Document:** Blue `#53BDEB`
- **Voice:** Orange `#FF7B2C`
- **Doodle:** Pink `#FF6B9D`
- **Gift:** Gold `#FFD700`
- **Location:** Teal `#00BFA5`

### States

- **Hover:** Background `rgba(255,255,255,0.05)` (dark) / `rgba(0,0,0,0.05)` (light)
- **Disabled:** Opacity 0.4

---

## 5. Voice Note Recorder

### Recording Bar

- **Height:** 48px
- **Background:** `#1F2C33` (dark) / `#F0F2F5` (light)
- **Border radius:** 24px
- **Padding:** 4px 8px

### Waveform Visualization

- **Height:** 32px
- **Bar width:** 2px
- **Bar gap:** 1px
- **Bar colour:** `#00A884` (active), `#374045` (inactive)
- **Animation:** Smooth amplitude interpolation

### Timer Display

- **Font:** 14px monospace (`SF Mono`, `Consolas`, `Courier New`)
- **Colour:** `#E9EDEF`
- **Format:** `MM:SS`
- **Max duration:** 60:00 (red flash at 55:00)

### Controls

- **Record button:** 36px circle, red `#FF3B30` background, white mic icon
- **Stop button:** 36px circle, `#374045` background, white square icon
- **Send button:** 36px circle, `#00A884` background, white send icon
- **Cancel button:** 36px circle, transparent, red X icon
- **Spacing:** 8px between buttons

### Lock Gesture

- **Swipe up:** Locks recording (shows lock icon)
- **Locked state:** Padlock icon turns white, bar stays active

### States

- **Recording:** Red pulse animation on record button
- **Paused:** Pause icon replaces record icon
- **Locked:** Lock icon visible, swipe hint text fades
- **Error:** Shake animation, red border

---

## 6. Doodle Pad

### Canvas Dimensions

- **Width:** 100% of chat container (max 480px)
- **Height:** 300px (mobile), 400px (desktop)
- **Background:** `#FFFFFF` (default), `#1A1A1A` (dark mode toggle)

### Toolbar

- **Height:** 44px
- **Background:** `#1F2C33` (dark) / `#F0F2F5` (light)
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)
- **Padding:** 4px 8px

### Drawing Tools

- **Pen:** 2px, 4px, 6px, 8px thickness options
- **Highlighter:** 12px, 16px, 20px thickness, 50% opacity
- **Eraser:** 10px, 20px, 30px thickness
- **Colour picker:** 8 preset colours + custom (hex input)
- **Undo/Redo:** 32px × 32px buttons, disabled state at 40% opacity

### Colour Presets

- Black `#000000`, Red `#FF3B30`, Orange `#FF9500`, Yellow `#FFCC00`
- Green `#34C759`, Blue `#007AFF`, Purple `#AF52DE`, White `#FFFFFF`

### Actions

- **Clear:** 32px × 32px trash icon, confirmation dialog
- **Send:** 40px × 40px send button, `#00A884` background
- **Cancel:** 32px × 32px X icon, returns to chat
- **Save to gallery:** Downloads as PNG (320px × 240px)

### States

- **Drawing:** Cursor changes to crosshair
- **Eraser active:** Cursor changes to circle
- **Undo available:** Button at full opacity
- **Redo available:** Button at full opacity

---

## 7. Gift Picker

### Panel Dimensions

- **Width:** 320px (mobile), 400px (desktop)
- **Height:** 400px
- **Border radius:** 16px
- **Background:** `#1F2C33` (dark) / `#FFFFFF` (light)
- **Shadow:** `0 8px 32px rgba(0,0,0,0.28)`

### Header

- **Height:** 48px
- **Title:** "Send a Gift", 16px bold
- **Coin balance:** Right-aligned, coin icon + number, 14px
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)

### Gift Grid

- **Columns:** 3
- **Cell size:** 100px × 120px
- **Gift icon:** 48px × 48px (animated Lottie or static emoji)
- **Gift name:** 12px, `#E9EDEF` (dark) / `#111B21` (light), single line truncation
- **Coin cost:** 11px, `#FFD700` colour, coin icon prefix

### Gift Categories

- **Tabs:** All, Popular, Romantic, Funny, Premium
- **Tab height:** 36px
- **Active tab:** Bottom border `#00A884`, bold text
- **Inactive tab:** `#8696A0` text

### Premium Gifts

- **Badge:** "VIP" label, 16px × 16px, gold background
- **Locked state:** 40% opacity, lock overlay
- **Unlock CTA:** "Upgrade to send" link, 12px, `#00A884`

### States

- **Hover gift:** Scale 1.05, shadow increase
- **Selected gift:** 2px solid `#00A884` border
- **Insufficient coins:** Red tint, shake on click
- **Sending animation:** Gift flies from picker to chat

---

## 8. Favourites Tab

### Panel Dimensions

- **Width:** 100% of chat container
- **Height:** Full viewport minus header (flexible)
- **Background:** `#111B21` (dark) / `#FFFFFF` (light)

### Header

- **Height:** 56px
- **Title:** "Favourites", 18px bold
- **Back button:** 32px × 32px arrow icon
- **Edit button:** 32px × 32px pencil icon (enters selection mode)
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)

### List Items

- **Height:** 72px each
- **Padding:** 12px 16px
- **Thumbnail:** 48px × 48px, border radius 8px
- **Title:** 14px bold, single line truncation
- **Subtitle:** 12px, `#8696A0`, single line truncation
- **Timestamp:** 11px, `#667781`, right-aligned
- **Type icon:** 16px × 16px (message, correction, audio, moment)

### Empty State

- **Icon:** 64px star outline
- **Title:** "No favourites yet"
- **Description:** "Tap the star icon on any message to save it here"
- **Action button:** "Explore messages", 40px height, `#00A884` background

### Selection Mode

- **Checkbox:** 24px × 24px, left-aligned
- **Selected state:** Background `rgba(0,168,132,0.08)`
- **Batch actions:** Delete (trash icon), Share (share icon)
- **Select all:** Header checkbox

### States

- **Hover item:** Background `rgba(255,255,255,0.05)` (dark) / `rgba(0,0,0,0.05)` (light)
- **Swiped:** Reveals delete button (red, 72px width)
- **Long press:** Enters selection mode

---

## 9. Search Bar

### Container

- **Height:** 56px
- **Background:** `#1F2C33` (dark) / `#F0F2F5` (light)
- **Padding:** 8px 12px
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)

### Search Input

- **Height:** 36px
- **Background:** `#2A3942` (dark) / `#FFFFFF` (light)
- **Border radius:** 8px
- **Padding:** 8px 12px 8px 36px
- **Font size:** 15px
- **Placeholder:** "Search messages..." (dark) / "Search messages" (light)
- **Placeholder colour:** `#8696A0` (dark) / `#667781` (light)

### Search Icon

- **Position:** Absolute, left 12px
- **Size:** 18px × 18px
- **Colour:** `#8696A0`

### Clear Button

- **Position:** Absolute, right 12px
- **Size:** 20px × 20px
- **Icon:** X circle filled
- **Colour:** `#8696A0`
- **Visibility:** Only when input has text

### Filter Chips

- **Height:** 28px
- **Border radius:** 14px
- **Padding:** 4px 12px
- **Font size:** 12px
- **Background:** `#2A3942` (inactive), `#00A884` (active)
- **Text colour:** `#E9EDEF` (inactive), `#FFFFFF` (active)
- **Spacing:** 6px gap between chips
- **Scroll:** Horizontal scroll if overflow

### Results List

- **Max height:** 60% of viewport
- **Item height:** 64px
- **Highlighted text:** `#00A884` background, 2px border radius
- **Divider:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)

### States

- **Focused:** 1px solid `#00A884` border on input
- **Loading:** Spinner (20px, `#00A884`) replaces search icon
- **No results:** Empty state with "No messages found" text
- **Error:** Red border, error message below input

---

## 10. Typing Indicator

### Container

- **Height:** 24px
- **Padding:** 4px 14px
- **Background:** Transparent (overlays last message)
- **Animation:** Fade in (200ms), fade out (300ms)

### Dots Animation

- **Dot size:** 6px × 6px
- **Dot colour:** `#8696A0`
- **Dot spacing:** 3px
- **Animation:** Bounce up and down with 300ms stagger
  - Dot 1: delay 0ms
  - Dot 2: delay 100ms
  - Dot 3: delay 200ms
- **Duration:** 1.2s loop
- **Easing:** `cubic-bezier(0.68, -0.55, 0.27, 1.55)`

### Text Label

- **Font:** 11px
- **Colour:** `#8696A0`
- **Content:** "typing..." (single user) or "2 people typing..." (multiple)
- **Position:** Left of dots, 4px gap

### States

- **Visible:** `opacity: 1; transform: translateY(0)`
- **Hidden:** `opacity: 0; transform: translateY(8px); pointer-events: none`
- **Multiple typers:** Shows count badge (12px circle, `#00A884` background)

---

## 11. Read Receipts

### Icon Display

- **Size:** 16px × 11px (single check), 16px × 11px (double check)
- **Position:** Bottom-right of message bubble, 4px from edge
- **Spacing:** 2px right of timestamp

### States

- **Sent:** Single gray check `#8796A0`
- **Delivered:** Double gray check `#8796A0`
- **Read:** Double blue check `#53BDEB`
- **Failed:** Red exclamation icon (16px × 16px)

### Animation

- **Sent → Delivered:** Single check fades, double check fades in (200ms)
- **Delivered → Read:** Checks turn blue with 300ms colour transition
- **Failed:** Shake animation (100ms, 3 iterations)

### Group Chat Variant

- **Read by count:** "Read by 3" text, 11px, `#53BDEB`
- **Tooltip:** On hover, shows list of readers (max 5, then "+2 more")
- **Tooltip dimensions:** 200px max width, 8px border radius, `#1F2C33` background

---

## 12. Context Menu

### Trigger

- **Desktop:** Right-click on message bubble
- **Mobile:** Long press (500ms) on message bubble
- **Haptic feedback:** Light impact (iOS) / Vibrate (Android)

### Menu Panel

- **Width:** 200px
- **Background:** `#1F2C33` (dark) / `#FFFFFF` (light)
- **Border radius:** 12px
- **Shadow:** `0 8px 32px rgba(0,0,0,0.28)`
- **Padding:** 4px 0
- **Z-index:** 1000

### Menu Items

- **Height:** 44px
- **Padding:** 0 16px
- **Icon size:** 18px × 18px
- **Icon colour:** `#8696A0`
- **Text font:** 14px, `#E9EDEF` (dark) / `#111B21` (light)
- **Text spacing:** 12px between icon and text

### Available Actions

- Reply (↩️ icon)
- Forward (➡️ icon)
- Copy (📋 icon)
- Edit (✏️ icon) - own messages only
- Delete (🗑️ icon) - own messages only
- Star/Favourite (⭐ icon)
- Report (🚩 icon)
- Select (☑️ icon)

### Danger Actions

- **Delete:** Red text `#FF3B30`, red icon
- **Report:** Orange text `#FF9500`, orange icon
- **Confirmation:** "Delete message?" dialog with "Cancel" and "Delete" buttons

### States

- **Hover item:** Background `rgba(255,255,255,0.05)` (dark) / `rgba(0,0,0,0.05)` (light)
- **Disabled item:** Opacity 0.4, no hover effect
- **Submenu:** Arrow icon (>) indicates nested menu

---

## 13. Message Status Indicators

### Sending State

- **Icon:** Clock (20px × 20px)
- **Colour:** `#8696A0`
- **Position:** Bottom-right of message bubble
- **Animation:** Rotating clock hand (2s loop)

### Failed State

- **Icon:** Exclamation triangle (20px × 20px)
- **Colour:** `#FF3B30`
- **Position:** Bottom-right of message bubble
- **Tap action:** Retry send
- **Tooltip:** "Tap to retry" (11px, `#FF3B30`)

### Pending State (Voice/Media)

- **Progress bar:** 2px height, `#00A884` colour
- **Position:** Bottom of media thumbnail
- **Percentage:** Center text, 11px, `#FFFFFF`
- **Cancel button:** X icon, 20px × 20px, top-right corner

---

## 14. Reply Preview

### Container

- **Height:** 48px
- **Background:** `#2A3942` (dark) / `#E9EDEF` (light)
- **Border left:** 4px solid `#00A884`
- **Padding:** 8px 12px
- **Border radius:** 8px (top), 0 (bottom)

### Content

- **Sender name:** 12px bold, `#00A884`
- **Message preview:** 13px, `#E9EDEF` (dark) / `#667781` (light), single line truncation
- **Media indicator:** "📷 Photo" or "🎤 Voice message" if applicable

### Close Button

- **Size:** 24px × 24px
- **Icon:** X (16px)
- **Colour:** `#8696A0`
- **Position:** Right-aligned, vertically centered

### Animation

- **Slide in:** From top, 200ms ease-out
- **Slide out:** To top, 150ms ease-in

---

## 15. Message Divider (Date Separator)

### Container

- **Height:** 32px
- **Padding:** 8px 0
- **Background:** Transparent

### Line

- **Height:** 1px
- **Background:** `#313D45` (dark) / `#E9EDEF` (light)
- **Flex:** 1

### Date Text

- **Font:** 12px
- **Colour:** `#8696A0`
- **Background:** `#111B21` (dark) / `#FFFFFF` (light)
- **Padding:** 0 12px
- **Border radius:** 8px (background pill)

### Format

- **Today:** "Today"
- **Yesterday:** "Yesterday"
- **This week:** "Monday", "Tuesday", etc.
- **This year:** "12 March"
- **Previous years:** "12 March 2023"

### States

- **New messages indicator:** "New messages" text, `#00A884` colour, 11px
- **Unread badge:** Blue dot (8px), left of text

---

## 16. Scroll-to-Bottom Button

### Position

- **Bottom:** 80px (above input bar)
- **Right:** 16px
- **Z-index:** 100

### Dimensions

- **Size:** 40px × 40px
- **Border radius:** 50%
- **Background:** `#1F2C33` (dark) / `#FFFFFF` (light)
- **Shadow:** `0 2px 8px rgba(0,0,0,0.2)`

### Icon

- **Size:** 20px × 20px
- **Icon:** Down arrow (↓)
- **Colour:** `#8696A0`

### Badge (Unread Count)

- **Size:** 18px × 18px
- **Background:** `#00A884`
- **Text:** 10px bold, white
- **Position:** Top-right corner, -4px offset

### States

- **Visible:** `opacity: 1; transform: translateY(0)`
- **Hidden:** `opacity: 0; transform: translateY(16px); pointer-events: none`
- **Hover:** Background `#2A3942` (dark) / `#F0F2F5` (light)
- **Active:** Scale 0.95

### Animation

- **Show:** 200ms ease-out
- **Hide:** 150ms ease-in
- **Badge update:** Scale bounce (1 → 1.2 → 1)

---

## 17. Chat Header

### Container

- **Height:** 56px
- **Background:** `#1F2C33` (dark) / `#F0F2F5` (light)
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)
- **Padding:** 0 12px

### Back Button

- **Size:** 32px × 32px
- **Icon:** Arrow left (20px)
- **Colour:** `#E9EDEF` (dark) / `#111B21` (light)
- **Hit area:** 44px × 44px

### User Avatar

- **Size:** 40px × 40px
- **Border radius:** 50%
- **Status dot:** 10px × 10px, bottom-right corner
  - Online: `#00A884`
  - Away: `#FF9500`
  - Offline: `#374045`

### User Info

- **Name:** 16px bold, single line truncation
- **Status:** 12px, `#8696A0`, single line truncation
  - Online: "Online"
  - Away: "Last seen 2h ago"
  - Offline: "Offline"
  - Typing: "typing..." (green, `#00A884`)

### Action Buttons

- **Size:** 32px × 32px
- **Spacing:** 4px
- **Icons:** Voice call (📞), Video call (📹), More options (⋮)
- **Colour:** `#8696A0` (default), `#E9EDEF` (hover)

### States

- **Online:** Green status dot, "Online" text
- **Away:** Yellow status dot, last seen text
- **Offline:** Gray status dot, "Offline" text
- **Typing:** Green pulsing text, animated dots

---

## 18. Chat Background

### Pattern

- **Type:** Subtle repeating pattern (SVG or CSS)
- **Opacity:** 5% (dark mode), 3% (light mode)
- **Pattern:** Diagonal lines or dots (WhatsApp-style)

### Colour

- **Dark mode:** `#0B141A`
- **Light mode:** `#EFEAE2`

### Wallpaper Support

- **Custom wallpaper:** User-selectable from gallery
- **Default:** Built-in pattern
- **Image fit:** Cover
- **Image opacity:** 100%

---

## 19. Message Reactions

### Reaction Bar

- **Position:** Below message bubble, right-aligned (own) / left-aligned (other)
- **Height:** 28px
- **Background:** `#1F2C33` (dark) / `#FFFFFF` (light)
- **Border radius:** 14px
- **Shadow:** `0 1px 4px rgba(0,0,0,0.15)`
- **Padding:** 2px 4px

### Reaction Emojis

- **Size:** 18px × 18px
- **Spacing:** 2px
- **Count badge:** 10px font, `#8696A0`, right of emoji
- **Max visible:** 3 emojis + "+N" overflow

### Add Reaction

- **Button:** + icon, 18px × 18px
- **Colour:** `#8696A0`
- **Opens:** Emoji picker (compact mode)

### States

- **Hover reaction:** Scale 1.2
- **Selected reaction:** `#00A884` border (2px)
- **Animation:** Pop in (scale 0 → 1.2 → 1, 200ms)

---

## 20. Message Selection Mode

### Activation

- **Trigger:** Long press on message (mobile) or right-click → Select (desktop)
- **Haptic:** Light impact feedback

### Visual Indicators

- **Checkbox:** 24px × 24px, left of message bubble
- **Selected message:** Background `rgba(0,168,132,0.08)`, 2px left border `#00A884`
- **Unselected message:** Dimmed (opacity 0.6)

### Top Bar (Selection Mode)

- **Height:** 56px
- **Background:** `#1F2C33` (dark) / `#F0F2F5` (light)
- **Title:** "2 selected" (dynamic count)
- **Close button:** X icon, 32px × 32px
- **Select all:** Checkbox icon, 32px × 32px

### Bottom Action Bar

- **Height:** 56px
- **Background:** `#1F2C33` (dark) / `#FFFFFF` (light)
- **Border top:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)
- **Actions:** Delete (🗑️), Forward (➡️), Star (⭐), Copy (📋)
- **Button size:** 40px × 40px
- **Button spacing:** 16px

### States

- **Active:** Full opacity, interactive
- **Disabled (0 selected):** Opacity 0.4, non-interactive
- **Exit:** Tap outside or press Escape (desktop)

---

## 21. Message Link Preview

### Container

- **Max width:** 100% of message bubble
- **Border radius:** 8px
- **Overflow:** Hidden

### Thumbnail

- **Height:** 120px (landscape), 160px (portrait)
- **Width:** 100%
- **Object fit:** Cover
- **Background:** `#2A3942` (loading state)

### Content

- **Title:** 14px bold, 2 line truncation
- **Description:** 12px, `#8696A0`, 2 line truncation
- **URL:** 11px, `#00A884`, single line truncation
- **Padding:** 8px 12px

### States

- **Loading:** Skeleton (pulse animation, 1.5s)
- **Error:** Fallback icon (broken link, 32px × 32px)
- **No preview:** Just URL text, 12px, `#00A884`

---

## 22. Voice Message Player

### Container

- **Height:** 48px
- **Background:** `#2A3942` (dark) / `#E9EDEF` (light)
- **Border radius:** 8px
- **Padding:** 4px 8px

### Play/Pause Button

- **Size:** 32px × 32px
- **Border radius:** 50%
- **Background:** `#00A884`
- **Icon:** Play (▶️) or Pause (⏸️), 16px, white

### Waveform

- **Height:** 24px
- **Width:** Flexible (fills remaining space)
- **Bar width:** 2px
- **Bar gap:** 1px
- **Played bars:** `#00A884`
- **Unplayed bars:** `#374045`
- **Animation:** Smooth progress update

### Timer

- **Font:** 12px monospace
- **Colour:** `#E9EDEF`
- **Format:** `MM:SS` (current) / `MM:SS` (total)
- **Position:** Right of waveform

### Speed Control

- **Button:** 1x, 1.5x, 2x toggle
- **Size:** 24px × 24px
- **Font:** 10px bold
- **Colour:** `#8696A0` (default), `#00A884` (active)

### States

- **Playing:** Green pulse on play button
- **Paused:** Static play button
- **Loading:** Spinner replaces play button
- **Error:** Red exclamation, tap to retry

---

## 23. Image/Video Message

### Thumbnail

- **Max width:** 300px
- **Max height:** 300px
- **Border radius:** 8px
- **Object fit:** Cover
- **Background:** `#2A3942` (loading)

### Play Button (Video)

- **Size:** 48px × 48px
- **Border radius:** 50%
- **Background:** `rgba(0,0,0,0.6)`
- **Icon:** Play triangle (24px), white
- **Position:** Center of thumbnail

### Duration Badge (Video)

- **Position:** Bottom-right corner
- **Padding:** 2px 6px
- **Background:** `rgba(0,0,0,0.7)`
- **Border radius:** 4px
- **Font:** 11px, white
- **Format:** `MM:SS`

### Gallery Indicator

- **Multiple images:** Dot indicators (6px, bottom center)
- **Active dot:** `#00A884`
- **Inactive dot:** `rgba(255,255,255,0.5)` (dark) / `rgba(0,0,0,0.3)` (light)
- **Swipe:** Horizontal swipe to navigate

### States

- **Loading:** Skeleton (pulse, 1.5s)
- **Error:** Broken image icon (32px × 32px)
- **Expanded:** Full-screen viewer with pinch-to-zoom

---

## 24. Document Message

### Container

- **Height:** 56px
- **Background:** `#2A3942` (dark) / `#E9EDEF` (light)
- **Border radius:** 8px
- **Padding:** 8px 12px

### Icon

- **Size:** 32px × 32px
- **Border radius:** 8px
- **Background:** `#374045` (dark) / `#D1D7DB` (light)
- **Icon:** Document type icon (PDF, DOC, XLS, etc.)

### File Info

- **Name:** 13px bold, single line truncation
- **Size:** 11px, `#8696A0`
- **Type:** 11px, `#8696A0`

### Download Button

- **Size:** 32px × 32px
- **Icon:** Download (⬇️) or Open (↗️)
- **Colour:** `#00A884`

### States

- **Downloading:** Progress bar (2px, `#00A884`)
- **Downloaded:** Check icon (✓)
- **Error:** Red exclamation, tap to retry

---

## 25. Location Message

### Map Preview

- **Height:** 120px
- **Width:** 100%
- **Border radius:** 8px
- **Background:** `#2A3942` (loading)

### Pin

- **Size:** 24px × 32px
- **Colour:** `#FF3B30`
- **Position:** Center of map

### Address

- **Font:** 13px
- **Colour:** `#E9EDEF` (dark) / `#111B21` (light)
- **Padding:** 8px 12px
- **Single line truncation**

### States

- **Loading:** Map skeleton (pulse, 1.5s)
- **Error:** "Location unavailable" text
- **Expanded:** Full-screen map view

---

## 26. Contact Message

### Container

- **Height:** 64px
- **Background:** `#2A3942` (dark) / `#E9EDEF` (light)
- **Border radius:** 8px
- **Padding:** 8px 12px

### Avatar

- **Size:** 40px × 40px
- **Border radius:** 50%
- **Background:** `#00A884` (initials fallback)

### Contact Info

- **Name:** 14px bold, single line truncation
- **Phone/Email:** 12px, `#8696A0`, single line truncation

### Add Contact Button

- **Size:** 32px × 32px
- **Icon:** Person add (➕)
- **Colour:** `#00A884`

### States

- **Already added:** Check icon (✓), `#8696A0`
- **Blocked:** Block icon (🚫), `#FF3B30`

---

## 27. Poll Message

### Container

- **Padding:** 12px
- **Background:** `#2A3942` (dark) / `#E9EDEF` (light)
- **Border radius:** 8px

### Question

- **Font:** 14px bold
- **Colour:** `#E9EDEF` (dark) / `#111B21` (light)
- **Margin bottom:** 8px

### Options

- **Height:** 36px each
- **Border radius:** 8px
- **Background:** `#374045` (dark) / `#D1D7DB` (light)
- **Padding:** 8px 12px
- **Margin bottom:** 4px

### Progress Bar

- **Height:** 4px
- **Border radius:** 2px
- **Background:** `#00A884`
- **Width:** Percentage of votes

### Vote Count

- **Font:** 11px
- **Colour:** `#8696A0`
- **Position:** Right of option text

### States

- **Voted:** Green border (2px), check icon
- **Unvoted:** Gray border (1px)
- **Disabled (voted):** No interaction
- **Expired:** "Poll closed" text, 11px, `#8696A0`

---

## 28. System Message

### Container

- **Text align:** Center
- **Padding:** 8px 16px
- **Margin:** 8px 0

### Text

- **Font:** 12px
- **Colour:** `#8696A0`
- **Background:** `rgba(0,0,0,0.1)` (dark) / `rgba(0,0,0,0.05)` (light)
- **Padding:** 4px 12px
- **Border radius:** 8px

### Types

- **Group created:** "You created group 'Name'"
- **Member added:** "John added Sarah"
- **Member left:** "Sarah left"
- **Group renamed:** "Group name changed to 'Name'"
- **Group icon changed:** "Group icon changed"
- **Call started:** "Video call started" (📹 prefix)
- **Message deleted:** "This message was deleted"

---

## 29. Chat List Item (Sidebar)

### Container

- **Height:** 72px
- **Padding:** 12px 16px
- **Background:** Transparent (default), `#1F2C33` (selected)
- **Border bottom:** 1px solid `#313D45` (dark) / `#E9EDEF` (light)

### Avatar

- **Size:** 48px × 48px
- **Border radius:** 50%
- **Status dot:** 10px × 10px, bottom-right corner

### Chat Info

- **Name:** 16px bold, single line truncation
- **Last message:** 14px, `#8696A0`, single line truncation
- **Timestamp:** 12px, `#8696A0`, right-aligned

### Unread Badge

- **Size:** 20px × 20px (min), expands with text
- **Background:** `#00A884`
- **Text:** 11px bold, white
- **Padding:** 2px 6px
- **Border radius:** 10px

### Mute Indicator

- **Icon:** Bell off (🔕), 14px × 14px
- **Colour:** `#8696A0`
- **Position:** Below timestamp

### Pin Indicator

- **Icon:** Pin (📌), 14px × 14px
- **Colour:** `#8696A0`
- **Position:** Left of name

### States

- **Hover:** Background `rgba(255,255,255,0.03)` (dark) / `rgba(0,0,0,0.03)` (light)
- **Selected:** Background `#1F2C33` (dark) / `#E9EDEF` (light)
- **Swiped:** Reveals archive (📦) and delete (🗑️) buttons
- **Dragged:** Opacity 0.8, shadow

---

## 30. Empty Chat State

### Container

- **Display:** Flex, center aligned
- **Height:** 100% of chat area
- **Padding:** 32px

### Illustration

- **Size:** 120px × 120px
- **Type:** SVG illustration (chat bubbles)
- **Colour:** `#00A884` (primary), `#374045` (secondary)

### Title

- **Font:** 18px bold
- **Colour:** `#E9EDEF` (dark) / `#111B21` (light)
- **Margin bottom:** 8px

### Description

- **Font:** 14px
- **Colour:** `#8696A0`
- **Max width:** 280px
- **Text align:** Center

### Action Button

- **Height:** 40px
- **Padding:** 0 24px
- **Background:** `#00A884`
- **Border radius:** 20px
- **Font:** 14px bold, white
- **Text:** "Start a conversation"

### States

- **Loading:** Skeleton (3 placeholder bubbles, pulse animation)
- **Error:** "Could not load messages" with retry button
- **Empty (filtered):** "No messages match your search"

---

## Responsive Breakpoints

### Mobile (< 768px)

- Chat list: Full width
- Chat view: Full width
- Input bar: Bottom of screen
- Emoji picker: Bottom sheet (50% height)

### Tablet (768px - 1024px)

- Chat list: 320px width
- Chat view: Remaining width
- Input bar: Bottom of chat view
- Emoji picker: Popover (368px width)

### Desktop (> 1024px)

- Chat list: 400px width
- Chat view: Remaining width (max 800px)
- Input bar: Bottom of chat view
- Emoji picker: Popover (368px width)

---

## Animation Specifications

### Message Send

- **Duration:** 200ms
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Transform:** Scale 0.8 → 1.0, Opacity 0 → 1

### Message Receive

- **Duration:** 150ms
- **Easing:** `ease-out`
- **Transform:** TranslateY(8px) → 0, Opacity 0 → 1

### Typing Indicator

- **Duration:** 300ms (fade in), 200ms (fade out)
- **Easing:** `ease-out`

### Scroll to Bottom

- **Duration:** 200ms
- **Easing:** `cubic-bezier(0.25, 0.46, 0.45, 0.94)`

### Reaction Pop

- **Duration:** 200ms
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Transform:** Scale 0 → 1.2 → 1

### Context Menu

- **Duration:** 150ms
- **Easing:** `ease-out`
- **Transform:** Scale 0.95 → 1.0, Opacity 0 → 1

---

## Accessibility Specifications

### Focus Indicators

- **Outline:** 2px solid `#00A884`, 2px offset
- **Focus visible:** All interactive elements

### ARIA Labels

- Send button: `aria-label="Send message"`
- Voice record: `aria-label="Record voice message"`
- Emoji picker: `aria-label="Open emoji picker"`
- Attachment: `aria-label="Attach file"`
- Each message: `aria-label="Message from {sender}, {timestamp}"`

### Keyboard Navigation

- Tab: Move between interactive elements
- Enter/Space: Activate button
- Arrow keys: Navigate emoji grid
- Escape: Close modals, menus, pickers

### Screen Reader

- Message status: "Sent", "Delivered", "Read"
- Typing indicator: "{name} is typing"
- Reactions: "{emoji} by {count} people"
- Unread count: "{count} unread messages"

---

## Performance Specifications

### Virtual Scrolling

- **Viewport buffer:** 5 items above and below
- **Item height:** 72px (fixed for chat list), variable for messages
- **Recycle threshold:** 50 items

### Image Lazy Loading

- **Intersection observer:** 200px margin
- **Placeholder:** 24px × 24px spinner
- **Progressive JPEG:** Supported

### Animation Performance

- **GPU accelerated:** `transform` and `opacity` only
- **Frame rate:** 60fps target
- **Reduced motion:** Respect `prefers-reduced-motion`

### Memory Management

- **Message limit:** 200 messages in DOM
- **Image cache:** 50MB max
- **Voice message:** Unload after 5 minutes of inactivity

<!-- End of specifications -->
