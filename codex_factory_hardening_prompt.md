# Codex Master Prompt: Harden the Autonomous OpenHands Factory

## Mission

You are working in the `elgansayer/elgl` repository.

Your task is to inspect, harden, test, and document the existing autonomous development factory so that it cannot treat superficial, mocked, incomplete, placeholder, or weakly reviewed implementations as completed engineering work.

This is not a request to build a second automation system.

This is not a request to replace the current OpenHands factory.

This is not a request to add another GitHub Actions issue resolver or another parallel PR reviewer.

The goal is to improve the existing canonical factory in place.

The canonical autonomous development system is under:

- `automation/openhands_factory`
- `automation/prompts`
- `config/systemd`
- `docs/factory`

GitHub Actions are CI and final merge gates only. They must not become a second autonomous issue resolver.

Read the repository's `AGENTS.md` before making changes and follow it exactly.

---

# Core Outcome

After this work is complete, the autonomous factory must behave like this:

```text
idea / audit / broad product request
        |
        v
factory-epic or factory-planning
        |
        v
decomposed into bounded implementation issues
        |
        v
factory-ready
        |
        v
implementation
        |
        v
security review
        |
        v
verification
        |
        v
deterministic quality gate
        |
        v
draft pull request
        |
        v
fresh independent review
        |
        v
structured acceptance-criteria report
        |
        v
CI
        |
        v
merge only when the reviewed SHA is still current
```

The factory must fail closed wherever there is uncertainty about whether the issue is actually complete.

---

# Non-Negotiable Engineering Rules

Follow the repository engineering constitution.

At minimum:

- Use British English.
- Do not use em dashes.
- Use strict TypeScript.
- Do not introduce `any`.
- Do not add production type assertions as shortcuts.
- Do not use `console.log` in production code.
- Angular must use modern standalone APIs.
- Use signals and modern resource APIs where appropriate.
- Do not introduce legacy `@Input` or `@Output`.
- Do not introduce NgModules.
- Do not introduce subscribe-driven state where signals/resources are appropriate.
- Do not introduce legacy Angular template control flow.
- Use `inject()`.
- Use i18n keys for user-facing text.
- Preserve RTL support using logical Tailwind utilities.
- Preserve WCAG AA.
- Frontend code must not access the database directly.
- API-first architecture must be preserved.
- Use `Intl.Segmenter` for language tokenisation where applicable.
- Verify packages, providers, modules, routes, DTOs, services, endpoints, and database objects actually exist before wiring code to them.
- Search for duplicate implementations before creating new files or services.
- Tests are mandatory.

Do not weaken these rules to make the task easier.

---

# Primary Problem to Solve

The autonomous factory currently needs stronger guarantees that an implementation is real.

A model can produce code that:

- renders a button but does not wire it to a working backend,
- creates a service whose implementation is mocked,
- creates placeholder UI,
- adds fake data in production,
- says a real implementation will be added later,
- creates a component without connecting it into an actual route or user flow,
- creates an API client for an endpoint that does not exist,
- creates an endpoint whose provider/module is not registered,
- creates a DTO that does not match actual consumers,
- creates a database interaction without a real migration,
- creates an apparent feature while leaving the real vertical slice incomplete,
- adds skipped tests,
- disables assertions,
- uses type escapes,
- leaves acceptance criteria unverified,
- passes an AI review merely because the reviewer conversation finished successfully.

The hardened factory must prevent these cases from being treated as complete work.

---

# Required Workstream 1: Safe-by-Default Issue Intake

Inspect the current issue collection and scheduling logic.

The factory must not automatically treat every open issue as an implementation task.

Implement or verify the following issue classifications:

```text
factory-ready
factory-epic
factory-planning
factory-quality-blocked
factory-quarantined
needs-human
```

## Behaviour

By default:

```text
FACTORY_REQUIRE_READY_LABEL=true
```

Only explicitly ready issues should enter normal autonomous implementation.

An issue labelled any of the following must not enter normal implementation even if it also has `factory-ready`:

```text
factory-epic
factory-planning
factory-quality-blocked
factory-quarantined
needs-human
```

