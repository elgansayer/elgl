<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Attachment Menu Component Specification

## Overview

A bottom sheet / popover menu showing available attachment types when user taps the attachment button.

## Props / Inputs

- `isOpen`: boolean (required)
- `position`: 'bottom' | 'top' (default 'bottom')

## Outputs / Events

- `optionSelected`: emits `{ type: AttachmentType }`
- `menuClosed`: emits void

## AttachmentType

```typescript
type AttachmentType = 'camera' | 'gallery' | 'document' | 'doodle' | 'voice' | 'gift' | 'location';
```

## States

1. **Closed**: Not rendered
2. **Open**: Menu visible with slide-up animation
3. **Selecting**: Option tapped, brief highlight before action

## Visual Design

- **Overlay**: `fixed inset-0 bg-black/50 z-50` (tap to close)
- **Menu panel**: `bg-gray-800 rounded-t-2xl p-4 pb-8`
  - Handle bar: `w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4`
  - Grid of options: `grid grid-cols-4 gap-4`
- **Option button**: `flex flex-col items-center gap-1`
  - Icon circle: `w-14 h-14 rounded-full flex items-center justify-center`
  - Label: `text-xs text-gray-400`
- **Option colours**:
  - Camera: `bg-red-500/20 text-red-400` 📷
  - Gallery: `bg-green-500/20 text-green-400` 🖼️
  - Document: `bg-blue-500/20 text-blue-400` 📄
  - Doodle: `bg-purple-500/20 text-purple-400` ✏️
  - Voice: `bg-yellow-500/20 text-yellow-400` 🎤
  - Gift: `bg-pink-500/20 text-pink-400` 🎁
  - Location: `bg-cyan-500/20 text-cyan-400` 📍

## Behavior

- Opens with slide-up animation (300ms ease-out)
- Closes on overlay tap, Escape key, or swipe down
- Each option triggers specific action:
  - Camera: Opens native camera (mobile) or file picker (desktop)
  - Gallery: Opens file picker for images
  - Document: Opens file picker for PDFs/docs
  - Doodle: Opens DoodlePad component
  - Voice: Opens VoiceNoteRecorder component
  - Gift: Opens GiftPicker component
  - Location: Requests geolocation, sends coordinates

## Accessibility

- `role="dialog"` on menu panel
- `aria-label="Attachment options"`
- Focus trap while open
- Keyboard: Arrow keys to navigate, Enter to select, Escape to close
- `aria-describedby` for each option

## Edge Cases

- Camera not available (desktop): Show "Camera not available" toast, fallback to gallery
- Location permission denied: Show "Enable location in browser settings"
- File too large (> 25MB): Show error toast with size limit
- Unsupported file type: Show "File type not supported" toast
- Multiple files selected: Only process first file, show "Only one file at a time" toast
