# Doodle Pad Specification

## Purpose

Allow users to draw freehand sketches, add text, and use basic shapes to create visual messages.

## Visual Design

### Layout

```
┌─────────────────────────────────────┐
│ [🔙]  Doodle Pad          [✓] [🗑️] │ ← Header
├─────────────────────────────────────┤
│                                     │
│          ┌─────────────┐            │
│          │             │            │ ← Drawing canvas
│          │             │            │
│          │             │            │
│          └─────────────┘            │
│                                     │
├─────────────────────────────────────┤
│ [🖊️] [✏️] [🖍️] [📝] [⬜] [🔴] [🟡] │ ← Toolbar
│ [2px] [4px] [8px] [16px]           │ ← Stroke width
└─────────────────────────────────────┘
```

### Dimensions

- **Canvas**: 100% width, 300px height (mobile), 400px (desktop)
- **Header**: 48px height
- **Toolbar**: 56px height
- **Colour swatches**: 28x28px
- **Stroke width buttons**: 36x36px

### Colour Scheme

- **Canvas background**: `bg-white` (`#ffffff`)
- **Header background**: `bg-slate-800`
- **Toolbar background**: `bg-slate-900`
- **Active tool**: `ring-2 ring-purple-400`
- **Colour swatches**: Various colours with `rounded-full`

### Tools

1. **Pen** (🖊️): Default, smooth stroke
2. **Pencil** (✏️): Textured stroke
3. **Marker** (🖍️): Semi-transparent, thick stroke
4. **Text** (📝): Tap to add text, drag to position
5. **Eraser** (⬜): Erases by stroke or area

### Colours

- Black, White, Red, Orange, Yellow, Green, Blue, Purple, Pink, Brown, Gray

### Stroke Widths

- 2px, 4px, 8px, 16px

## States

### Default

- Empty white canvas
- Pen tool selected
- Black colour, 4px stroke

### Drawing

- Stroke appears in real-time
- Smooth bezier curves
- No lag (60fps rendering)

### Text Mode

- Tap on canvas to place text cursor
- Keyboard appears for text input
- Font: 24px, bold, selected colour
- Drag to reposition after placement

### Eraser Mode

- Cursor changes to eraser icon
- Stroke removes underlying drawings
- Can toggle between stroke erase and area erase

### Undo/Redo

- Undo button active when there are actions
- Redo button active after undo
- Maximum 50 undo steps

## Animations

### Stroke Render

```css
/* Real-time rendering, no animation delay */
```

### Tool Switch

```css
transition: all 150ms ease;
/* Active tool scales up slightly */
```

### Clear Canvas

```css
@keyframes canvasFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
/* Duration: 200ms, then canvas clears and fades back in */
```

## Accessibility

- `role="application"` with `aria-label="Doodle pad"`
- Canvas: `role="img"`, `aria-label="Drawing canvas"`
- Each tool button: `aria-label="[Tool name] tool"`
- Colour buttons: `aria-label="[Colour name] colour"`
- Stroke buttons: `aria-label="[Width] pixels stroke width"`
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), Delete (clear)

## Edge Cases

- **Very long drawing session**: Auto-save every 30 seconds
- **Canvas too small**: Provide pinch-to-zoom
- **Accidental touch**: Undo button readily available
- **Send without drawing**: Disable send button
- **Image import**: Allow importing photo as background layer