If existing configuration allows `FACTORY_REQUIRE_READY_LABEL=false`, retain backward compatibility only if there is a compelling operational reason, but the shipped default and documented recommendation must be `true`.

Update:

- Python config defaults
- environment examples
- operator documentation
- tests

Do not silently change unrelated deployment behaviour.

---

# Required Workstream 2: Issue Type Semantics

Document and enforce the difference between planning issues and executable implementation issues.

## factory-epic

Use for broad outcomes such as:

- "Improve onboarding"
- "Audit mobile UX"
- "Make every conversation teach something"
- "Improve learning science across the app"
- "Consolidate product navigation"
- "Audit all fake features"

These should normally be decomposed before implementation.

## factory-planning

Use where the desired output is architecture investigation, product mapping, research, design proposal, dependency analysis, issue decomposition, backlog consolidation, or an implementation plan.

A planning issue may result in new implementation issues.

It should not pretend a giant product outcome was implemented in one autonomous pass.

## factory-ready

Use only when the task is bounded enough that a single worker can reasonably prove completion.

A ready issue should contain:

- a concrete user or engineering outcome,
- scope,
- acceptance criteria,
- known constraints,
- enough context to verify completion.

---

# Required Workstream 3: Vertical Slice Definition of Done

The factory must distinguish "code exists" from "feature works".

For a user-facing product feature, the worker must inspect and complete the real vertical slice where applicable:

```text
user interaction
    ->
Angular component
    ->
frontend state/service
    ->
API client
    ->
NestJS controller
    ->
DTO validation
    ->
NestJS service/domain logic
    ->
persistence / storage
    ->
realtime layer if required
    ->
response contract
    ->
frontend rendering/state update
    ->
tests
```

Not every task needs every layer.

However, if the issue requires a real user-facing feature, the worker must explicitly determine which layers are required and prove that they are connected.

A rendered UI control is not sufficient evidence of completion.

A service class is not sufficient evidence of completion.

A controller route is not sufficient evidence of completion.

A passing unit test around a mock is not sufficient evidence of completion.

---

# Required Workstream 4: Production Mock and Placeholder Gate

Add or improve a deterministic pre-PR quality gate that scans the actual diff.

The gate should focus on newly added or newly modified behaviour.

It should not attempt to ban every historical imperfection in the repository.

The gate must detect suspicious additions in production code.

Examples include:

```text
mock
mocked
fake
stub
placeholder
temporary implementation
simulate
simulated
TODO: implement
TODO implement
not implemented
not yet implemented
will be implemented
will be wired later
for now
sample data
dummy data
hard-coded temporary response
```

Be careful to reduce false positives.

Words such as "mock" are legitimate in unit tests, test fixtures, test helper files, explicit test data, and documentation describing test behaviour.

The gate should focus on production source paths.

Do not create a brittle regex that breaks normal words or comments without context.

Tests must cover both correctly blocked suspicious production additions and correctly allowed legitimate test mocks.

---

# Required Workstream 5: Type Escape Gate

The quality gate should reject newly introduced unsafe type escapes in production code.

Examples:

```ts
as any
<any>
: any
unknown as SomeType
```

Use judgement.

The repository constitution already rejects weak typing.

Do not mechanically block safe and justified type narrowing.

Do not rewrite unrelated historical assertions.

The gate should operate on newly added diff lines wherever practical.

Add tests proving:

- new `as any` in production is blocked,
- legitimate test-only casts do not cause irrelevant failures if the repo's test conventions allow them,
- normal safe narrowing is not blocked.

---

# Required Workstream 6: Skipped-Test Gate

Newly skipped tests must be treated as blockers.

Detect common forms across the repository's test stack.

Examples may include:

```ts
describe.skip(...)
it.skip(...)
test.skip(...)
xit(...)
xdescribe(...)
```

Also inspect the Python test stack and any E2E framework in use.

Examples may include:

```python
@pytest.mark.skip
pytest.skip(...)
```

Only block newly introduced skips.

Do not fail merely because the repository contains old skipped tests outside the changed diff.

Add explicit tests for frontend unit tests, Cypress or equivalent E2E tests, and Python tests if applicable.

---

# Required Workstream 7: Bounded Automatic Repair

