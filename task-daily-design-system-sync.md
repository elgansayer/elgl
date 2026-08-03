# Daily Component Design System Sync

## Objective
Enforce the clone-first design policy and eliminate ad-hoc, generic web dashboard styling.

## Instructions
1. Do a visual audit of the application against the original HelloTalk screenshots in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`.
2. Look for UI elements that use standard HTML form controls or Bootstrap-like styles instead of custom Angular primitives.
3. Refactor these elements into `app-pill`, `app-chip`, or `app-button-secondary`.
4. Ensure all backgrounds adhere strictly to the `#121212` dark mode mandate.
5. Verify that dual currency pricing (`8 UKP / $10 USD`) is enforced in all monetisation views.
