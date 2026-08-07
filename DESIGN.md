# HelloTalk Design System

## Brand Colours

| Token              | Hex       | Usage                      |
| ------------------ | --------- | -------------------------- |
| `bg-primary`       | `#121212` | App background             |
| `bg-surface`       | `#1E1E1E` | Card / elevated surface    |
| `bg-input`         | `#2A2A2A` | Input fields               |
| `accent`           | `#00C8A0` | Primary accent (neon teal) |
| `accent-dark`      | `#00A080` | Accent hover/active        |
| `accent-secondary` | `#00E6B4` | Secondary accent           |
| `text-primary`     | `#E4E4E4` | Primary text               |
| `text-secondary`   | `#A0A0A0` | Secondary / muted text     |
| `border`           | `#333333` | Default borders            |
| `error`            | `#EF4444` | Error / destructive        |
| `success`          | `#22C55E` | Success                    |

## Typography

- **Font family:** System UI sans-serif (Inter / SF Pro)
- **Base size:** 16px
- **Scale:** 12px (xs), 14px (sm), 16px (base), 18px (md), 20px (lg), 24px (xl), 30px (2xl), 36px (3xl)

## Border Radius

- **sm:** 4px (chips, badges)
- **md:** 8px (inputs, small cards)
- **lg:** 12px (cards)
- **xl:** 16px (modals, large cards)
- **full:** 9999px (pills, avatars)

## Spacing Scale

4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80

## Component Primitives

- **app-card:** Elevated container with surface background, rounded-xl, shadow
- **app-button-primary:** Full-width, accent bg, white text, rounded-lg
- **app-button-secondary:** Outlined, accent border, transparent bg
- **app-input:** Dark input bg (#2A2A2A), border #333, rounded-md
- **app-chip:** Small rounded pill with accent or surface bg
- **app-pill:** Horizontal scrollable filter chips
- **app-empty-state:** Centered placeholder with icon and description

## Guidelines

1. **Dark mode only** -- all designs MUST use #121212 background
2. **Neon accents** -- use accent colours (#00C8A0 / #00E6B4) for interactive elements
3. **Mobile-first** -- design for 390px width, then scale up
4. **Logical properties** -- use `ps`/`pe`/`ms`/`me`/`border-s`/`border-e` for RTL support
5. **Gradient buttons** -- primary CTAs use accent gradient backgrounds
6. **Flag indicators** -- language pairs show flag emoji badges
7. **No em dashes** -- use hyphens or colons instead
8. **Dual currency** -- prices show both UKP and USD (e.g., "8 UKP / $10 USD")
