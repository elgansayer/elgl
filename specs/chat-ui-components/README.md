# Chat UI Components - Pixel-Perfect Specifications

## Overview

This directory contains detailed specifications for all chat UI components used in the HelloTalk application. Each specification includes:

- Component purpose and usage
- Visual design (dimensions, colours, typography, spacing)
- States (default, hover, active, disabled, error, loading)
- Accessibility requirements
- Responsive behavior
- Animation specifications
- Edge cases and error states

## Component List

| #   | Component           | File                     | Priority |
| --- | ------------------- | ------------------------ | -------- |
| 1   | Message Bubbles     | `message-bubbles.md`     | P0       |
| 2   | Input Bar           | `input-bar.md`           | P0       |
| 3   | Emoji Picker        | `emoji-picker.md`        | P0       |
| 4   | Attachment Menu     | `attachment-menu.md`     | P1       |
| 5   | Voice Note Recorder | `voice-note-recorder.md` | P0       |
| 6   | Doodle Pad          | `doodle-pad.md`          | P1       |
| 7   | Gift Picker         | `gift-picker.md`         | P1       |
| 8   | Favourites Tab      | `favourites-tab.md`      | P1       |
| 9   | Search Bar          | `search-bar.md`          | P0       |
| 10  | Typing Indicator    | `typing-indicator.md`    | P0       |
| 11  | Read Receipts       | `read-receipts.md`       | P0       |
| 12  | Context Menu        | `context-menu.md`        | P1       |

## Design Tokens (Shared Across All Components)

### Colour Palette

```css
/* Backgrounds */
--bg-chat: #1a1a2e; /* Main chat background */
--bg-bubble-self: #7c3aed; /* Purple-600 for own messages */
--bg-bubble-other: #1e293b; /* Slate-800 for other messages */
--bg-input: #0f172a; /* Slate-900 for input area */
--bg-surface: #1e293b; /* Card/surface backgrounds */

/* Text */
--text-primary: #f1f5f9; /* Slate-100 */
--text-secondary: #94a3b8; /* Slate-400 */
--text-muted: #64748b; /* Slate-500 */
--text-link: #a78bfa; /* Violet-400 */

/* Accents */
--accent-primary: #7c3aed; /* Purple-600 */
--accent-hover: #6d28d9; /* Purple-700 */
--accent-success: #22c55e; /* Green-500 */
--accent-warning: #eab308; /* Yellow-500 */
--accent-danger: #ef4444; /* Red-500 */

/* Borders */
--border-default: #334155; /* Slate-700 */
--border-focus: #7c3aed; /* Purple-600 */
--border-error: #ef4444; /* Red-500 */
```

### Typography

```css
--font-family: 'Inter', system-ui, -apple-system, sans-serif;
--font-size-xs: 0.75rem; /* 12px */
--font-size-sm: 0.875rem; /* 14px */
--font-size-base: 1rem; /* 16px */
--font-size-lg: 1.125rem; /* 18px */
--font-size-xl: 1.25rem; /* 20px */
```

### Spacing Scale

```css
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
```

### Border Radius

```css
--radius-sm: 0.375rem; /* 6px */
--radius-md: 0.5rem; /* 8px */
--radius-lg: 0.75rem; /* 12px */
--radius-xl: 1rem; /* 16px */
--radius-full: 9999px;
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.4);
```

### Transitions

```css
--transition-fast: 150ms ease;
--transition-normal: 200ms ease;
--transition-slow: 300ms ease;
```

## Accessibility Requirements (All Components)

- All interactive elements must have `aria-label` or `aria-labelledby`
- Focus indicators must use `ring-2 ring-purple-400` with `outline-none`
- Touch targets must be at least 44x44px
- Colour contrast ratios must meet WCAG AA standards (4.5:1 for text, 3:1 for large text)
- All icons must have `aria-hidden="true"` with text alternatives
- Keyboard navigation must follow logical tab order
- Screen reader announcements for dynamic content changes
