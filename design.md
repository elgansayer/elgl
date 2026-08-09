# HelloTalk Clone - Complete Design & Architecture Reference

> This document is the single source of truth for building the entire application from scratch. It covers every feature, every screen, every UI component, every design token, and every backend module. Paste this document into Claude Code to scaffold or rebuild the full application.

---

## 1. Project Overview

A pixel-perfect, mobile-first clone of HelloTalk - a language exchange social network. The application combines real-time chat, VoIP/video calling, a social feed ("Moments"), interactive AI-powered reading, drop-in audio/video rooms, gamification, and a full virtual economy, all running on a modern Angular + NestJS stack.

**Design philosophy:** Dark-mode first (`#121212` base), vibrant neon purple/cyan accents, dense information architecture, flag/language indicators everywhere, horizontal scrollable pill filters, gradient buttons, and card-based layouts. Mobile experience is primary; tablet and desktop use multi-pane/sidebar layouts.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Angular v22+ | Standalone components, signals-first, no legacy decorators |
| Styling | Tailwind CSS | Logical properties only (RTL-safe), dark mode via `class` strategy |
| Backend API | NestJS (TypeScript) | Modular, one folder per domain |
| Database | Supabase (PostgreSQL) | PostGIS for geospatial, `pg_trgm` for fuzzy search |
| Auth | Supabase Auth | JWT, custom `SupabaseAuthGuard`, 2FA, device transfer |
| Real-Time Messaging | Centrifugo + Redis | Pub/sub, fan-out feeds, presence, typing indicators |
| Real-Time AV | LiveKit (WebRTC SFU) | VoIP, video calls, drop-in rooms, live streams |
| Media Storage | Cloudflare R2 | S3-compatible, zero egress fees |
| Translation | DeepL API | 260+ languages, free-tier daily cap via Redis |
| Grammar/Pronunciation | Azure Cognitive Services | Azure Translator + Azure Speech SDK |
| Language Detection | NLP.js | Backend, lightweight, no external dependency |
| Payments | Stripe + Apple IAP + Google Play | Webhook-verified, receipt-validated |
| AI Conversations | LLM Proxy (backend) | Proxied OpenAI/Anthropic calls for AI conversation feature |
| Push Notifications | Firebase Cloud Messaging (FCM) | Mobile and web push |

---

## 3. Design Language & Token System

### 3.1 Colour Palette

```
/* Backgrounds - always dark */
surface-500: #121212   /* page background */
surface-400: #161616   /* subtle elevation */
surface-300: #1A1A1A   /* card background */
surface-200: #1E1E1E   /* elevated card */
surface-100: #2C2C2C   /* input background, borders */
surface-50:  #2C2C2E   /* highest elevation surface */

/* Brand Accent - Purple */
primary:       #9333EA
primary-dark:  #7E22CE
primary-light: #A855F7

/* Secondary Accent - Cyan */
secondary:       #06B6D4
secondary-dark:  #0891B2
secondary-light: #22D3EE

/* VIP Gold */
vip:       #F59E0B
vip-light: #FBBF24
vip-dark:  #D97706

/* Text */
text-primary:   #F9FAFB   /* headings, primary copy */
text-secondary: #9CA3AF   /* subtext, labels */
text-muted:     #6B7280   /* placeholders, disabled */

/* Semantic */
success: #22C55E   /* green */
warning: #F59E0B   /* amber */
error:   #EF4444   /* red */
info:    #3B82F6   /* blue */

/* Vocabulary SRS colours */
vocab-new:      #3B82F6   /* Blue  - Level 0, unknown */
vocab-learning: #EAB308   /* Yellow - Levels 1-3, in review */
vocab-known:    #F9FAFB   /* White  - Level 4, mastered */
```

### 3.2 Typography

```
/* Font stack */
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Scale */
text-xs:   0.75rem / 1rem      /* captions, timestamps */
text-sm:   0.875rem / 1.25rem  /* secondary labels, chips */
text-base: 1rem / 1.5rem       /* body text, messages */
text-lg:   1.125rem / 1.75rem  /* card titles */
text-xl:   1.25rem / 1.75rem   /* section headings */
text-2xl:  1.5rem / 2rem       /* page headings */
text-3xl:  1.875rem / 2.25rem  /* hero text */

/* Weights */
font-normal:    400
font-medium:    500
font-semibold:  600
font-bold:      700
```

### 3.3 Spacing, Radius & Elevation

```
/* Border radius */
rounded-sm:    0.25rem   /* small badges */
rounded:       0.375rem  /* inputs */
rounded-md:    0.5rem    /* small cards */
rounded-app:   1rem      /* standard cards, modals */
rounded-card:  1.25rem   /* profile cards */
rounded-sheet: 1.5rem    /* bottom sheets */
rounded-pill:  9999px    /* pills, chips, badges */

/* Shadows (dark mode) */
shadow-card: 0 1px 2px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.4)
shadow-lift: 0 8px 30px rgba(0,0,0,0.5)

/* Border */
border-width: 1px
border-color: surface-100 (#2C2C2C)
```

### 3.4 Motion & Animation

```
/* Easing */
ease-app: cubic-bezier(0.2, 0.8, 0.2, 1)

/* Durations */
duration-fast: 140ms   /* micro interactions, hover states */
duration-base: 180ms   /* standard transitions */
duration-slow: 260ms   /* page transitions, modals */

/* Common animations */
- Entrance: translateY(8px) + opacity 0->1, duration-base, ease-app
- Exit:     translateY(4px) + opacity 1->0, duration-fast, ease-app
- Scale press: scale(0.97) on :active
- Shimmer: gradient sweep for skeleton loaders
- Confetti: celebration overlay (streaks, achievements)
- Pulse ring: incoming call, live indicator
```

### 3.5 RTL Layout Rules

ALL layout utilities must use Tailwind logical properties:

| Physical (BANNED) | Logical (REQUIRED) |
|---|---|
| `pl-` / `pr-` | `ps-` / `pe-` |
| `ml-` / `mr-` | `ms-` / `me-` |
| `left-` / `right-` | `start-` / `end-` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `text-left` / `text-right` | `text-start` / `text-end` |

---

## 4. UI Primitive Components

Every feature component is assembled from these shared primitives. All primitives are in `src/app/components/primitives/`.

### 4.1 `app-button-primary`
**Purpose:** Primary CTA button - purple gradient, full or inline width.

```
Inputs:
  size: 'sm' | 'md' | 'lg'  (default: 'md')
  disabled: boolean          (default: false)
  type: 'button' | 'submit' | 'reset'  (default: 'button')
  customClass: string        (extra Tailwind classes)

Outputs:
  clicked: MouseEvent

Styles:
  Background: linear-gradient(135deg, primary #9333EA -> primary-dark #7E22CE)
  Text: white, font-bold
  Hover: brightness-110, scale(1.02)
  Active: scale(0.97)
  Disabled: opacity-40, cursor-not-allowed
  Focus ring: ring-2 ring-primary ring-offset-2 ring-offset-surface-500
  Size sm: px-3 py-1.5 text-sm rounded-pill
  Size md: px-5 py-2.5 text-base rounded-pill
  Size lg: px-7 py-3.5 text-lg rounded-pill
```

### 4.2 `app-button-secondary`
**Purpose:** Secondary / ghost button - outlined or subtle fill.

