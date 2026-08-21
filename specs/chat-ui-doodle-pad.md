<!-- This file is a Markdown specification document. It should not be linted by npm. -->

# Doodle Pad Component Specification

## Overview

A canvas-based drawing component for creating and sending doodle sketches in chat.

## Props / Inputs

- `width`: number (default 300) - Canvas width in pixels
- `height`: number (default 200) - Canvas height in pixels
- `disabled`: boolean (default false)

## Outputs / Events

- `doodleComplete`: emits `{ imageUrl: string, imageBlob: Blob }`
- `doodleCancelled`: emits void

## States

1. **Empty**: Blank canvas with "Draw something..." placeholder text
2. **Drawing**: Active stroke being drawn
3. **With Content**: Canvas has drawn content, undo/redo available
4. **Saving**: Loading overlay while uploading to R2

## Visual Design

- **Canvas**: `bg-white rounded-xl`, `border border-gray-600`
- **Toolbar**: Below canvas, `flex gap-2 p-2 bg-gray-800 rounded-b-xl`
- **Colour picker**: 8 preset colours (black, red, blue, green, yellow, purple, orange, white) as `w-6 h-6 rounded-full` circles
- **Brush size**: 3 sizes (small/2px, medium/4px, large/8px) as circles with varying diameters
- **Undo/Redo**: Arrow icons, `text-gray-400 hover:text-white`, disabled when no history
- **Clear**: Trash icon, `text-red-400 hover:text-red-300`
- **Send**: Checkmark icon, `text-green-400 hover:text-green-300`, disabled when canvas empty
- **Cancel**: X icon, `text-gray-400 hover:text-white`

## Behavior

- Uses HTML5 Canvas 2D API with `pointer events` for drawing
- Stores stroke history as array of `{ points: Point[], colour: string, size: number }` for undo/redo
- Maximum 50 undo steps
- On send: converts canvas to PNG blob via `canvas.toBlob()`, uploads to R2, emits URL
- On clear: confirmation dialog "Clear your doodle?"
- On cancel: confirmation if canvas has content "Discard your doodle?"

## Accessibility

- `role="application"` on canvas container
- `aria-label="Doodle pad canvas"`
- Keyboard: Ctrl+Z undo, Ctrl+Shift+Z redo, Delete clear
- Focus management: Auto-focus canvas on open

## Edge Cases

- Very large canvas (> 1000px): Scale down for performance, maintain aspect ratio
- Empty canvas send attempt: Button disabled, show "Draw something first" tooltip
- Upload failure: Show error toast, keep canvas state for retry
- Browser doesn't support Canvas: Show "Doodle not supported" fallback message
