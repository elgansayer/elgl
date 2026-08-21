# Gift Picker Specification

## Purpose

Allow users to select and send virtual gifts to other users, using coins as currency.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│ [🔙]  Send a Gift         [💰 150] │ ← Header with coin balance
├─────────────────────────────────────┤
│ [Popular] [Romance] [Fun] [Luxury]  │ ← Category tabs
├─────────────────────────────────────┤
│                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ 🌹   │  │ 💍   │  │ 💕   │      │ ← Gift grid
│  │ Rose  │  │ Ring  │  │ Hearts│     │
│  │ 50 🪙 │  │ 200🪙│  │ 30 🪙│      │
│  └──────┘  └──────┘  └──────┘      │
│                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ 🎂   │  │ 🎈   │  │ 🎉   │      │
│  │ Cake  │  │Balloon│  │Party │     │
│  │ 80 🪙 │  │ 40 🪙│  │ 100🪙│      │
│  └──────┘  └──────┘  └──────┘      │
│                                     │
├─────────────────────────────────────┤
│         [Send Gift - 50 🪙]         │ ← Send button (shows selected)
└─────────────────────────────────────┘
```

### Dimensions

- **Width**: 320px (mobile), 360px (desktop)
- **Height**: 450px (max)
- **Gift item**: 96x96px
- **Grid**: 3 columns
- **Emoji size**: 40x40px
- **Coin icon**: 16x16px

### Colour Scheme

- **Background**: `bg-slate-800`
- **Border**: `border border-slate-700`
- **Category tab active**: `text-purple-400 border-b-2 border-purple-400`
- **Category tab inactive**: `text-slate-400`
- **Gift item background**: `bg-slate-700`, hover `bg-slate-600`
- **Selected gift**: `ring-2 ring-purple-400 bg-purple-900/20`
- **Coin balance**: `text-yellow-400`
- **Send button**: `bg-purple-600`, disabled `bg-slate-700`

### Gift Categories

1. **Popular**: 🌹 Rose, 💋 Kiss, 🧸 Teddy, 🎂 Cake
2. **Romance**: 💍 Ring, 💕 Hearts, 🌹 Rose, 🕊️ Dove
3. **Fun**: 🎉 Party, 🎈 Balloon, 🎊 Confetti, 🪅 Piñata
4. **Luxury**: 👑 Crown, 💎 Diamond, 🏆 Trophy, ✨ Sparkle

### Coin Costs

- Range: 10-500 coins per gift
- Displayed as: `[coin_icon] [amount]`

## States

### Default

- First category selected
- Grid of gifts displayed
- No gift selected
- Send button disabled

### Gift Selected

- Selected gift has purple ring
- Send button becomes active
- Shows selected gift cost
- Preview animation plays

### Insufficient Coins

- Gift item dimmed (opacity 40%)
- "Not enough coins" tooltip
- "Buy Coins" button in header

### Sending

- Send button shows spinner
- "Sending..." text
- Gift item pulses

### Sent

- Success animation (confetti)
- "Gift sent!" toast
- Coin balance updates

## Animations

### Gift Selection

```css
@keyframes giftSelect {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
/* Duration: 200ms */
```

### Send Animation

```css
@keyframes giftSend {
  0% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(0) rotate(20deg);
    opacity: 0;
  }
}
/* Duration: 500ms, then gift appears in chat */
```

### Insufficient Coins Shake

```css
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}
/* Duration: 300ms */
```

## Accessibility

- `role="dialog"` with `aria-label="Gift picker"`
- Each gift: `role="button"`, `aria-label="[Gift name], [cost] coins"`
- Category tabs: `role="tab"`, `aria-selected`
- Send button: `aria-label="Send [gift name] for [cost] coins"`
- Live region for coin balance updates

## Edge Cases

- **No coins**: Show "Buy Coins" CTA instead of gift grid
- **Gift already sent recently**: Show cooldown timer
- **Network error during purchase**: Show retry option
- **User blocked you**: Hide gift option entirely
- **Free tier restrictions**: Show upgrade prompt for premium gifts