```
Inputs: same as app-button-primary

Styles:
  Background: transparent
  Border: 1px solid primary (#9333EA)
  Text: primary colour (#9333EA)
  Hover: bg-primary/10
  Active: bg-primary/20
  Disabled: opacity-40
```

### 4.3 `app-gradient-button`
**Purpose:** Full-width gradient CTA - used on subscription, onboarding, key flows.

```
Inputs:
  label: string
  disabled: boolean
  loading: boolean

Styles:
  Width: 100%
  Background: linear-gradient(90deg, #9333EA 0%, #06B6D4 100%)
  Text: white, font-bold, text-lg
  Height: 52px
  Border-radius: rounded-pill
  Loading state: spinner replaces label
```

### 4.4 `app-card`
**Purpose:** Standard content container.

```
Inputs:
  elevated: boolean  (adds shadow-lift)
  padding: 'none' | 'sm' | 'md' | 'lg'

Styles:
  Background: surface-300 (#1A1A1A)
  Border: 1px solid surface-100 (#2C2C2C)
  Border-radius: rounded-card (1.25rem)
  Shadow: shadow-card (when elevated)
  Overflow: hidden
```

### 4.5 `app-chip`
**Purpose:** Filter chip / tag - toggleable.

```
Inputs:
  label: string
  selected: boolean
  icon: string (optional emoji or icon name)

Outputs:
  toggled: boolean

Styles:
  Inactive: bg-surface-100, text-text-secondary, border border-surface-50
  Active: bg-primary/20, text-primary-light, border border-primary
  Border-radius: rounded-pill
  Padding: px-3 py-1 text-sm
  Transition: duration-fast ease-app
```

### 4.6 `app-pill`
**Purpose:** Language/skill label - purely display (non-interactive).

```
Inputs:
  label: string
  flag: string (emoji flag)
  level: 'beginner' | 'intermediate' | 'advanced' | 'native' (optional)

Styles:
  Background: surface-200
  Border-radius: rounded-pill
  Padding: px-2.5 py-0.5 text-xs
  Flag rendered before label text
  Level colour dot indicator (green=native, cyan=advanced, yellow=intermediate, grey=beginner)
```

### 4.7 `app-scrollable-pills`
**Purpose:** Horizontal scrollable row of filter pills - hides scrollbar.

```
Inputs:
  pills: { id: string; label: string; icon?: string }[]
  selectedId: string

Outputs:
  selected: string

Styles:
  display: flex, flex-nowrap, overflow-x-auto
  gap-2, pb-1 (for scrollbar clearance)
  Scrollbar: hidden (scrollbar-none)
  Snap: scroll-snap-type-x mandatory, each pill scroll-snap-align-start
```

### 4.8 `app-input`
**Purpose:** Standard text input.

```
Inputs:
  type: string
  placeholder: string
  value: string
  disabled: boolean
  error: string (optional error message)
  label: string (optional floating label)

Outputs:
  valueChange: string

Styles:
  Background: surface-100 (#2C2C2C)
  Border: 1px solid surface-50, focus: border-primary
  Border-radius: rounded (0.375rem)
  Text: text-text-primary
  Placeholder: text-text-muted
  Padding: px-4 py-3
  Error state: border-error, error message text-error text-xs mt-1
```

### 4.9 `app-textarea`
**Purpose:** Multi-line text input - auto-grows with content.

```
Inputs/Outputs: same as app-input
Additional: rows: number (min rows)

Styles: same as app-input, resize-none, auto-height via scrollHeight
```

### 4.10 `app-empty-state`
**Purpose:** Placeholder for empty lists/sections.

```
Inputs:
  icon: string (emoji or SVG name)
  title: string (i18n key)
  subtitle: string (i18n key, optional)
  actionLabel: string (i18n key, optional)

Outputs:
  action: void

Styles:
  Centred column layout, py-16
  Icon: text-4xl mb-4
  Title: text-text-secondary text-base font-medium
  Subtitle: text-text-muted text-sm mt-1
  Action button: app-button-secondary mt-6
```

### 4.11 `app-toast`
**Purpose:** Ephemeral notification toast - appears at top of screen.

```
Inputs:
  message: string (i18n key)
  type: 'success' | 'error' | 'info' | 'warning'
  duration: number (ms, default 3000)

Styles:
  Position: fixed top-4 start-1/2 -translate-x-1/2 z-50
  Background: surface-50, border-s-4 (colour by type)
  Border-radius: rounded-app
  Shadow: shadow-lift
  Entrance: slide down + fade in
  Exit: slide up + fade out
```

### 4.12 `app-fluency-indicator`
**Purpose:** Visual language fluency level (coloured dots or bars).

```
Inputs:
  level: 1 | 2 | 3 | 4 | 5
  language: string (ISO code)

Styles:
  5 segmented bars, filled up to `level`
  Level 1-2: yellow (#EAB308)
  Level 3-4: cyan (#06B6D4)
  Level 5 (native): green (#22C55E)
  Compact: h-1.5 rounded-full, 4px gap
```

### 4.13 `app-language-picker`
**Purpose:** Searchable language selection dropdown/sheet.

```
Inputs:
  selected: string[]  (ISO language codes)
  multiple: boolean
  maxSelect: number

Outputs:
  selectionChange: string[]

Styles:
  Opens as bottom sheet on mobile, popover on desktop
  Search input at top
  Scrollable list with flag emojis, language name, native name
  Selected items shown with checkmark
```

### 4.14 `app-audio-equalizer`
**Purpose:** Animated audio bar visualiser (used in voice rooms, voice notes).

```
Inputs:
  active: boolean  (animates when true)
  bars: number     (default: 5)
  colour: string   (CSS colour, default: primary)

Styles:
  Flex row of thin vertical bars
  Each bar animates height independently (staggered keyframes)
  Height range: 4px - 20px
  Bar width: 3px, gap: 2px
  Paused state: all bars at mid height
```

---

## 5. Navigation Architecture

### 5.1 Bottom Tab Bar (Mobile)
Present on all main screens. Five tabs:

| Tab | Icon | Route | Badge |
|---|---|---|---|
| Home | house | `/home` | - |
| Find | compass | `/discovery` | - |
| Moments | image-stack | `/moments` | - |
| Chat | chat-bubble | `/chat` | unread count |
| Me | person-circle | `/profile` | - |

### 5.2 Sidebar Navigation (Desktop - 1024px+)
Left sidebar, 256px wide, `surface-300` background:

- Logo + app name at top
- Full navigation list (all bottom tab routes + secondary routes)
- User avatar + name at bottom
- Right side: main content area (min 600px) + optional detail pane (flex-1)

### 5.3 App Shell
```
<app-shell>
  <app-sidebar />         <!-- desktop only -->
  <router-outlet />       <!-- main content -->
  <app-bottom-tab-bar />  <!-- mobile only -->
  <app-toast-outlet />    <!-- global toast layer -->
  <app-call-overlay />    <!-- incoming call overlay -->
</app-shell>
```

---

## 6. All Application Screens & Pages

### 6.1 Authentication Screens

