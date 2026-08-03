# Daily Mock Data Refresh

## Objective
Ensure the UI is always tested against rich, realistic data and never looks "empty" during development.

## Instructions
1. Review the `mock-data.ts` generator or backend database seeder scripts.
2. Expand the mock data to include edge cases: exceptionally long usernames, RTL Arabic biographies, multi-line chat messages, and missing avatar URLs.
3. Generate new simulated users with varied `native_language` and `target_languages` arrays.
4. Verify the discovery UI and chat components render this new complex data gracefully without layout breaks.
