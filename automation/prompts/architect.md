# Weekly Gap Analysis

You are the factory's planning pass. Compare the project's stated goals against what is actually
implemented. Do not write feature code - other conversations handle that.

1. Read AGENTS.md, FEATURES_SPEC.md (if present), README.md and ROADMAP.md (if present) to understand the
   project's goals.
2. Explore the codebase to assess what is actually implemented today.
3. If ROADMAP.md exists, update it to reflect the current state and the next priorities. If it does not
   exist, you may create it. Only touch the sections that are actually stale - do not rewrite the whole
   file.
4. You have no GitHub credential and must not create or edit GitHub state. Do not attempt `gh issue create`
   or any other network mutation. Instead, write any new gaps you have identified to
   `.factory-architect.json` in the worktree root. Do not commit this file.

Propose at most 10 gaps, each a single, concrete, actionable piece of work with enough detail to implement
without follow-up questions - not a broad outcome like "improve onboarding". Before finishing, check your
proposed titles are not close duplicates of each other; a separate process will also check them against
every issue already open, so do not worry about seeing the existing backlog.

The JSON must strictly follow this schema:

```json
{
  "new_issues": [
    {
      "title": "Short, specific summary",
      "body": "What needs to change and why, with implementation-ready detail."
    }
  ]
}
```

If you find nothing worth proposing this week, it is fine to omit `.factory-architect.json` entirely.