When the deterministic quality gate finds blockers before PR creation:

1. format the findings clearly,
2. invoke a dedicated quality-repair prompt,
3. give the worker one bounded repair attempt,
4. rerun verification,
5. rerun the deterministic quality gate.

If blockers remain, fail closed.

Do not loop indefinitely.

Do not allow the model to simply delete tests or remove assertions to make the gate pass.

The quality repair prompt should instruct the agent to correct the underlying implementation.

---

# Required Workstream 8: Structured Independent Review

The reviewer must no longer be considered successful merely because the AI conversation completed without throwing an exception.

This is critical.

The reviewer must create a structured transient report, for example:

```text
.factory-review.json
```

The file must not be committed to the repository.

The orchestrator must parse the file and make the actual approval decision from its content.

If the report is missing, malformed, has an unsupported schema, fails to assess all acceptance criteria, contains failed criteria, or contains unresolved blocking findings, the review must fail closed.

---

# Required Review Report Schema

Use a simple explicit JSON contract.

For example:

```json
{
  "approved": true,
  "summary": "Implementation satisfies the issue and no blocking defects remain.",
  "acceptance_criteria": [
    {
      "criterion": "Users can save corrected phrases into vocabulary with confirmation.",
      "passed": true,
      "evidence": ["frontend/src/...", "backend/src/...", "test reference"]
    }
  ],
  "blocking_findings": []
}
```

A blocked example:

```json
{
  "approved": false,
  "summary": "The UI exists but the backend path is still simulated.",
  "acceptance_criteria": [
    {
      "criterion": "The feature persists through the real API.",
      "passed": false,
      "evidence": ["frontend/src/app/services/example.service.ts contains a hard-coded response."]
    }
  ],
  "blocking_findings": [
    {
      "severity": "blocking",
      "summary": "Production service returns mock data.",
      "evidence": ["frontend/src/app/services/example.service.ts"]
    }
  ]
}
```

You may choose a slightly different schema if it is better aligned with the existing code, but it must be deterministic and validated.

---

# Required Workstream 9: Acceptance Criteria Extraction

The independent review must evaluate the issue's acceptance criteria.

Support Markdown headings such as:

```markdown
## Acceptance criteria
```

and extract the bullet points below it.

If the issue contains explicit acceptance criteria, every criterion must appear in the reviewer report.

Normalise insignificant whitespace when comparing criteria.

Do not allow the reviewer to skip a difficult criterion.

Do not allow the reviewer to replace the issue's criteria with easier criteria of its own invention.

If criteria cannot be verified, that criterion should fail.

If the issue contains no explicit acceptance criteria, the reviewer should still assess the actual stated task and completion evidence, but do not invent fake issue text.

Add parser tests.

---

# Required Workstream 10: Evidence-Driven Review

The reviewer must inspect actual evidence.

The review prompt should require it to inspect:

- the issue,
- the complete diff,
- changed production files,
- related tests,
- existing implementation in neighbouring areas,
- API contracts where applicable,
- routes/providers/module registration,
- migrations where applicable,
- docs where applicable,
- verification output where available.

The reviewer should identify vertical-slice gaps.

Examples of blockers:

- button exists but click action does nothing meaningful,
- service returns hard-coded data,
- frontend calls nonexistent endpoint,
- controller exists but module does not register it,
- DTO and client disagree,
- migration is missing,
- realtime subscription is not wired,
- state resets incorrectly,
- feature only works with fake test fixtures,
- test asserts a stub rather than actual behaviour,
- empty state is placeholder copy,
- implementation says "coming soon",
- issue asks for persistence but implementation only stores in memory.

---

# Required Workstream 11: Reviewed SHA Integrity

The review approval must apply to a specific head SHA.

If the branch changes after the review, the prior review must no longer count.

Before merge:

- fetch the current PR head SHA,
- compare it with the SHA that passed independent review,
- fail or rerun review if they differ.

Do not merge code that the independent reviewer has not actually reviewed.

---

# Required Workstream 12: Reviewer Changes

If the independent reviewer is allowed to edit the worktree:

1. collect reviewer changes,
2. rerun deterministic quality checks,
3. rerun required verification,
4. commit/push only if valid,
5. refresh PR SHA,
6. ensure approval refers to the final SHA.

