# Original HelloTalk Moments Feed Screenshot Analysis

Analysis of screenshots from the original HelloTalk Android app
(`/original-hello-talk-screenshots/`), focusing on Moments feed features.

## Summary

The original HelloTalk app has a rich Moments feed (similar to Instagram/Twitter social feed) where users post language learning updates, questions, corrections, and cultural moments. The screenshots reveal multiple interconnected views:

1. **Moments Feed** (screenshots: 012546, 012551, 012559, 012906, 012910, 012920, 012928, 012941, 012946, 012953, 013006, 013018, 013023, 013034, 013040, 013055)
2. **Moment Detail / Comments View** (screenshots: 012615, 012624, 012629, 012635, 012646, 012705, 012715, 012729)
3. **Moment Creation / Compose** (screenshots: 012803, 012815, 012835, 012844, 012851, 012859)
4. **Profile Moments View** (screenshots: 012657, 012747, 012610)

---

## 1. Moments Feed (Main View)

### Layout
- Top app bar with "Moments" title, profile icon (left), notifications bell (right), and compose/camera button
- Horizontal scrollable filter tabs below header: `All`, `For You`, `Classmates`, `Following`
- Feed of individual moment cards in vertical scroll

### Each Moment Card Shows

| Element | Details |
|---------|---------|
| Author avatar | Circular, left-aligned, with online indicator dot |
| Author name | Display name in bold |
| Timestamp | Relative time ("2m ago", "1h ago", "Yesterday") |
| Target language badge | Flag emoji + language name in a small pill (e.g. "🇯🇵 Japanese") |
| Text content | Post body text, expandable if long (Show more/less toggle) |
| Media attachments | Images in a grid (1-9 images), audio with waveform player |
| Like button | Heart icon with count |
| Comment button | Speech bubble icon with count |
| Translate button | "Translation" link below text |
| Voice read-aloud | Speaker icon to TTS the post |
| Correction button | Pencil icon to suggest corrections |
| Quote button | Quote icon to reply with quote |
| Pin indicator | 📌 banner with "Pinned" text (for VIP users) |
| Save/LingQ button | Button to save to reading/spaced repetition |

### Filter Tabs (Horizontal Scrollable Pills)
- `All` - unfiltered global feed
- `For You` - algorithmically recommended
- `Classmates` - users learning the same target language
- `Following` - users the current user follows

### Post Types Observed
- Text-only language questions (e.g. "How do you say...")
- Photo posts with cultural snapshots
- Audio recordings with voice notes
- Correction requests (original text with user asking for corrections)
- Language exchange partner requests

---

## 2. Moment Detail / Comments View

### Layout
- Back navigation arrow + "Moment" or post title
- Expanded post view (full text, all media at full size)
- Comment thread below with nested replies
- Comment input bar at the bottom

### Comment Thread Features
- Nested replies (up to 2 levels) with visual indentation
- Author avatar + name on each comment
- Relative timestamps on comments
- Like button on individual comments
- Reply button on each comment
- Quote-reply to original post text
- Correction sub-threads:
  - Original text displayed
  - Corrected text highlighted with diff view
  - Optional explanation text below correction
  - Visual diff: strikethrough on removed parts, underline/colour on added parts

### Comment Input
- Text input field
- Toggle between "Comment" mode and "Correction" mode
- In correction mode: fields for original text, corrected text, and explanation
- Reply indicator showing "Replying to @username"

---

## 3. Moment Creation / Compose

### Layout
- Collapsible compose form at the top of the feed (or separate full-screen view)
- Current user avatar + text input area
- Target language selector (scrollable language picker)

### Compose Form Elements
| Element | Details |
|---------|---------|
| Text input | Multi-line textarea with placeholder "Share a language moment..." |
| Voice recorder | Microphone button, opens full-screen voice recording overlay |
| Image URL input | Text field to paste image URL + add button |
| Media preview | Thumbnails of attached images/audio with remove (✕) button |
| Target language picker | Compact dropdown with flag + language name |
| Post button | Gradient orange-to-yellow "Post" button |

### Voice Recorder Overlay
- Full-screen modal with dark background
- Waveform visualisation during recording
- Record/stop/send controls
- Maximum 60 second duration limit
- Cancel button

---

## 4. Profile Moments View

### Layout
- Profile header with user avatar, stats (followers, following, moments count)
- Tabbed view: `Moments`, `Profile`, `Languages`, etc.
- Grid or list of user's own moments
- Pin/unpin toggle for VIP users on their own posts

### Profile Moment Cards
- Compact version of feed cards
- Shows text preview, media thumbnail, likes/comments counts
- Timestamp and language badge

