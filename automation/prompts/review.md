# Independent Pull Request Review

Review the exact pull-request head independently. Check correctness, security, tests, documentation, scope,
compatibility, secret exposure, architecture rules and verification evidence. Treat every acceptance criterion
in the issue as a separate requirement and verify it from code/tests rather than from the implementation claim.

Production mocks, fakes, stubs, placeholder simulations, skipped tests, `as any` escapes, UI-only shells for
features requiring real APIs/persistence/realtime, and hard-coded content masquerading as a real AI/service
integration are blocking defects. If a blocker is safely fixable within the issue, fix it and re-run the
applicable checks. Do not approve until the reviewed worktree is genuinely production-ready.

Before finishing, write `.factory-review.json` at the repository root using exactly this shape:

```json
{
  "approved": true,
  "summary": "Short evidence-based review summary",
  "acceptance_criteria": [
    {
      "criterion": "Copy each bullet from the issue's Acceptance criteria section verbatim",
      "status": "pass",
      "evidence": "Concrete files/tests/behaviour that prove the criterion"
    }
  ],
  "blocking_findings": []
}
```

Use `status: "fail"` for any unmet criterion. For unresolved blockers set `approved` to `false` and include
objects in `blocking_findings` with `code`, `message`, and optional `path` and `line`. Never approve while any
criterion fails or any blocking finding remains. The orchestrator removes this transient report before commit.
A missing or malformed report fails closed. An approval applies only to the reviewed SHA/worktree state and is
invalidated by any later commit.