Do not allow a reviewer to make a change after approval without another integrity check.

---

# Required Workstream 13: Worker Prompt Hardening

Update the main task prompt so the implementation agent understands the definition of done before it begins.

The prompt should explicitly state that the following are not acceptable as finished work:

- mocked production services,
- fake API results,
- placeholder screens,
- TODO implementations,
- "coming soon" UI,
- controls that are not connected,
- hard-coded demo responses,
- simulated persistence,
- skipped tests,
- type escapes,
- duplicate implementations created without searching,
- routes/providers/packages that are assumed rather than verified.

Tell the worker:

> If a required dependency does not exist and cannot be safely created within the issue scope, do not fake the feature. Leave the task blocked and explain the missing dependency.

Tell the worker to inspect existing code first, search for duplicate implementations before creating new ones, preserve unrelated dirty changes, run required verification, and update tests and relevant documentation.

---

# Required Workstream 14: Dedicated Quality Repair Prompt

Create a focused prompt for deterministic quality failures.

The prompt should include:

- the issue title and body,
- exact deterministic findings,
- file and line evidence if available,
- instruction to repair the real underlying behaviour,
- instruction not to bypass the gate,
- instruction not to delete tests merely to make CI green,
- instruction not to replace real code with another mock,
- instruction to run verification after the repair.

Keep this separate from the giant base system prompt if the existing architecture already uses phase-specific prompts.

Do not make every worker carry irrelevant prompt text if the factory already supports bounded phase prompts.

---

# Required Workstream 15: Documentation

Update operator documentation.

Document how to classify:

```text
factory-epic
factory-planning
factory-ready
```

Document the recommended intake policy:

```bash
FACTORY_REQUIRE_READY_LABEL=true
```

Document what the deterministic gate checks:

- mock/fake/stub production behaviour,
- obvious placeholder implementations,
- unsafe type escapes,
- newly skipped tests.

Document what the independent review checks:

- structured review report,
- acceptance criteria coverage,
- blocking findings,
- reviewed SHA integrity.

Document the deployment caveat that existing servers may already contain:

```bash
FACTORY_REQUIRE_READY_LABEL=false
```

in an environment file.

An explicit old value may override the new safe default.

Include the relevant service restart command only if it is already part of the repository's deployment conventions.

Do not invent an operator path without verifying it first.

---

# Required Workstream 16: Tests

Add strong tests around all new behaviour.

At minimum cover:

## Config

- default ready-label requirement is true,
- explicit environment override works if intentionally supported.

## Issue intake

- `factory-ready` issue is collected,
- unlabelled issue is ignored when ready-label mode is enabled,
- epic is excluded,
- planning issue is excluded,
- blocked issue is excluded,
- quarantined issue is excluded.

## Quality gate

- production mock is blocked,
- production fake/stub is blocked,
- placeholder implementation is blocked where reliably detectable,
- `as any` addition is blocked,
- skipped test addition is blocked,
- Cypress/E2E skip is blocked,
- legitimate test mocks are allowed,
- unchanged historical problems are not incorrectly treated as new blockers.

## Review report parser

- valid approval parses,
- malformed JSON fails,
- missing file fails,
- `approved=false` fails,
- blocker list fails,
- failed criterion fails,
- omitted criterion fails,
- all criteria passed succeeds,
- whitespace normalisation behaves sensibly.

## Pipeline

Test a full successful path:

```text
DISCOVERED
IMPLEMENTING
SECURITY_REVIEW
VERIFYING
PR_DRAFT
REVIEWING
CI_PENDING
MERGE_QUEUED
MERGED
DONE
```

Verify the independent review status is published only after the structured report succeeds.

Also test failure paths.

---

# Required Workstream 17: Preserve Existing Architecture

Before changing anything, inspect:

```text
automation/openhands_factory
automation/prompts
.github/workflows
docs/factory
AGENTS.md
```

Search for:

- existing intake controls,
- existing labels,
- existing reviewer phases,
- existing quality checks,
- retired swarm infrastructure,
- duplicate prompt files,
- duplicate pipeline implementations.

Do not recreate existing functionality under a new filename.

