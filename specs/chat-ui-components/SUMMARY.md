# Chat UI Components - Specification Summary

## Component Overview

| Component           | File                     | Status      | Key Features                                                                   |
| ------------------- | ------------------------ | ----------- | ------------------------------------------------------------------------------ |
| Message Bubbles     | `message-bubbles.md`     | ✅ Complete | Own/other styling, corrections, voice, gifts, states (loading, error, deleted) |
| Input Bar           | `input-bar.md`           | ✅ Complete | Auto-expand, character limit, send animation, offline handling                 |
| Emoji Picker        | `emoji-picker.md`        | ✅ Complete | Categories, search, recently used, skin tones, keyboard navigation             |
| Attachment Menu     | `attachment-menu.md`     | ✅ Complete | Camera, photos, documents, location, permissions handling                      |
| Voice Note Recorder | `voice-note-recorder.md` | ✅ Complete | Waveform, 60s limit, slide to cancel, preview, error states                    |
| Doodle Pad          | `doodle-pad.md`          | ✅ Complete | Drawing tools, colours, stroke widths, text, undo/redo                          |
| Gift Picker         | `gift-picker.md`         | ✅ Complete | Categories, coin costs, insufficient coins, send animation                     |
| Favourites Tab      | `favourites-tab.md`      | ✅ Complete | Filter by type, play audio, delete, empty state                                |
| Search Bar          | `search-bar.md`          | ✅ Complete | Real-time search, filters, highlights, pagination                              |
| Typing Indicator    | `typing-indicator.md`    | ✅ Complete | Animated dots, multi-user, heartbeat mechanism                                 |
| Read Receipts       | `read-receipts.md`       | ✅ Complete | Sent/delivered/read states, group chat aggregation                             |
| Context Menu        | `context-menu.md`        | ✅ Complete | Actions, positioning, keyboard nav, edge cases                                 |

## Design System Consistency

All components follow the same design tokens defined in `README.md`:

- **Colour palette**: Dark theme with purple accents
- **Typography**: Inter font family, consistent sizing scale
- **Spacing**: 4px base unit, consistent padding/margins
- **Border radius**: Rounded corners with specific exceptions
- **Shadows**: Layered depth for surfaces
- **Transitions**: Consistent timing and easing

## Accessibility Compliance

All components meet WCAG AA standards:

- ✅ Proper ARIA roles and labels
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ Colour contrast (4.5:1 minimum)
- ✅ Screen reader announcements
- ✅ Touch targets (44x44px minimum)

## Responsive Behavior

| Component       | Mobile (<640px)         | Tablet (640-1024px) | Desktop (>1024px)   |
| --------------- | ----------------------- | ------------------- | ------------------- |
| Message Bubbles | 70% max width           | 70% max width       | 65% max width       |
| Input Bar       | Full width              | Centered, max 768px | Centered, max 768px |
| Emoji Picker    | Full width, 50vh        | 360px fixed         | 360px fixed         |
| Context Menu    | Full width bottom sheet | 200px dropdown      | 200px dropdown      |

## Animation Guidelines

- **Entry animations**: 150-200ms, ease-out
- **Exit animations**: 100-150ms, ease-in
- **Hover effects**: 100-150ms
- **Loading states**: Continuous animation (spinner, pulse)
- **Status changes**: 200-300ms smooth transitions
- **No animation on reduced motion preference**: Respect `prefers-reduced-motion`

## Implementation Priority

| Priority | Components                                                                                                 | Timeline |
| -------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| P0       | Message Bubbles, Input Bar, Emoji Picker, Voice Note Recorder, Search Bar, Typing Indicator, Read Receipts | Sprint 1 |
| P1       | Attachment Menu, Doodle Pad, Gift Picker, Favourites Tab, Context Menu                                     | Sprint 2 |

## Testing Requirements

Each component should have:

- Unit tests for all states
- Integration tests for user interactions
- Accessibility tests (axe-core)
- Visual regression tests (Storybook)
- Performance tests (60fps rendering)
- Mobile touch interaction tests