#### `/onboarding` - Onboarding Wizard
Multi-step welcome wizard for new users:
- Step 1: Welcome splash (logo, tagline, "Get Started" gradient button)
- Step 2: Native language selection (searchable list with flags)
- Step 3: Target language selection (multi-select, max 3)
- Step 4: Proficiency self-assessment (A1-C2 slider per language)
- Step 5: Learning goals (chip selection: casual, serious, travel, work, culture)
- Step 6: Interests/hobbies (hobby tag grid)
- Step 7: Avatar + display name
- Step 8: Notification permissions (illustrated permission request card)
- Progress: step dots at top, back/next buttons
- Design: full-screen dark, gradient hero on step 1, `app-gradient-button` for primary actions

#### `/forgot-password` - Password Reset
- Email input with `app-input`
- "Send Reset Email" primary button
- Confirmation screen with email illustration

#### `/account/deletion` - Account Deletion
- Warning card explaining consequences
- Confirmation checkbox
- Red "Delete Account" `app-button-primary` (error colour variant)

### 6.2 Home Dashboard

#### `/home` - Home Page
Dashboard combining feed preview, quick actions, and live indicators:

**Sections:**
- **Header bar:** greeting (localised, time-aware), notification bell with badge, search icon
- **Study streak widget:** flame icon, streak count, XP progress ring
- **Quick actions row:** horizontal scroll - "Find Partner", "Moments", "Voice Room", "Lessons", "AI Chat"
- **Daily Word widget:** `word-of-the-day` card - word, definition, pronunciation button, add-to-flashcards button
- **Active voice rooms:** horizontal scroll cards showing live room previews with participant count, language flags, topic chips
- **Recent moments:** 2-3 preview cards linking to `/moments`
- **Study buddy suggestion:** profile card of a recommended partner
- Design: `surface-500` bg, section headers in `text-text-secondary text-sm uppercase tracking-wider`

### 6.3 Discovery (Find Partners)

#### `/discovery` - Discovery Screen
**Layout:** Full-screen with fixed filter bar at top, scrollable card grid below.

**Filter bar (horizontal scrollable pills):**
- All / Online Now / Nearby / Serious Learners / New Users
- Country chip (opens country picker sheet)
- Language chip (opens language picker sheet)
- Age range chip (opens slider sheet)
- Gender chip (M / F / All)
- Proficiency chip

**Profile cards (grid, 2 columns on mobile, 3+ on desktop):**
- Cover photo background with gradient overlay
- Circular avatar (72px)
- Display name + flag emoji (native language)
- Language pills row (`app-pill`): native + target with fluency bars
- Hobby tags: up to 3 chips
- Online status dot (green = online, grey = offline)
- "Say Hi" button - `app-button-primary` size sm
- VIP badge if applicable (gold crown icon)

**Global search:** slide-down search bar, searches by name / language / country using `pg_trgm`

#### `/discovery/audio-intro-feed` - Audio Intro Feed
Grid of users with audio introductions:
- Avatar with play button overlay
- Name + languages
- `app-audio-equalizer` animates while playing
- Tap avatar: plays audio intro, shows "Message" and "Follow" buttons

### 6.4 Social Feed (Moments)

#### `/moments` - Moments Feed
Instagram-style vertical timeline:

**Tab bar:** All / Following / Classmates (chip row at top)

**Moment card:**
- Header: avatar (40px), username, native/target language pills, timestamp, "..." menu
- Content: text (tokenised via `Intl.Segmenter`, tappable words), up to 9 images (grid), or audio player bar
- AI toolbar row: Translate (globe icon), TTS (speaker icon), Correction (pen icon), Transliterate (ABC icon)
- Reaction bar: like (heart), comment (bubble), share (arrow), correction count
- Comment preview: 2 latest comments with correction diffs inline
- Pinned badge (VIP feature)

**Create moment FAB:** purple gradient floating button (+), opens creation sheet:
- Text input with language detection label
- Image attachment (up to 9)
- Audio record button (60s max)
- Post button (`app-gradient-button`)

### 6.5 Chat System

#### `/chat` - Chat List
**Search bar** at top (inline, not separate page).

**Conversation list items:**
- Avatar (48px) with unread dot
- Display name + language flag
- Last message preview (truncated, 1 line)
- Timestamp (relative: "2m", "Yesterday", "Mon")
- Unread badge count (purple circle)
- Pinned icon (pin) for pinned chats
- VIP gold border on avatar for VIP users
- Swipe left: delete/archive actions
- Long press: pin, mute, block, report

**Sections:** Pinned (if any) / All conversations
**Filter tabs at top:** All / Unread / Groups

#### `/chat/:id` - Chat Room
**Header:** back arrow, avatar (40px), name, "Online" / last-seen label, video-call icon, phone icon, "..." icon.

**Message bubbles:**
- Own messages: aligned to end, primary purple background, white text
- Partner messages: aligned to start, `surface-200` background, `text-text-primary`
- Timestamps: below bubble, `text-text-muted text-xs`
- Read receipts: double-tick icon (grey = sent, blue = read)
- Bubble shapes: rounded-app, own messages flatter corner on end-bottom, partner on start-bottom
- Reactions: emoji reaction row below bubble (tap + to add)
- Reply thread: indented quote bar with original excerpt
- Long-press: context menu (Reply / Copy / Correct / Translate / TTS / React / Delete / Report)

**Message types:**
- Text: rendered via `app-tokenised-text` (word tokens clickable)
- Voice note: waveform bar, duration, play/pause button, `app-audio-equalizer`
- Image: rounded thumbnail (max 240px wide), tap to expand in `app-image-lightbox`
- Doodle: canvas image, tap to expand
- Correction: visual diff card (red strikethrough original, green new text, explanation below)
- Gift: animated sticker with sender message
- Location: static map thumbnail, address label
- AI correction bubble: different accent colour, robot icon

**Input bar (bottom):**
- Voice record hold-button (microphone)
- Text input (`app-input` variant, expands to 4 rows max)
- Emoji picker button (opens `app-emoji-picker`)
- Sticker/gif button (opens `app-sticker-picker`)
- Grammar check button (AI wand icon)
- Send button (arrow icon, activates when text non-empty)

**AI tools (slide-up panel from "+" button):**
- Translate message
- Grammar check
- Correction tool (opens `app-correction-modal`)
- TTS playback
- Doodle pad (`app-doodle-pad`)
- Send gift (`app-gift-picker`)

#### Chat Modals & Overlays

**`app-correction-modal`:**
- Original text displayed
- Editable correction text field
- Explanation text field
- "Send Correction" `app-button-primary`
- Visual diff preview (red/green diff)

**`app-visual-diff`:**
- Side-by-side original (red strikethrough) vs corrected (green text)
- Explanation card below
- Accept/Dismiss buttons

**`app-emoji-picker`:**
- Grid of emoji by category
- Search bar at top
- Recent emojis row
- Category tabs (faces, nature, food, etc.)

**`app-sticker-picker`:**
- Horizontal category tabs
- Grid of sticker thumbnails
- GIF search tab powered by backend proxy

**`app-doodle-pad`:**
- HTML5 canvas (full screen overlay on mobile)
- Colour palette row (8 colours)
- Brush size slider
- Eraser toggle
- Clear button
- "Send Drawing" button

**`app-gift-picker`:**
- Grid of animated sticker gifts
- Coin cost shown on each (e.g., "10 coins")
- Coin balance shown at top
- "Buy Coins" link if insufficient balance
- Confirmation: "Send [gift] for [X] coins?"