If documentation describes a historical system that is no longer active, update or clearly mark it historical.

---

# Required Workstream 18: Security Review

Preserve the existing security review stage.

Do not replace security review with the new quality gate.

These are separate concerns.

Security review should remain responsible for security risks.

The deterministic gate should cover obvious implementation-quality blockers.

The independent reviewer should cover task completeness, correctness, architecture, and acceptance criteria.

---

# Required Workstream 19: Failure and Quarantine Behaviour

Preserve durable retries and quarantine semantics.

Do not introduce infinite retries.

A sensible pattern is:

```text
attempt 1 -> retry
attempt 2 -> retry
attempt 3 -> quarantine
```

Use the repository's existing retry count if different.

Quarantined jobs should be visibly labelled and require human attention.

Do not accidentally reschedule quarantined work through the ready-label intake.

---

# Required Workstream 20: No Imagined Wiring

This repository explicitly warns against imagined wiring.

Before adding a connection, verify it exists.

Examples:

Before importing a package:

- verify dependency exists.

Before injecting a provider:

- verify provider exists and is registered.

Before calling an endpoint:

- verify controller route exists.

Before assuming a response shape:

- inspect DTO/interface/schema.

Before writing persistence:

- inspect actual schema and migrations.

Before subscribing to realtime:

- inspect the current Centrifugo/LiveKit/realtime abstraction.

Before adding a new service:

- search for an existing service with the same responsibility.

Before adding a new component:

- search for an existing shared primitive.

Before creating a new database concept:

- search migrations and existing models.

Never invent wiring to make the implementation appear complete.

---

# Required Workstream 21: Product-Level Completion Rules

When an issue is user-facing, review completion from the user's perspective.

Ask:

- Can the user discover the feature?
- Can the user enter the flow?
- Does the action actually execute?
- Is real data used?
- Does it persist if persistence is expected?
- Does another user/device see it if realtime is expected?
- Does refresh preserve it if expected?
- Are loading, empty, success, and error states real?
- Is the user told the truth?
- Are errors recoverable?
- Is the feature accessible?
- Is it translated?
- Does RTL work?
- Are mobile layouts usable?
- Is privacy respected?
- Are block/report/search visibility controls preserved?

A user-facing feature that fails one of its required core behaviours is not complete.

---

# Required Workstream 22: Learning Product Constraints

This repository is a language-learning social product.

When touching learning features, preserve or improve:

- comprehensible input,
- retrieval practice,
- spaced repetition,
- active production,
- corrective feedback,
- source context,
- user confirmation before AI-generated content becomes trusted study data.

Do not silently write AI guesses into canonical vocabulary, corrections, or learner knowledge.

Prefer user-confirmed learning data.

Do not create duplicate vocabulary or SRS stores when an existing canonical system exists.

---

# Required Workstream 23: Realtime Constraints

When the issue depends on realtime behaviour, verify the actual realtime path.

Potential systems include:

- Centrifugo
- Redis
- LiveKit
- server events

Do not simulate realtime with local timers or local-only state and call the feature complete.

If realtime is out of scope, make that limitation explicit rather than faking it.

---

# Required Workstream 24: Database and Migration Constraints

If persistence changes:

- inspect current schema,
- inspect existing migration conventions,
- create a migration if required,
- make it safe and reversible where repository conventions require,
- update backend types/DTOs,
- update tests,
- verify no frontend direct DB access.

Do not add an in-memory fallback and describe persistence as complete.

---

# Required Workstream 25: API Contract Integrity

For changed frontend API calls:

- verify the URL,
- HTTP method,
- request DTO,
- response DTO,
- error behaviour,
- auth expectations,
- provider/module registration.

For changed backend endpoints:

- verify frontend consumers,
- DTO validation,
- service implementation,
- persistence/realtime side effects,
- error mapping.

Add contract tests where practical.

---

# Required Workstream 26: Scope Control

Do not turn this hardening task into a repository rewrite.

Focus on the factory.

Application code may be inspected to understand real failure modes, but do not repair unrelated application defects in the same PR unless they are directly required to test the factory change.

If unrelated CI failures are found:

