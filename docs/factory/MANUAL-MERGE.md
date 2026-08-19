# Manual merge authority

The repository owner may deliberately merge a pull request while `CI / required`,
`factory/independent-review`, or both are pending, failed, or unavailable. This is a human break-glass path, not
an autonomous Factory fallback.

## Server policy

Protection for `main` is split across two active, layered GitHub rulesets:

1. The baseline `main` ruleset requires a pull request and strict `CI / required` on the current head. It also
   owns the repository's non-fast-forward, deletion, and other baseline protections.
2. The `factory-independent-review` ruleset contains only the required
   `factory/independent-review` status.
3. Both rulesets have one bypass actor: the exact repository-owner `User`, with
   `bypass_mode=pull_request`.

The owner can therefore waive CI, independent review, or both on an existing pull request. The owner cannot use
this path to push directly to `main` or bypass the pull-request boundary. Repository roles, teams, apps, deploy
keys, and always-mode bypasses are not permitted.

The online doctor accepts a no-bypass policy or this exact-owner layered policy. It fails if the manual actor is
not the repository-owner user, if any additional actor is present, or if the bypass applies outside pull
requests. A review-only bypass ruleset must still contain only `factory/independent-review`; the baseline may own
its existing pull-request, CI, and repository-integrity rules.

## Manual procedure

Use the GitHub pull-request web page:

1. Confirm the base is `main` and inspect the exact current head commit.
2. Inspect every visible check, unresolved conversation, and the current diff. Update the branch first if GitHub
   reports it behind `main`.
3. Prefer waiting for `CI / required` and `factory/independent-review`. If either must be waived, understand the
   missing evidence and record the operational reason.
4. Select squash merge. Use GitHub's owner bypass on only the rules that need waiver and record a concise reason.
5. Confirm the merged SHA, then let the Factory reconcile its durable job and source issue.

Do not disable a ruleset, alter required statuses, use a broad administrator CLI bypass, permit direct pushes, or
grant another actor the owner's bypass. Those actions would weaken controls beyond the requested manual merge
authority.

## Autonomous behaviour

The daemon and scheduled merge workflow still require literal success from both `CI / required` and
`factory/independent-review`, an unchanged reviewed SHA, clean mergeability, and no blocking review. They never
invoke the owner bypass. Factory automation never invokes it. Independent review retains first scheduling
position and reserved provider capacity.

## Revocation

To remove manual authority, delete the owner bypass actor from both rulesets. Both statuses then become mandatory
for every actor without changing autonomous Factory behaviour.

GitHub documents layered rulesets and pull-request-only bypass modes in
[About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
and the [Repository rules REST API](https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28).