**`app-message-reaction-bar`:**
- Row of emoji reaction options (6 common + "+" for more)
- Long-press message triggers this
- Reaction counts shown on bubble

**`app-message-context-menu` / `app-long-press-context-menu`:**
- Bottom sheet list: Reply, Copy, Correct, Translate, Read Aloud, React, Forward, Delete, Report

**`app-chat-search`:**
- Slide-in overlay from top
- Text input, searches message history
- Highlights matching text in results

**`app-threaded-reply`:**
- Quoted message preview bar above input
- Dismiss X button on quote bar
- Sent reply appears indented under original

#### `/groups` - Groups Discovery
**Browse groups by language pair:**
- Group card: cover image, name, member count, language chips, "Join" button
- My Groups section at top
- Create Group FAB

**`app-create-group` modal:**
- Group name, description
- Language selection
- Privacy toggle (Public / Private)
- Invite friends list

#### `/communities` - Communities
Topic-based discussion communities:
- Community cards: icon, name, member count, description snippet
- Browse by topic tags (Technology, Travel, Culture, etc.)
- Join/Leave button
- Inside community: threaded posts + comment threads

### 6.6 Audio & Video Rooms

#### `/audio-rooms` - Audio Room Browser
**Live rooms list:**
- Room card: language flag pair, topic chip, participant avatars (max 5 shown), live count, "Join" button
- Room status badge: "LIVE" (pulsing red dot)
- Filter pills: by language, by topic, by audience size
- "Create Room" FAB (`app-voiceroom-create-modal`)

**`app-voiceroom-create-modal`:**
- Room title input
- Language pair selection
- Topic tags (chip selection)
- Audience limit toggle
- "Go Live" `app-gradient-button`

#### `/preview/room/:id` - Voice Room Preview
Pre-join screen showing room details, participant list, and "Join" button.

#### Active Audio Room (full-screen overlay)
**Layout:**
- Top bar: room title, language chips, listener count, share icon, X (leave)
- Stage area (large): speaking participants shown as avatar cards with audio ring animation + `app-audio-equalizer`
- Audience row: small avatars grid
- Bottom bar: mute/unmute toggle, raise hand button, leave button
- Chat tab: `app-room-chat` Centrifugo channel (text overlay)
- Notes button: opens `app-voiceroom-notes`

#### `/voiceroom-notes/:roomId` - Voice Room Notes
Notepad for taking notes during a room session:
- Markdown-ish text area
- Auto-saved to Supabase
- "Add Flashcard" inline button (saves selected word to vocabulary)

#### `/host-dashboard` - Host Dashboard
Analytics for audio/video room hosts:
- Total listeners today/week/month (line chart)
- Tips received (coin count)
- Follower growth
- Top moments / interactions
- Scheduled rooms list
- "Start New Room" CTA

#### Video Call (LiveKit)
#### `/video-call` - Video Call Screen
Full-screen LiveKit video:
- Partner video feed (large)
- Self preview (small, draggable PiP)
- Controls bar: mute audio, mute video, flip camera, end call, chat overlay toggle
- Split-screen co-host mode: 50/50 split with shared stage controls
- Incoming call: `app-incoming-call-modal` (avatar, name, "Accept" green / "Decline" red)

#### `/active-call` - Active VoIP Call
Audio-only call screen:
- Large avatar circle (64px) with audio ring animation
- Name + language
- Call duration timer
- Controls: mute, speaker, end call (red circle button)

### 6.7 AI & Learning Tools

