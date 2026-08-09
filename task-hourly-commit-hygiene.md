# Hourly Commit & Build Verification

## Objective
Enforce the constitution rules.

## Instructions
1. Run the complete `verification-gate` skill process.
2. This includes checking control-flow syntax (`check:control-flow`), RTL logical properties (`check:rtl-logical`), linting, and running a full production build (`npm run build`) on both frontend and backend.
3. If any step fails, fix it immediately.
4. Ensure current working directory changes are cleanly committed with descriptive, conventional commit messages.
