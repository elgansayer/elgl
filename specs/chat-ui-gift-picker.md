<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Gift Picker Component Specification

## Overview

A modal for selecting and sending virtual gifts to other users in chat.

## Props / Inputs

- `isOpen`: boolean (required)
- `recipientName`: string (required)
- `userCoins`: number (required) - Current user's coin balance

## Outputs / Events

- `giftSent`: emits `{ giftId: string, coinCost: number }`
- `pickerClosed`: emits void

## GiftItem Interface

```typescript
interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  coinCost: number;
  category: string;
  animationUrl?: string;
}
```

## States

1. **Closed**: Not rendered
2. **Open**: Gift grid visible with categories
3. **Insufficient Coins**: Selected gift costs more than user balance, show "Buy more coins" option
4. **Sending**: Loading spinner on selected gift
5. **Sent**: Success animation with confirmation

## Visual Design

- **Overlay**: `fixed inset-0 bg-black/60 z-50`
- **Modal**: `bg-gray-800 rounded-2xl max-w-sm w-full mx-4 p-4`
  - Header: "Send a gift to {name}" with close button
  - Coin balance: `flex items-center gap-1 text-sm text-yellow-400` with coin icon
- **Category tabs**: `flex gap-2 mb-3 overflow-x-auto`
  - Each tab: `px-3 py-1.5 rounded-full text-xs font-medium`
  - Active: `bg-pink-600 text-white`
  - Inactive: `bg-gray-700 text-gray-300`
- **Gift grid**: `grid grid-cols-3 gap-3`
  - Each gift: `bg-gray-700 rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-gray-600 transition-colours`
  - Emoji: `text-3xl`
  - Name: `text-xs text-gray-300`
  - Cost: `text-xs text-yellow-400` with coin icon
  - Selected state: `ring-2 ring-pink-500`
- **Send button**: `w-full mt-3 py-2.5 rounded-xl font-bold text-sm`
  - Sufficient coins: `bg-pink-600 hover:bg-pink-500 text-white`
  - Insufficient coins: `bg-gray-600 text-gray-400 cursor-not-allowed`

## Categories

Popular, Romance, Fun, Celebration, Support, Premium

## Behavior

- Fetches available gifts from `GET /gifts` on open
- Click gift: Selects it, shows preview animation
- Click "Send": Deducts coins, sends gift via Centrifugo, shows success animation
- Insufficient coins: Show "Buy coins" button that opens Stripe checkout
- Success: Brief animation (confetti or gift box opening), then close after 2 seconds

## Accessibility

- `role="dialog"` on modal
- `aria-label="Send a gift to {recipientName}"`
- `role="tablist"` on categories
- Focus trap while open
- Keyboard: Arrow keys to navigate grid, Enter to select/send, Escape to close

## Edge Cases

- Zero coins: Show "You need coins to send gifts" with "Get coins" CTA
- Gift send fails: Show error toast, refund coins optimistically
- Recipient offline: Gift delivered when they come online (stored in DB)
- Premium gifts locked: Show lock icon with "VIP only" tooltip
- Rapid clicking: Debounce send to prevent double-charge