#### `/ai-conversation` - AI Conversation Partner
Chat interface with an AI language tutor:
- AI avatar at top (animated speaking indicator)
- Standard chat bubble layout
- Language context selector (I'm learning: X, My level: A2)
- AI response includes correction diff automatically
- "Explain this" and "Give me another example" quick-reply chips
- Session summary card at end: words learned, corrections made

#### `/vocabulary` - Vocabulary Dashboard
SRS flashcard and vocabulary management:
- Stats header: total words, words due today, mastery % ring chart
- Tab bar: Due Now / All / By Language / By Status
- Word list: word token, translation, SRS level indicator (`vocab-new` blue / `vocab-learning` yellow / `vocab-known` white), next review date
- Swipe right: mark known; Swipe left: needs review
- Flashcard review mode: full-screen card flip animation
- Filters: by language, by SRS level

**`app-word-definition-modal`:**
- Word in large heading
- Phonetic pronunciation + speaker button
- Translation (target language)
- Example sentences (clickable via `app-tokenised-text`)
- SRS level selector (dropdown)
- "Add to Flashcards" button
- "Hear it" TTS button

**`app-tokenised-text`:**
- Every word rendered as `<span>` with click handler
- SRS colour applied as background or underline
- Tap: opens `app-word-definition-modal`
- Long-press: "Copy", "Translate all", "Search" context menu

#### `/lessons` - Lessons Page
Curated lesson catalogue:
- Featured lesson carousel (full-width cards with image)
- Category filter pills: Grammar, Vocabulary, Pronunciation, Culture, Reading
- Lesson card: image thumbnail, title, language, difficulty chip, duration, "Start" button
- Progress bar on started lessons

#### `/quests` - Daily Quests
Gamified daily tasks:
- Quest list: icon, title, description, progress bar (X/Y), XP reward badge
- Daily streak quest at top (most prominent)
- Completed quests shown with green checkmark + confetti micro-animation
- "Claim XP" button on completed quests

#### `/milestones` - Learning Milestones
Achievement milestone timeline:
- Vertical timeline, milestones as nodes
- Completed: filled purple circle, checkmark
- Current: pulsing ring
- Locked: grey dashed circle
- Milestone detail: title, description, reward (badge image + XP)

#### `/study-buddy` - Study Buddy Matching
Find a dedicated language exchange partner:
- Filter by timezone, availability, goals, language level
- Profile cards with match % indicator
- "Invite as Study Buddy" button
- Study buddy dashboard: shared goals, streak together, scheduled sessions

#### `/resource-library` - Resource Library
Curated learning resources:
- Category tabs: Articles, Videos, Podcasts, Worksheets
- Resource cards: thumbnail, title, language, level, duration
- Bookmarking (saves to favourites)
- Opens in-app document/video viewer

**`app-audio-sync-reader`:**
- Article text rendered via `app-tokenised-text`
- Audio player bar at bottom
- As audio plays, current phrase highlighted (cyan underline)
- Synced via `timeupdate` event + timestamp map from backend

#### `/pronunciation-feedback` - Pronunciation Feedback
- Text prompt card
- "Record" hold-button
- Waveform visualiser during recording
- Score result: 0-100 dial, breakdown (accuracy, fluency, completeness)
- Phoneme-level heat map (red=wrong, green=correct)

#### `/proficiency` - Proficiency Assessment
Diagnostic quiz to determine language level:
- Multi-step quiz (reading, listening, grammar)
- Question card with multiple choice or type-in
- Progress bar
- Result: CEFR level badge (A1/A2/B1/B2/C1/C2)

#### `/study-streak` - Study Streak
Dedicated streak management:
- Flame icon, day count, "X days in a row!"
- Calendar heatmap (GitHub-style) showing activity
- Today's tasks checklist
- Streak protection info (VIP: freeze streak)
- History chart

### 6.8 Profile & Social

#### `/profile` - Own Profile
**Layout:**
- Cover photo (full-width, 200px high) with edit button
- Avatar (80px circle) overlapping cover, with camera edit icon
- Name, age, country flag
- Native + target language pills with fluency bars
- Bio text (expandable)
- Hobby tags row
- Stats row: Moments / Followers / Following counts (tappable)
- "Edit Profile" button
- Pinned moments section
- Moments grid / list toggle

**`app-profile-edit` sheet:**
- Display name input
- Bio textarea (200 char limit)
- Birthday picker
- Country selector
- Gender selector
- Language manager

**`app-cover-photo-uploader` + `app-cover-photo-cropper`:**
- Image picker (camera or gallery)
- Crop UI with aspect ratio locked 16:9
- Upload to R2

**`app-avatar-upload`:**
- Circle crop UI
- Upload to R2

#### `/profile/:userId` - User Detail (External Profile)
Same layout as own profile but:
- "Message" gradient button replaces "Edit Profile"
- "Follow" / "Unfollow" toggle button
- "Gift" coin button
- "Report" in "..." menu
- "Block" in "..." menu
- Mutual languages highlighted

**`app-external-profile`:**
Component version used in chat and discovery cards (side panel on desktop).

#### `/visitors` - Visitor Logs
Who viewed your profile:
- "Blurred" state for free users (3 blurred cards + "Unlock with VIP" card)
- Full list for VIPs: avatar, name, language, timestamp, "Message" button

#### `/favourites` - Saved Content
Tabbed: Messages / Moments / Words / Resources
- Saved items in list format
- Remove button (swipe left)

#### `/leaderboard` - Global Leaderboard
- Tab bar: This Week / All Time / Friends
- Rank list: position number, avatar, name, language flags, XP count
- Top 3: podium cards with gold/silver/bronze styling
- Own rank card pinned at bottom (always visible)

#### `/stats` - My Stats
Personal usage analytics:
- Cards: Messages sent, Corrections given/received, Words learned, Study hours
- Bar chart: activity over 7 days
- Language breakdown pie chart
- Pronunciation average score

### 6.9 Settings & Account

#### `/settings` - Settings Hub
Settings list (grouped):

**Account:** Profile, Language Settings, Linked Accounts, Privacy Settings, Notification Preferences, Appearance
**Chat:** Chat Settings, Data & Storage, Chat Backup
**Subscription:** My Subscription, VIP Features, Buy Coins, Restore Purchases
**Safety:** Block Management, Report History
**Legal & Help:** Help Centre, About, Terms, Privacy Policy, GDPR, Version Info
**Danger Zone:** Account Deletion

Each row: icon (left), label, value/chevron (right), `surface-300` background rows with `surface-100` dividers.

#### `/language` - Language Settings
- Native language (single select)
- Learning languages (multi, up to 3 for VIP / 1 for free)
- App UI language (locale)
- Study reminders per language

#### `/settings/linked-accounts` - Linked Accounts
Connect social: Google, Apple, Facebook
Shows connected/disconnected status with connect/disconnect buttons.

#### `/notification-preferences` - Notification Preferences
Toggle list:
- New message / New follower / Corrections / Moments likes / Voice room invites / Daily reminder
- Push / In-app / Email columns
- "Quiet hours" time range picker

#### `/pages/appearance-settings` - Appearance Settings
- Theme: Dark only (default, non-changeable for MVP)
- Font size: `app-font-scale-slider` (5 steps, preview text below)
- Language (UI locale): `app-language-selector`

#### `/chat-settings` - Chat Settings
- Read receipts toggle
- Typing indicators toggle
- Auto-download media (WiFi only / Always / Never)
- Message font size slider
- Bubble colour selector (own messages accent colour)

#### `/data-storage` - Data & Storage
- Storage used breakdown (messages, media, cache)
- "Clear Cache" button
- "Manage Downloads" list
- Auto-delete old media toggle

#### `/pages/chat-backup` - Chat Backup
- Last backup: timestamp
- "Back Up Now" button
- Auto-backup toggle (WiFi only)
- Cloud storage used indicator

#### `/privacy` (as a settings sub-page) - Privacy Settings
**`app-privacy-settings`:**
- Profile visibility: Everyone / Followers Only / Nobody
- "Who viewed me" visibility toggle
- Hide age toggle
- Hide location toggle
- Incognito mode (VIP only - gold badge)
- Block list link

#### `/blocks` - Block Management
List of blocked users:
- Avatar, name, "Unblock" button per row

#### `/gdpr` - GDPR & Personal Data
- Download my data button
- View data breakdown
- Right to erasure explanation
- Account deletion link

### 6.10 Monetisation

#### `/vip` - VIP Landing Page
Sales page for VIP subscription:
- Hero: gold crown illustration, "Go VIP" heading, tagline
- Feature comparison table: Free vs VIP
- Price cards: Monthly (8 UKP / $10 USD) and Annual (6 UKP / $8 USD/month)
- Testimonials carousel
- "Start Free Trial" `app-gradient-button`
- VIP badge preview animation

#### `/subscription` - Subscription Plans
Full plan selection:
- Consumer VIP: 8 UKP / $10 USD/month
- Annual Consumer VIP: 6 UKP / $8 USD/month billed annually
- Developer/Creator: 20 UKP / $26 USD/month
- Plan comparison feature table
- "Continue with [Plan]" button

**`app-subscription-plans` component:** Reusable plan card grid

#### `/subscription/success` - Subscription Success
- Checkmark animation (celebration)
- "You are now VIP!" confirmation
- Unlocked features list
- "Get Started" CTA to home

#### `/subscription/cancel` - Subscription Cancelled
- "No worries" messaging
- Benefits reminder
- "Try VIP Free" secondary offer

#### `/my-subscription` - Current Subscription
- Current plan badge
- Next billing date
- Payment method (masked card)
- "Cancel Subscription" link (with confirmation flow)
- "Upgrade Plan" if on free/basic

#### `/shop` - Coins & Shop
**Coin packages:**
- Package cards: coin count + bonus %, price (dual currency)
- "Best Value" badge on popular package
- Gift items grid (stickers, custom themes, XP boosters)

#### `/cart` - Shopping Cart
- Line items: package/item, price
- Total (dual currency)
- Stripe "Pay Now" button
- Saved payment method or new card

#### `/coins/success` / `/coins/cancel` - Post-Coin Purchase
Standard success/cancel feedback screens.

**`app-restore-purchases-button`:** Triggers Apple/Google IAP restore flow.

### 6.11 Events & Language Parties

#### `/events` - Events Feed
Community learning events:
- Event card: cover image, title, language chips, date, host avatar, attendee count, "RSVP" button
- Filter: Upcoming / Today / This Week
- My Events section

#### `/events/calendar` - Event Calendar
Monthly calendar view with event dots:
- Calendar grid
- Selected day event list below
- "Add Event" FAB (admin/creator only)

**`app-events-calendar` component:** Used in both `/events` and widget on home.

#### `/language-parties` - Language Parties
Themed group video/audio events (special rooms):
- Party card: theme banner, language, scheduled time, capacity indicator
- Live status indicator
- "Join Party" button

### 6.12 Help & Legal

#### `/help` - Help Centre
Searchable FAQ:
- Search bar
- Category cards: Getting Started, Chat & Calls, Account, Payments
- FAQ accordion list

#### `/support` - Support Centre
- Submit support ticket form
- Status of existing tickets

#### `/help-about` - Help & About
App version, credits, open-source licences.

#### `/terms`, `/privacy` - Legal Pages
Scrollable legal text in `app-legal-document-viewer` component.

#### `/version` - Version Check
Current app version, build info, "Check for Updates" button.

### 6.13 Admin Screens

#### `/admin` - Admin Portal
*(Requires adminGuard)*
- Dashboard: user count, active rooms, reports queue count
- Links to: User Management, Lesson Manager, Moderation Queue

**`app-admin-user-actions`:** Ban/unban, promote to VIP, send notification.

#### `/admin/lessons` - Lesson Manager
CRUD for curated lessons:
- Lesson list table
- Create/Edit form: title, content editor, media uploads, language/level tags
- Publish/Unpublish toggle

#### `/admin/moderation` - Moderation Queue
Report review workflow:
- Queue list: reporter, reported user, reason, content preview
- Actions: Dismiss / Warn / Ban
- Moderator notes field

**`app-moderation-queue`:** Reusable component.

### 6.14 Additional Overlays & Modals

#### `app-incoming-call-modal`
Full-screen incoming call:
- Animated ring/pulse around caller avatar
- Caller name + language
- Call type label (Audio / Video)
- Decline (red) / Accept (green) large circular buttons

#### `app-daily-login-modal`
Daily login reward:
- Calendar grid showing reward streak
- Today's reward highlighted (coin amount)
- "Claim" button
- Confetti animation on claim

#### `app-achievement-overlay` / `app-celebration-overlay`
Triggered on milestone completion:
- Full-screen overlay with confetti animation
- Achievement badge illustration
- Title + description
- "Share" button (posts to Moments)
- "Continue" dismiss

#### `app-streak-celebration-overlay` / `app-streak-congratulations`
Triggered when streak milestone hit:
- Flame animation
- Day count prominent display
- Social share option

#### `app-forced-update-modal` / `app-update-modal`
Version enforcement:
- Current vs required version
- "Update Now" button (deep link to store)
- Force close if critical update

#### `app-confirm-dialog`
General-purpose confirmation:
- Title, message
- Cancel (secondary) + Confirm (primary or error) buttons

#### `app-report-user-modal`
Report flow:
- Reason selection (chip list)
- Optional description textarea
- Submit button

#### `app-trust-safety-modal`
Safety tips shown on first message to a new user.

#### `app-liked-by-modal`
Who liked a Moment: avatar list with names.

#### `app-image-lightbox` / `app-lightbox`
Full-screen image viewer:
- Pinch-to-zoom
- Swipe between images
- Download button
- Share button

#### `app-document-viewer`
In-app PDF / article reader using `app-tokenised-text` rendering.

#### `app-cultural-tip`
Periodic pop-up teaching cultural context about the target language (backend-driven).

#### `app-word-of-the-day`
Daily vocabulary widget:
- Word + definition
- Example sentence
- "Add to deck" button
- `app-tokenised-text` for interactive example

#### `app-split-screen-video`
LiveKit co-host layout: two video tiles, 50/50 split, host controls.

#### `app-live-chat-overlay`
Centrifugo text chat layered over audio/video room.

#### `app-soundboard`
Room host soundboard: pre-loaded audio clips (applause, laughter, etc.).

#### `app-diagnostic-quiz`
Multi-question adaptive quiz component used in proficiency assessment.

#### `app-profile-discovery-card`
Profile card used in discovery grid - compact version of profile.

#### `app-hobby-tag-selector`
Grid of hobby chips for profile setup / filter.

#### `app-suggest-flashcards`
Post-conversation modal suggesting words to add to vocabulary deck.

#### `app-pronunciation-feedback`
Score display component (dial + phoneme heatmap).

#### `app-text-to-speech` button component
Inline TTS trigger button (speaker icon).

#### `app-social-login-buttons`
Google + Apple sign-in buttons, properly branded.

#### `app-age-range-slider`
Dual-handle range slider for discovery age filter.

#### `app-font-scale-slider`
Single-handle slider for font size preference.

#### `app-app-language-selector`
UI language dropdown.

#### `app-theme-selector`
Theme picker (dark only for now, future light mode hook).

#### `app-device-transfer`
QR code display + scanner for device-to-device session transfer.

#### `app-developer-dashboard`
API key management, usage stats, webhook configuration.

---

## 7. Complete Feature Inventory

### 7.1 Messaging & Chat
- Real-time 1-on-1 text chat (Centrifugo)
- Group chats (multi-user channels)
- Typing indicators
- Read receipts (double-tick)
- Message reactions (emoji)
- Threaded replies
- Voice notes (hold-to-record, async playback)
- Image sharing (up to 9 per message)
- Doodle/drawing sharing (HTML5 canvas)
- Location sharing (static map)
- Virtual gift sending (animated stickers, coin-based)
- Message search (`pg_trgm`)
- Chat backup & restore (cloud sync)
- Message pinning in group chats
- "Saved Messages" (favourites)
- Stickers & GIFs
- Link previews (backend-generated OG metadata)
- Message forwarding
- Message deletion (own messages)
- Reporting individual messages

### 7.2 VoIP & Video
- 1-on-1 audio call (LiveKit)
- 1-on-1 video call (LiveKit)
- Call logs history
- Incoming call notifications
- In-call mute, camera flip, speaker toggle
- Call end-of-session summary (duration, words discussed)

### 7.3 Drop-In Audio/Video Rooms
- Public audio room creation
- Room roles: Host / Speaker / Listener
- Raise-hand to speak (permission granting flow)
- Room text chat overlay (Centrifugo)
- Room topic tags
- Room scheduling
- Live viewer/listener count
- Tips to host (coin economy)
- Room notes (personal notepad)
- Soundboard for hosts
- Live AI subtitles (speech-to-text captions)
- Stream replay recording (saved to R2)
- Language parties (themed scheduled events)
- Host analytics dashboard
- Split-screen co-host video mode

### 7.4 Social Feed (Moments)
- Text posts (multi-language)
- Multi-image posts (up to 9)
- Audio posts (60s max)
- Like posts
- Comment threads
- Share posts
- Community correction in comments (visual diff)
- Post translation (one-tap)
- Post TTS read-aloud
- Feed filters: All / Following / Classmates
- Profile post pinning (VIP)
- Post reporting / moderation

### 7.5 Discovery & Matchmaking
- Goal-based partner discovery
- Filters: language, country, age, gender, proficiency, online status
- "Serious Learner" algorithmic filter
- Proximity search (PostGIS `ST_DWithin`)
- Audio intro feed
- Global search by name/language/country (`pg_trgm`)
- Profile visit logging ("Who viewed me")
- Study buddy matching (dedicated compatibility algorithm)
- Groups discovery

### 7.6 AI & NLP Tools
- In-line message translation (DeepL, rate-limited)
- Transliteration (Pinyin, Romaji, Cyrillic romanisation)
- Native speaker correction tool (visual diff)
- Text-to-speech playback (Azure TTS)
- Voice-to-text transcription (Azure Speech)
- Grammar checker (pre-send, Azure Translator)
- Pronunciation scoring (Azure Speech SDK, 0-100 score)
- AI conversation partner (LLM-powered chat tutor)
- Language detection (NLP.js)
- Word definition + dictionary lookup
- Cultural insights / tips (backend-generated)

### 7.7 Interactive Reading & Vocabulary
- Universal word tokenisation (`Intl.Segmenter`)
- Click-to-define any word
- SRS flashcard system (Blue/Yellow/White levels)
- Vocabulary dashboard with review queue
- Audio-synchronised text highlighting
- Curated reading articles
- Vocabulary suggestions post-conversation

### 7.8 Gamification & Learning Streaks
- Daily study streak tracking
- XP point system
- Leaderboard (weekly + all-time)
- Achievements system (badges)
- Milestones timeline
- Daily quests
- Daily login reward (coins)
- Streak freeze (VIP)
- Proficiency assessment (CEFR A1-C2)
- Corrector score (reputation for giving quality corrections)

### 7.9 Profile & Social Graph
- User profile (name, age, country, bio, languages, hobbies)
- Cover photo + avatar (R2 storage)
- Follow / unfollow
- Followers / following counts
- Profile visitor logs
- Hobby/interest tags
- Audio introduction recording
- My stats page (activity analytics)

### 7.10 Monetisation
- VIP Consumer subscription: 8 UKP / $10 USD per month
- VIP Annual: 6 UKP / $8 USD per month (billed annually)
- Developer/Creator tier: 20 UKP / $26 USD per month
- Virtual coin bundles (Stripe / Apple IAP / Google Play)
- Coin spending: virtual gifts, room tips, premium stickers
- Restore purchases (IAP)
- Free tier: 1 language, 10 AI translations/day, ads shown
- VIP features: ad-free, unlimited AI, 3 languages, incognito mode, VIP badge, boosted discovery, streak freeze, profile pin

### 7.11 Trust, Safety & Privacy
- Block user
- Report user (reason categorised)
- Report message/moment
- Moderation queue (admin)
- Spam detection (backend ML)
- Granular privacy settings (age, location, search visibility)
- Incognito mode (VIP - browse without logging profile visits)
- GDPR: data download, erasure request
- Scheduled account deletion (30-day cool-off)
- Trust & safety modal (first DM prompt)

### 7.12 Notifications
- Push notifications (FCM)
- In-app notification inbox
- Notification types: new message, new follower, correction received, moment liked, voice room invite, daily reminder, achievement unlocked
- Per-type preferences (push / in-app / email)
- Quiet hours setting

### 7.13 Settings & Account
- Profile editing
- Language management (native + target)
- App UI language (full i18n, any locale)
- Appearance (font size, theme)
- Chat settings (read receipts, typing indicators, media auto-download)
- Data & storage management
- Chat backup/restore
- Notification preferences
- Privacy settings
- Linked social accounts (Google, Apple, Facebook)
- Two-factor authentication (2FA)
- Device transfer (QR code session migration)
- Account deletion with cool-off period
- Version check + forced update modal

### 7.14 Events & Communities
- Event creation, RSVP, calendar view
- Community groups (topic-based)
- Group join via invite code/link
- Scheduled language exchange events

### 7.15 Admin & Developer
- Admin portal (user management, lesson CRUD, moderation queue)
- Developer dashboard (API keys, webhook config, usage analytics)
- LLM proxy (rate-limited AI API access for dev tier)
- Word of the day management
- Curated content management
- Daily tip management

---

## 8. Backend Module Reference

Each NestJS module lives under `backend/src/<module>/` with `controller.ts`, `service.ts`, `module.ts`, `dto/`, and `*.spec.ts`.

| Module | Routes (prefix) | Responsibility |
|---|---|---|
| `auth` | `/auth` | Supabase JWT validation, 2FA, device transfer tokens |
| `users` | `/users` | Profile CRUD, avatar/cover upload, follower graph |
| `chat` | `/chat` | Message CRUD, Centrifugo token minting, message search |
| `chat-backup` | `/chat-backup` | Cloud backup sync endpoints |
| `groups` | `/groups` | Group chat management |
| `communities` | `/communities` | Community CRUD |
| `moments` | `/moments` | Social feed CRUD, fan-out via Redis |
| `feed` | `/feed` | Personalised feed assembly |
| `discovery` | `/discovery` | Partner search, PostGIS proximity, recommendation engine |
| `audio-rooms` | `/audio-rooms` | Room CRUD, LiveKit token minting, stage management |
| `calls` | `/calls` | VoIP/video call initiation, LiveKit room creation, call log |
| `video-calls` | `/video-calls` | Video call specific management |
| `nlp` | `/nlp` | Translation (DeepL), grammar (Azure), TTS (Azure), detection (NLP.js) |
| `pronunciation` | `/pronunciation` | Azure Speech pronunciation scoring |
| `ai-conversation` | `/ai-conversation` | LLM-powered conversation tutor |
| `ai` | `/ai` | General AI utilities |
| `llm-proxy` | `/llm-proxy` | Dev-tier proxied AI API access |
| `flashcards` | `/flashcards` | SRS vocab deck CRUD, review queue |
| `vocabulary` | *(part of flashcards)* | Word state management |
| `lessons` | `/lessons` | Curated lesson CRUD |
| `achievements` | `/achievements` | Achievement definitions + user progress |
| `xp` | `/xp` | XP tracking, award events |
| `leaderboard` | `/leaderboard` | Ranked XP leaderboard queries |
| `streak` | `/streak` | Daily streak tracking |
| `study-streak` | `/study-streak` | Extended streak analytics |
| `quests` | `/quests` | Daily quest definitions + completion tracking |
| `milestones` | `/milestones` | Milestone definitions + user milestones |
| `study-buddies` | `/study-buddies` | Buddy matching algorithm + paired sessions |
| `events` | `/events` | Event CRUD, RSVP management |
| `monetisation` | `/monetisation` | Stripe webhooks, VIP status, subscription management |
| `economy` | `/economy` | Coin balance, coin purchase (IAP receipt validation), coin spending |
| `shopping` | `/shopping` | Cart, order history |
| `notifications` | `/notifications` | FCM push, in-app inbox, preferences |
| `notification-preferences` | `/notification-preferences` | Per-user notification opt-in/out |
| `favourites` | `/favourites` | Saved messages, moments, words |
| `blocks` | `/blocks` | Block/unblock, block list |
| `moderation` | `/moderation` | Report submission, moderation queue |
| `spam-detection` | `/spam-detection` | Automated spam scoring |
| `safety` | `/safety` | Trust & safety flagging |
| `privacy` | `/privacy` | Privacy setting CRUD |
| `profile-visits` | `/profile-visits` | Visitor log writes + VIP-gated reads |
| `hobby-tags` | `/hobby-tags` | Hobby/interest tag catalogue |
| `interests` | `/interests` | User interest associations |
| `audio-intro` | `/audio-intro` | Audio intro recording upload + retrieval |
| `media` | `/media` | Generic R2 upload/delete helpers |
| `cloudflare-r2` | *(internal service)* | R2 presigned URL generation |
| `link-preview` | `/link-preview` | OG metadata scraping |
| `cultural-insights` | `/cultural-insights` | Cultural tips + facts |
| `curated-content` | `/curated-content` | Reading articles management |
| `resource-library` | `/resource-library` | Learning resource catalogue |
| `word-of-the-day` | `/word-of-the-day` | Daily vocab word management |
| `daily-tip` | `/daily-tip` | Daily learning tip CRUD |
| `corrector-score` | `/corrector-score` | Correction quality scoring |
| `proficiency` | `/proficiency` | CEFR assessment quiz + result |
| `quiz` | `/quiz` | Generic quiz engine |
| `recommendations` | `/recommendations` | Content + partner recommendation logic |
| `stats` | `/stats` | User activity statistics |
| `user-statistics` | `/user-statistics` | Aggregate user metrics |
| `host-dashboard` | `/host-dashboard` | Room host analytics |
| `language-challenges` | `/language-challenges` | Timed language challenge events |
| `password-reset` | `/password-reset` | Email-based password reset flow |
| `two-factor` | `/two-factor` | TOTP 2FA setup + verification |
| `transfer` | `/transfer` | Device transfer QR token generation |
| `linked-accounts` | `/linked-accounts` | OAuth social account linking |
| `email` | *(internal service)* | Transactional email (Resend/SMTP) |
| `scheduled-deletion` | *(cron)* | Processes pending account deletions after cool-off |
| `admin` | `/admin` | Admin user management, moderation actions |
| `version` | `/version` | App version check, forced update flags |
| `config` | *(internal)* | Env validation schema (Joi) |
| `supabase` | *(internal service)* | Supabase client singleton |
| `database` | *(internal)* | Migration runner |

---

## 9. Database Schema Summary

Core tables (PostgreSQL + Supabase):

```sql
-- Users
users (id uuid PK, username, display_name, email, avatar_url, cover_url,
       bio, country_code, birth_date, gender, is_vip bool, vip_expires_at,
       coins_balance int, xp_total int, streak_days int,
       native_language varchar, created_at, updated_at)

-- User languages (up to 3 for VIP, 1 free)
user_languages (id, user_id FK, language_code, proficiency_level int,
                is_native bool, learning_goal text)

-- Messages (Centrifugo channels reference these)
messages (id uuid PK, channel_id, sender_id FK, type varchar,
          content jsonb, read_at, created_at, deleted_at)

-- Channels
channels (id uuid PK, type 'dm'|'group'|'room', name,
          participants uuid[], created_by FK, created_at)

-- Moments
moments (id uuid PK, user_id FK, content_type 'text'|'image'|'audio',
         body text, media_urls text[], is_pinned bool,
         likes_count int, comments_count int, created_at)

-- Moment comments
moment_comments (id, moment_id FK, user_id FK, body text,
                 correction_diff jsonb, created_at)

-- Flashcards (SRS)
flashcards (id, user_id FK, word, translation, language_code,
            srs_level int, next_review_at, created_at)

-- Audio rooms
audio_rooms (id, host_id FK, title, language_pair,
             topic_tags text[], is_live bool, listener_count int,
             livekit_room_id, created_at)

-- Events
events (id, creator_id FK, title, description, language_code,
        starts_at, ends_at, rsvp_count, created_at)

-- Achievements
achievements (id, slug, title, description, icon_url, xp_reward int)
user_achievements (id, user_id FK, achievement_id FK, earned_at)

-- Quests
quests (id, slug, title, description, xp_reward, reset_cadence 'daily'|'weekly')
user_quests (id, user_id FK, quest_id FK, progress int, completed_at)

-- Profile visits (PostGIS not needed here, but presence)
profile_visits (id, visitor_id FK, visited_id FK, visited_at)

-- Blocks
blocks (id, blocker_id FK, blocked_id FK, created_at)

-- Reports
reports (id, reporter_id FK, reported_user_id FK, content_type,
         content_id, reason, status 'pending'|'resolved', created_at)

-- Corrections (standalone, referenced in messages + comments)
corrections (id, author_id FK, original_text, corrected_text,
             explanation, language_code, created_at)

-- Coin transactions
coin_transactions (id, user_id FK, type 'earn'|'spend',
                   amount int, reference_type, reference_id, created_at)

-- Spatial index
CREATE INDEX ON users USING GIST (location);  -- PostGIS geometry column
```

---

## 10. Centrifugo Channel Naming

```
dm_{userId_A}_{userId_B}    -- 1-on-1 direct message (sorted IDs)
group_{groupId}             -- group chat
room_{roomId}               -- voice/video room text chat
moments_feed                -- global moments broadcast
notifications_{userId}      -- user-specific notifications
presence_{userId}           -- online presence tracking
```

---

## 11. Angular Architecture Conventions

### 11.1 State Management Pattern
```typescript
// Component state: signals only
protected messages = signal<Message[]>([]);
protected isLoading = signal(false);

// Derived state: computed
protected unreadCount = computed(() =>
  this.messages().filter(m => !m.readAt).length
);

// Async data: resource
protected chatResource = resource({
  request: () => ({ channelId: this.channelId() }),
  loader: ({ request }) => this.chatService.getMessages(request.channelId),
});

// Inputs: signal functions
readonly userId = input.required<string>();
readonly showHeader = input(true);

// Outputs: output() function
readonly messageSent = output<Message>();
```

### 11.2 Routing & Lazy Loading
All routes use `loadComponent()` for lazy loading. Route guards use functional guards (`canActivate: [authGuard]`).

### 11.3 i18n / Translations
All UI text is externalised. Template usage: `{{ 'key.path' | t }}` or `{{ 'key' | t: { name: username() } }}`. TypeScript usage: `this.i18n.translate('key', params)`.

### 11.4 HTTP Services
Services use `HttpClient` with typed responses, return `Promise<T>` (via `firstValueFrom`). Never `.subscribe()` outside of `toSignal()`.

---

## 12. Build & Development Setup

### Prerequisites
- Node.js 22+
- npm 10+
- Docker & Docker Compose (for local Supabase, Redis, Centrifugo)

### Local Development
```bash
# Start infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run start

# Run lints
cd frontend && npm run lint
cd backend && npm run lint

# Run tests
cd frontend && npm test -- --watch=false
cd backend && npm test

# Build
cd frontend && npm run build
cd backend && npm run build
```

### Environment Variables
See `backend/src/config/validation.schema.ts` for the full required variable list. Copy `.env.example` to `.env` and fill in all values before starting.

### Pre-Commit Checks (Frontend)
```bash
npm run check:control-flow    # No *ngIf/*ngFor legacy directives
npm run check:rtl-logical     # No physical CSS direction utilities
npm run check:template-bindings  # No ngClass/ngStyle
npm run lint
npm run build
npm test -- --watch=false
```

---

## 13. Accessibility Requirements (WCAG AA)

- All interactive elements have visible focus rings (ring-2 ring-primary ring-offset-2)
- Colour contrast ratio >= 4.5:1 for normal text, 3:1 for large text
- All images have descriptive `alt` text
- Icons used as buttons have `aria-label`
- Modals/sheets trap focus and restore on close
- Form inputs have associated `<label>` elements
- Live regions (`aria-live="polite"`) for dynamic content updates (new messages, toast)
- Keyboard navigation: tab order is logical, Escape closes modals
- RTL text direction via `dir` attribute on `<html>` (managed by `I18nService`)

