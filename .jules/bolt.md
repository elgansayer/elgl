## 2026-07-31 - Angular Template Function Calls Optimization
**Learning:** Calling methods directly within Angular templates inside `@for` loops (e.g. `[nativeLanguages]="getNativeLangs(partner)"`) evaluates the function on *every* change detection cycle. This leads to excessive CPU cycles, memory allocation, and GC pressure when dealing with large lists or complex objects.
**Action:** Always pre-calculate derived values in the component's TypeScript controller and store them directly in the signal or data model object, mapping it once when fetched, and read that property inside the template instead of executing logic.

## 2026-07-31 - Primitive components OnPush Strategy
**Learning:** Pure presentational components that only rely on their `input()` signals are still checked by default during change detection cycles.
**Action:** Make sure to add `changeDetection: ChangeDetectionStrategy.OnPush` to pure presentational primitive components (like `app-fluency-indicator` or `app-scrollable-pills`) to skip checking them unless their inputs change.
## 2026-07-31 - Angular Template Object/Map Lookups vs Function Calls
**Learning:** Directly accessing properties of signal objects or calling `.get()` on a Map via a `computed()` signal in a template is highly performant compared to wrapper functions like `getAllFeatures()` or `planHasFeature()`. Wrapping dictionary access in a function call (e.g. `loginHistoryFor(user.id)`) forces Angular to execute that function continuously, whereas reading from the signal `loginHistoryByUser()[user.id]` is cheap and allows Angular to skip unneeded re-evaluations.
**Action:** Replace template function calls returning arrays/booleans with direct `computed()` signal derivations using `Map` or `Set` objects for O(1) lookups inside `@for` loops.
