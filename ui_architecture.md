# HelloTalk Clone - Comprehensive UI Architecture & Interaction Spec

This document provides a massive deep dive into every screen, component, and interaction within the application. It serves as the ultimate blueprint for the entire interface.

## 1. UI Philosophy & Guidelines
- **Aesthetic**: Pixel-perfect, mobile-first design.
- **Theme**: Strict dark mode (`#121212` backgrounds) featuring vibrant neon accents.
- **Layouts**: Horizontal scrollable pills, dense flag indicators, sticky headers.
- **RTL & Globalisation**: Zero physical directional CSS. We strictly use Tailwind logical properties (`ps-`, `pe-`, `border-s`, etc.) to support seamless mirroring for Arabic, Hebrew, and Persian. All text utilizes `TranslatePipe`.
- **Reactivity**: All components use Angular Signals (`signal`, `computed`, `input()`, `output()`) and stand-alone component architecture.

---

## 2. Core Screens (Routing)

### 2.1. Home & Onboarding
- **`/home` (HomeComponent)**: The landing dashboard summarizing active streaks, upcoming lessons, and recent notifications.
- **`/onboarding` (OnboardingWizardComponent)**: Multi-step setup for native language, target language(s), and proficiency level assessment.
- **`/proficiency` (ProficiencyAssessmentComponent)**: Diagnostic quiz UI to benchmark the user's initial skill level.

### 2.2. Social & Discovery
- **`/discovery` (DiscoveryComponent)**: The main matchmaking engine. Includes `GlobalSearchComponent`, filter drawers (age, language, serious learners), and renders `ProfileDiscoveryCard` components.
- **`/moments` (MomentsFeedComponent)**: The Instagram-style global timeline. Infinite scrolling list of multi-modal posts (text, images, 60s voice notes).
- **`/groups` & `/communities`**: Directories for joining language exchange groups based on shared interests.
- **`/events` & `/language-parties`**: Calendars and feeds for upcoming scheduled LiveKit broadcasts and language events.

### 2.3. Communication (Chat & Calls)
- **`/chat` (ChatListComponent)**: The inbox. Displays recent conversations, unread badges, and typing indicators.
- **`/chat/:id` (ChatRoomComponent)**: The core 1-on-1 and group messaging interface. Includes `MessageReactionBar`, `ChatSystemBubble`, and `StickerPicker`.
- **`/audio-rooms` (AudioRoomComponent)**: The LiveKit audio room lobby. Displays active 24/7 drop-in voice rooms categorized by language pair.
- **`/video-call` & `/active-call`**: Dedicated full-screen interfaces for WebRTC VoIP and video sessions. Includes `IncomingCallModal` and `VoipActiveCall`.

### 2.4. Learning & Immersion
- **`/vocabulary` (VocabularyDashboardComponent)**: SRS flashcard manager. Displays words color-coded by mastery (Blue, Yellow, White).
- **`/lessons` (LessonsComponent)**: Structured learning modules and resource library.
- **`/study-buddy` (StudyBuddyComponent)**: Algorithmic matchmaking interface to request and pair with serious learners.

### 2.5. Profiles & Monetization
- **`/profile` & `/profile/:userId`**: The user identity screen. Displays bio, native/target flags, correction ratio, and pinned moments. VIPs can view the `VisitorLogsComponent`.
- **`/vip` & `/subscription`**: Monetization surfaces detailing VIP tiers (8 UKP / 10 USD). Includes the `SubscriptionPlans` and `CoinsSuccess` pages.
- **`/shop` & `/cart`**: The virtual economy store for purchasing digital gifts and stickers.

### 2.6. Settings & Admin
- **`/settings` (SettingsComponent)**: Hub for account preferences, notification toggles, language settings, and privacy controls.
- **`/admin` (AdminPortalComponent)**: Secure dashboard for moderation, user management, and viewing reported content.

---

## 3. Component Library

### 3.1. Primitives (Foundational UI)
Located in `frontend/src/app/components/primitives/`:
- **`Card`**: Standard surface container with elevated shadows and `#1e1e1e` background.
- **`ButtonPrimary` / `ButtonSecondary` / `GradientButton`**: Touch-optimized buttons with tap animations and disabled states.
- **`Input` / `Textarea`**: Form controls with floating labels and error state borders.
- **`Chip` / `Pill` / `ScrollablePills`**: Compact indicators for interests, language levels, and filter toggles.
- **`LanguagePicker` & `FluencyIndicator`**: Flag-based icons paired with a visual bar (1 to 5) indicating language mastery.
- **`AudioEqualizer`**: A canvas-based visualizer for playing back voice notes.
- **`Toast` / `EmptyState`**: Non-blocking alerts and placeholder graphics for empty lists.

