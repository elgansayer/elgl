Priority: Medium Impact

Description:
Improve the perceived performance and user delight by replacing generic text-based loading ("Searching...") and empty states ("No matches found") with polished, animated skeleton loaders and contextual illustrations. This prevents visual jarring during network requests and encourages users to adjust filters when they hit a dead end, keeping them engaged in the app ecosystem.

Technical Implementation:
- Create a new reusable Angular component `SkeletonLoaderComponent` (e.g., `frontend/src/app/components/primitives/skeleton-loader/`).
- Implement SCSS `@keyframes shimmer` for a subtle, moving gradient animation on the skeleton blocks.
- In `frontend/src/app/components/discovery/discovery.component.html`, replace the `@if (isLoading())` block displaying plain text with 3-4 instances of the new skeleton loader mimicking the shape of the `ProfileDiscoveryCard`.
- Replace the empty state text with an SVG illustration (e.g., an empty radar or magnifying glass) and a more prominent button to clear or reset filters.