# Factory issue policy and quality gate

The OpenHands factory is an implementation worker, not an epic planner. It should receive bounded issues that
can plausibly become one focused pull request.

## Issue classes

The factory creates and recognises these labels:

- `factory-ready`: bounded issue that is eligible for implementation.
- `factory-active`: issue already leased by the factory; it remains eligible while in progress.
- `factory-epic`: broad product/architecture objective that must be decomposed before implementation.
- `factory-planning`: research, audit or planning work that should produce smaller issues rather than one giant PR.
- `factory-skip`: intentionally excluded from autonomous implementation.
- `needs-human`: blocked on a decision or manual intervention.
- `factory-quality-blocked`: repeatedly failed the production-quality or independent-review gate.

`FACTORY_REQUIRE_READY_LABEL=true` is the safe default. An unlabeled open issue is not a factory task. Do not
turn this off merely to increase throughput.

A useful operator flow is:

```bash
gh issue edit 123 --add-label factory-epic
gh issue edit 456 --add-label factory-ready
```

For an epic, first create bounded child issues with explicit acceptance criteria. Apply `factory-ready` only to
those children. The factory must never infer that a broad audit is permission to rewrite the whole product.

## Definition of done

For a product feature, completion means the applicable vertical slice is real:

1. user-facing UI/interaction;
2. existing API boundary;
3. real service/domain logic;
4. persistence and/or realtime integration where required;
5. loading, error and empty states;
6. i18n, accessibility and RTL requirements;
7. unit/integration/E2E tests appropriate to the change;
8. no production mocks, fakes, stubs or knowingly simulated interactions.

A button that says a feature will exist later is not completion.

## Deterministic pre-PR gate

Before the implementation commit is pushed, the factory inspects added diff lines. The gate blocks obvious
production shortcuts including:

- new mock/fake/stub behaviour in production source;
- explicit `not implemented`/simulated production behaviour;
- new TypeScript `as any` escapes;
- newly skipped tests.

Test mocks and fixtures are allowed. If the gate finds a blocker, the factory gets one targeted repair
conversation. If the finding remains, the job fails and repeated failures quarantine it.

This deterministic gate is intentionally conservative. It is not the semantic reviewer.

## Structured independent review

The independent review must write `.factory-review.json` in the worktree. The orchestrator parses it and removes
it before commit. A missing or malformed report fails closed.

The report must:

- state whether the change is approved;
- copy and assess every bullet under the issue's `## Acceptance criteria` heading;
- provide concrete evidence for each criterion;
- list unresolved blocking findings;
- never approve while a criterion fails or a blocker remains.

The reviewer is specifically instructed to reject UI-only shells, hard-coded service/AI simulations, skipped
tests and other changes that make an issue appear complete without a real vertical slice.

The reviewed head SHA remains authoritative: later commits invalidate the approval and the branch returns through
review before merge.

## Broad issues

Examples that should normally be `factory-epic` or `factory-planning` rather than `factory-ready`:

- audit every frontend/API contract;
- redesign the whole navigation architecture;
- consolidate the entire backlog;
- build a complete personal learning graph;
- audit every incomplete feature in the product.

Those issues are useful as parent objectives. Their output should be evidence and smaller factory-ready issues,
not one enormous autonomous PR.
