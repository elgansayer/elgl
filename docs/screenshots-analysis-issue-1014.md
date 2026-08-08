# Moments Feed Screenshot Analysis (Issue #1014)

## Overview

This document analyses the 33 unique HelloTalk Moments feed screenshots located in `original-hello-talk-screenshots/` and compares them with the current frontend implementation at `frontend/src/app/components/moments-feed/`.

## Screenshot Inventory

33 unique screenshots (49 total including duplicates) captured on 2026-07-22, all at 5120x2048 resolution (wide-format stitched captures containing multiple phone screen panels).

## Key Design Observations from Original HelloTalk

### 1. Colour Palette

| Element | Original (from screenshots) | Current Implementation | Status |
|---------|------------------------------|------------------------|--------|
| Background | #141414 to #1E1E1E (RGB 20-30) | #121212 (`bg-surface-500`) | ✅ Match |
| Card surfaces | #212121 to #232323 (RGB 33-35) | #1E1E1E (`bg-surface-400`) | ✅ Close |
| Header tint | Deep purple (#1E1450 / RGB 30,20,80) | Dark grey (#2A2A2A) | ⚠️ Needs purple tint |
| Neon accent | Purple #C084FC with glow | ✅ Present (`neon-accent` class) | ✅ Match |
| Gradient buttons | Orange→Yellow (#FB923C→#FACC15) | ✅ Present | ✅ Match |
| Secondary UI | Teal/cyan accents (#64D8E6) | Limited use | ⚠️ Could add |

### 2. Layout Patterns

- **Header**: Sticky top with profile icon (left), title (centre), notifications + compose icons (right)
- **Filter tabs**: Horizontal scrollable pills below the header
- **Feed items**: Avatar + username + timestamp + content with language badge
- **Action bar**: Like, comment count, TTS, correct, quote, translate buttons
- **Comments section**: Collapsible with reply threading and @mention support

### 3. Current Implementation vs Screenshots

The current `moments-feed.component.html` and `.scss` already implement the core HelloTalk Moments design:

✅ Dark theme (#121212 backgrounds)
✅ Neon purple accent class
✅ Horizontal scrollable pills filter
✅ Language flag indicators  
✅ Gradient orange→yellow post button
✅ RTL-safe logical properties
✅ Angular @if/@for/@switch control flow
✅ Tokenised text for word-level interaction
✅ Translation caching and toggle
✅ @mention autocomplete in comments
✅ Voice note recording support

### 4. Recommended Improvements

Based on screenshot analysis, the following improvements are recommended:

1. Add purple-tinted header gradient to match original app's immersive dark purple feel
2. Fix hardcoded accessibility labels (aria-label, alt) to use translation pipes  
3. Enhance neon glow effects on interactive elements
4. Add subtle card hover transitions for better UX
5. Improve the compose button gradient animation

## Verification

Both backend and frontend build and test suites pass after changes.