---

## Key Design Patterns

### Visual Design
- **Dark theme:** `#121212` background, with `#202C33` secondary surface
- **Neon accents:** Purple (`#c084fc`) for interactive elements, amber for corrections
- **Gradient buttons:** Orange-to-yellow gradient for primary action (Post)
- **Dense information display:** Compact but readable layout with clear visual hierarchy
- **Flag indicators:** Country flag emoji before each language reference
- **Rounded containers:** `rounded-2xl` cards, `rounded-full` pills

### Card Design
- Avatar always left-aligned (start-aligned for RTL compatibility)
- Target language badge as small rounded pill next to author info
- Action bar at bottom with consistent icon+count format
- Translation panel as expandable section below text
- Comments section expands inline below the post

### Filter System
- Primary: horizontal scrollable pills (All, For You, Classmates, Following)
- Consistent with other app screens (chat search, find partners, etc.)
- Active pill has neon purple fill, inactive pills are outlined

### Interaction Patterns
- Tap heart to like/unlike (with haptic feedback)
- Tap speech bubble to expand/collapse comments
- Tap speaker icon for TTS
- Tap pencil for ghost correction (opens correction modal or inline form)
- Tap "Translation" to show/hide auto-translated text
- Long press text to select for quote or save to vocabulary
- Tap word tokens for dictionary lookup (word definition modal)
- Infinite scroll (load more as user scrolls down)

---

## Current Implementation Gaps

| Feature | Original App | Current Codebase |
|---------|-------------|------------------|
| Moments feed layout | Mature, polished | Partially implemented |
| Moment detail view | Separate full-screen detail | Inline comments only |
| Profile moments tab | Grid view of user's posts | Not implemented |
| Nested thread comments | Indented nested replies | Supported via parent_comment_id |
| Correction mode in comments | Toggle comment/correction | Supported via correctionModeMap |
| Visual diff for corrections | Strikethrough/colour diff | Supported via VisualDiffComponent |
| Ghost correction | Text selection opens correction | Supported via openGhostCorrection |
| Voice recording for posts | Full-screen waveform UI | Supported via VoiceRecorderComponent |
| Target language badge | Flag + language name pill | Supported |
| Image grid in posts | 2-3 column grid | Supported with grid-cols-2 |
| Audio player in posts | Inline waveform player | Supported with HTML5 audio |
| Pin/VIP feature | VIP pin to top of profile | Supported |
| LingQ/SRS save | Save post to vocabulary | Supported via saveMomentSentenceToLingq |
| Word tokenisation | Tap words for definition | Supported via TokenisedTextComponent |
| Inline translation toggle | Show/hide translation | Supported with caching |
| Infinite scroll | Auto-load on scroll | Supported via scroll handler |
| Text expand/truncate | Show more/less for long text | Supported (140 char threshold) |
| Filter tabs | All, For You, Classmates, Following | All, For You, Classmates, Following |
| Like/liked-by modal | Shows users who liked | Supported via LikedByModalComponent |
| Quote to comment | Quote text in reply | Supported via quoteTextToComment |
| Share / repost | Reshare moments | Not implemented |
| Report moment | Report inappropriate content | Not implemented (backend endpoint exists) |
| Moment search/discovery | Search within moments | Not implemented |
| Draft saving | Auto-save drafts | Supported via DraftService |
| Empty state illustration | SVG illustration | Supported via AppEmptyStateComponent |
| Loading skeleton | Skeleton placeholders | Basic loading state only |

---

## Design Tokens Reference

### Colour Palette (Moments Feed Specific)
| Token | Value | Usage |
|-------|-------|-------|
| `#121212` | Background surface | Feed background |
| `#202C33` | Surface secondary | Card backgrounds |
| `#c084fc` | Purple accent | Interactive elements, active filters |
| `#f59e0b` | Amber | Correction actions |
| `#f97316` | Orange | Post button gradient start |
| `#eab308` | Yellow | Post button gradient end |
| `#ef4444` | Red | Like heart (active) |

### Spacing
- Card padding: `p-4` (16px)
- Avatar size: `h-12 w-12` (48px) in feed, `h-10 w-10` (40px) in compose
- Media grid gap: `gap-2` (8px)
- Action bar gap: `gap-5` (20px)
- Border radius: `rounded-2xl` (16px) cards, `rounded-full` (9999px) pills

### Typography
- Post title/name: `text-[15px] font-bold`
- Post body: `text-[15px] leading-relaxed`
- Action labels: `text-xs font-bold`
- Timestamps: `text-[11px]`
- Language badge: `text-[10px] font-bold`