### 3.2. Feature Components (Complex Widgets)
- **`TokenisedTextComponent` (LingQ Engine)**: The heart of the app's reading experience. Parses raw text via `Intl.Segmenter` into clickable spans. Maps tokens to the user's SRS vocabulary state, dynamically applying background colors (Blue, Yellow, White).
- **`DoodlePad`**: An HTML5 canvas overlaid on the chat, allowing users to draw shapes, pick colors, and send the resulting data URL.
- **`VisualDiff` / `CorrectionModal`**: Displays an inline comparison between a user's original text (red strikethrough) and a native speaker's correction (green text).
- **`AudioSyncReader`**: Binds an `<audio>` element's `timeupdate` event to a `TokenisedTextComponent` to highlight words precisely as they are spoken.
- **`GroupParticipantDrawer` / `HostDashboard`**: Slide-out panels for LiveKit rooms allowing hosts to approve "Raise Hand" requests and mute participants.
- **`GiftAnimationOverlay` / `CelebrationOverlay`**: Full-screen, z-index-heavy Lottie animations triggered by Centrifugo broadcast events when virtual gifts are sent.

---

## 4. Interaction Catalog

### 4.1. The "Click-to-Translate" & Token Flow
1. User taps a word in a chat bubble or moment.
2. `TokenisedTextComponent` intercepts the click and emits the token.
3. A `WordDefinitionModal` (bottom sheet on mobile) slides up, displaying the DeepL/Azure translation, dictionary definition, and a TTS audio play button.
4. User taps "Save to Flashcards", dispatching an API call to Supabase and updating the token's UI state to "Yellow" (Learning).

### 4.2. Chat Messaging Interactions
- **Swipe-to-Reply**: Swiping a message bubble right populates the input area with a quoted reply context.
- **Long-Press Menu**: Holding a message opens `LongPressContextMenu` with options: Translate, Transliterate, Copy, Report, or Correct (Visual Diff).
- **Hold-to-Record**: Pressing and holding the microphone icon starts the `AudioRecorder`. Releasing stops the recording, uploads the blob to Cloudflare R2, and sends the URL payload via Centrifugo.

### 4.3. LiveKit Audio Stage Protocol
1. User joins an active room (Listener mode, `canPublish: false`).
2. User taps "Raise Hand" (`/audio-rooms/raise-hand`).
3. Host sees the request in the `HostDashboard` and clicks "Approve".
4. The backend issues a new JWT with `canPublish: true`.
5. The user's client automatically re-connects and enables their microphone.
6. The `LiveChatOverlay` runs concurrently, allowing listeners to text chat while speakers talk.

### 4.4. Community Correction Flow
1. User A posts a Moment in their target language.
2. User B (native speaker) taps "Correct" on the post.
3. The `CorrectionModal` opens, presenting the original text in an editable `Textarea`.
4. User B edits the text and adds explanatory notes.
5. The system generates a structured JSON payload (`{ original, fixed, explanation }`).
6. The post updates to render the `VisualDiff` component inline for all viewers.

### 4.5. VIP & Privacy Triggers
- When visiting a profile, an API call is fired to log the visit.
- If the visitor has "Incognito Mode" enabled (VIP feature), the API bypasses the logging.
- Free users viewing their `VisitorLogsComponent` see blurred avatars for recent visitors. Tapping a blurred avatar triggers the `SubscriptionPlans` paywall modal.

## 5. Performance, State & Bundle Optimization

To maintain a fast, responsive mobile-first experience, the Angular architecture must strictly adhere to the following optimization strategies:

### 5.1. Lazy Loading & Deferred Views
- **Component-Level Deferral**: Use Angular's `@defer` control flow block to lazily load heavy, non-critical components that are below the fold or not immediately visible. This includes:
  - `GiftAnimationOverlay` / `CelebrationOverlay` (which rely on the heavy `lottie-web` package).
  - Data visualizations like `CoinEconomyDashboardComponent` charts.
  - Complex UI elements like `DoodlePad` until the user interacts with the feature.
- **Dynamic Imports for Third-Party Libraries**: Avoid statically importing large third-party libraries (e.g., `chart.js`, `livekit-client`, `dompurify`) at the top of a file. Use dynamic `import()` within the component or service only when the library's functionality is explicitly requested by the user.
- **Route-Level Lazy Loading**: Continue utilizing standalone components and the `loadComponent` / `loadChildren` syntax in the router to ensure each route is chunked independently, preventing the initial bundle from bloating.

### 5.2. State Management
- **Optimistic UI Updates**: For instance, when a user sends a message or updates a setting, the local signal state should update immediately. If the Supabase API or Centrifugo broadcast fails, the state can be cleanly rolled back.

### 5.3. Bundle Size Reduction
- **Image Optimization**: Replace standard `<img>` tags with the `NgOptimizedImage` directive (`ngSrc`). This enforces automated lazy loading, automatic generation of `srcset` for responsive images, and preconnect hints, dramatically reducing the LCP (Largest Contentful Paint).
- **Strict Tree-Shaking**: Regularly audit imports to ensure only required functions/modules are included (e.g., import specific RxJS operators rather than the entire library).
- **Bundle Analysis**: Utilize `source-map-explorer` or the Angular CLI's built-in bundle analyzer to regularly audit the output chunks. Any external dependency exceeding 50KB must be explicitly justified or lazy-loaded.
