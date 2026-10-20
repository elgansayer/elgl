## 2024-11-20 - Optimize Angular change detection tracking in chat
**Learning:** Using track by object reference in `@for` loops causes unnecessary DOM re-renders in Angular when data gets updated because it uses object identity (reference equality). Tracking by a unique stable identifier (like `.id`) lets Angular reuse DOM elements properly.
**Action:** When creating or optimizing `@for` loops in Angular, always track by a stable unique property like `.id` instead of the whole object reference to optimize rendering performance.