1. prove they are unrelated,
2. report them,
3. fix them separately only if explicitly requested or if repository policy permits and the change is clearly isolated.

Keep factory hardening reviewable.

---

# Required Workstream 27: Verification

Run the repository's actual factory verification.

Expected categories likely include:

```bash
ruff check
mypy
pytest
```

Use the exact commands configured by the repository.

Also run any applicable repository constitution checks.

Do not claim verification you did not run.

If a command cannot run because of environment limitations:

- state exactly which command could not run,
- state why,
- use CI as the authoritative execution source if appropriate,
- do not fabricate success.

---

# Required Workstream 28: PR Behaviour

The factory should create a focused PR.

The PR description should include:

- summary,
- issue intake change,
- quality gate behaviour,
- structured review behaviour,
- definition-of-done change,
- tests added,
- deployment note,
- any known unrelated CI failures.

Do not claim unrelated baseline failures were caused by this PR.

Do not merge automatically unless all configured gates truly pass.

---

# Required Workstream 29: Acceptance Criteria for This Hardening Task

The hardening work is complete only if all of the following are true.

- [ ] `factory-ready` intake is safe-by-default.
- [ ] broad epics/planning issues cannot enter normal implementation.
- [ ] blocked/quarantined issues are excluded.
- [ ] deterministic diff inspection exists before PR creation.
- [ ] production mocks/fakes/stubs are blocked where confidently detected.
- [ ] newly introduced unsafe type escapes are blocked.
- [ ] newly skipped tests are blocked.
- [ ] legitimate test mocks remain possible.
- [ ] deterministic blockers trigger at most one bounded repair pass.
- [ ] unresolved deterministic blockers fail closed.
- [ ] independent review produces a structured report.
- [ ] a reviewer conversation finishing is not itself approval.
- [ ] missing or malformed review report fails closed.
- [ ] all explicit issue acceptance criteria must be assessed.
- [ ] failed criteria prevent approval.
- [ ] unresolved blocking findings prevent approval.
- [ ] review approval is tied to a specific head SHA.
- [ ] reviewer modifications are reverified.
- [ ] worker prompt prohibits fake or placeholder completion.
- [ ] documentation explains issue classification and safe deployment.
- [ ] tests cover happy paths and failure paths.
- [ ] existing canonical OpenHands factory remains the only autonomous resolver.
- [ ] GitHub Actions remain CI/final merge gates rather than a duplicate autonomous factory.

---

# Required Workstream 30: Anti-Goals

Do not do any of the following.

- Do not create a second autonomous issue resolver.
- Do not restore a retired GitHub Actions AI swarm.
- Do not create a second PR reviewer system.
- Do not add hidden backdoors around `factory-ready`.
- Do not make the gate pass by deleting tests.
- Do not make the gate pass by renaming "mock" to another synonym.
- Do not weaken strict typing.
- Do not broadly disable lint rules.
- Do not broadly suppress compiler errors.
- Do not use `any`.
- Do not add production placeholders.
- Do not create fake backend integrations.
- Do not assume routes/providers/packages exist.
- Do not duplicate existing services.
- Do not rewrite unrelated product code.
- Do not silently change deployment semantics.
- Do not claim tests passed when they were not executed.
- Do not merge code whose reviewed SHA has changed.

---

# Investigation Procedure

Before editing:

1. Read `AGENTS.md`.
2. Inspect `automation/openhands_factory`.
3. Inspect `automation/prompts`.
4. Inspect `docs/factory`.
5. Inspect current systemd/env configuration.
6. Inspect `.github/workflows`.
7. Search for `FACTORY_REQUIRE_READY_LABEL`.
8. Search for issue-label filtering.
9. Search for review-state publication.
10. Search for code that interprets a completed AI conversation as approval.
11. Search for existing quality-gate logic.
12. Search for existing retry/quarantine logic.
13. Search for old resolver/reviewer infrastructure and verify it is not active.
14. Read relevant tests before modifying behaviour.

Produce an evidence-based implementation plan from the actual repository state.

Do not rely on assumptions from this prompt when the repository says otherwise.

The repository is the source of truth.

---

# Implementation Strategy

Prefer small cohesive modules over one giant pipeline file.

Reasonable responsibilities may include:

```text
quality_gate.py
review_report.py
```

if equivalent modules do not already exist.

Possible responsibilities:

## quality_gate.py

- parse changed diff lines,
- classify test vs production paths,
- create `QualityFinding`,
- scan for suspicious production mock/placeholder behaviour,
- scan for unsafe type escapes,
- scan for newly skipped tests,
- format findings for repair prompt.

## review_report.py

- define report data structures,
- load JSON,
- validate schema,
- extract acceptance criteria,
- verify criterion coverage,
- return approval/blocking state.

However, do not create these files if equivalent canonical abstractions already exist.

Search first.

---

# Suggested Quality Finding Model

Use a deterministic model similar to:

```python
@dataclass(frozen=True)
class QualityFinding:
    code: str
    path: Path
    line: int | None
    summary: str
    evidence: str
```

Potential codes:

```text
production-mock
production-placeholder
unsafe-type-escape
skipped-test
```

Use repository style and typing conventions.

---

# Suggested Review Validation Rules

Pseudo-logic:

```python
report = load_review_report(worktree)

if report is missing:
    fail_review("Structured review report missing")

if report is malformed:
    fail_review("Structured review report invalid")

criteria = extract_acceptance_criteria(task.body)

if criteria:
    assert every criterion is represented in report

if any criterion passed is false:
    fail_review(...)

if report.blocking_findings:
    fail_review(...)

if report.approved is not true:
    fail_review(...)

publish_review_status(
    head_sha=current_reviewed_sha,
    approved=True,
    detail=report.summary,
)
```

Do not trust `approved=true` by itself.

The report content must be internally consistent.

---

# Suggested Review Prompt Language

The independent reviewer should receive instructions conceptually equivalent to:

> You are the independent completion reviewer. Your job is to prove whether this issue is actually complete, not to be agreeable. Inspect the issue, complete diff, related production code, tests, wiring, API contracts, persistence, realtime behaviour, routes/providers, and verification evidence. Treat UI-only, mocked, simulated, placeholder, incomplete, or unregistered implementations as blocking. Every explicit bullet under `## Acceptance criteria` must be copied into the review report and assessed individually. If you cannot verify a criterion, mark it failed. Write the required structured JSON report to the specified transient path. Do not approve merely because tests pass.

Adapt this to the existing prompt system.

---

# Suggested Worker Prompt Language

The implementation worker should receive instructions conceptually equivalent to:

> A rendered UI control is not completion. A mocked service is not completion. A placeholder is not completion. A TODO is not completion. Complete the real vertical slice required by the issue. Verify frontend, API, backend, persistence, realtime, registration, and tests as applicable. Search the existing codebase before creating new implementations. If a required dependency is missing and cannot be safely created within scope, do not fake it. Leave the issue blocked and explain the dependency.

---

# Suggested Quality Repair Prompt Language

The quality repair worker should receive:

> The deterministic quality gate found blocking implementation evidence. Fix the underlying production implementation. Do not bypass the rule, rename the mock, delete the test, skip the test, disable linting, or weaken types. Inspect the full issue and diff, correct the actual vertical slice, run applicable verification, and leave the worktree in a state that genuinely satisfies the issue.

Include formatted findings below it.

---

# Output Requirements

When finished, provide a concise engineering report containing:

## Repository evidence

What the factory did before the change.

## Changes made

Files and responsibilities changed.

## Issue intake

Exact safe-default behaviour.

## Deterministic gate

What is blocked and what is intentionally allowed.

## Review contract

How the structured review file works.

## Acceptance criteria

How criteria are extracted and enforced.

## SHA integrity

How stale approvals are prevented.

## Tests

Exact tests added or changed.

## Verification

Exact commands run and results.

## Deployment

Any environment change required.

## Remaining risks

Any false-positive or false-negative areas that should be monitored.

Do not hide uncertainty.

---

# Final Instruction

Treat this as a production reliability change to an autonomous software-engineering system.

The objective is not to make the AI produce more code.

The objective is to make it much harder for the AI to claim completion without evidence.

Prefer fewer, real, end-to-end implementations over a larger number of superficial pull requests.

Fail closed when completion cannot be proven.
