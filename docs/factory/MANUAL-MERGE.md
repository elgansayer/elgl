# Manual merge authority

The repository owner may deliberately merge a pull request while `CI / required` is pending, failed, or
unavailable, or while the Factory's `factory/independent-review` comment is missing or rejected. This is a human
break-glass path, not an autonomous Factory fallback.

## Server policy

Protection for `main` uses an active baseline GitHub ruleset:

1. The baseline `main` ruleset requires a pull request and strict `CI / required` on the current head. It also
   owns the repository's non-fast-forward, deletion, and other baseline protections.
2. `factory/independent-review` is not a required GitHub status. Independent review is represented by a
   machine-readable pull-request comment bound to the exact reviewed head SHA plus the `factory-reviewed` label.
3. The baseline ruleset may have one bypass actor: the exact repository-owner `User`, with
   `bypass_mode=pull_request`.

The owner can therefore waive CI on an existing pull request. Independent review does not need a GitHub ruleset
bypass because it is an autonomous Factory merge condition rather than a server-side status check. The owner
cannot use this path to push directly to `main` or bypass the pull-request boundary. Repository roles, teams,
apps, deploy keys, and always-mode bypasses are not permitted.

The online doctor accepts a no-bypass policy or the exact-owner baseline policy. It fails if the manual actor is
not the repository-owner user, if any additional actor is present, if the bypass applies outside pull requests,
or if an active ruleset still requires the retired `factory/independent-review` status context.

## Manual procedure

Use the GitHub pull-request web page:

1. Confirm the base is `main` and inspect the exact current head commit.
2. Inspect every visible check, unresolved conversation, and the current diff. Update the branch first if GitHub
   reports it behind `main`.
3. Prefer waiting for `CI / required` and an approved `factory/independent-review` comment for that exact head.
   If either must be waived, understand the missing evidence and record the operational reason.
4. Select squash merge. Use GitHub's owner bypass only if the required CI rule itself needs waiver and record a
   concise reason.
5. Confirm the merged SHA, then let the Factory reconcile its durable job and source issue.

Do not disable a ruleset, alter required CI, use a broad administrator CLI bypass, permit direct pushes, or grant
another actor the owner's bypass. Do not restore `factory/independent-review` as a required status; that would
conflict with the comment-based review contract and can deadlock autonomous merges.

## Autonomous behaviour

The daemon and scheduled merge workflow require literal success from `CI / required`, the `factory-reviewed`
label, and the latest repository-owner Factory review marker for the exact current head to be:

`<!-- factory/independent-review state=approved head=<sha> -->`

A later `pending` or `rejected` marker for the same SHA invalidates the earlier approval, and any new head requires
a fresh review. The merge workflow also requires clean mergeability, no blocking human review, and an exact-head
`--match-head-commit` merge. It never invokes the owner bypass. Independent review retains first scheduling
position and reserved provider capacity.

## Revocation

To remove manual CI-bypass authority, delete the owner bypass actor from the baseline ruleset. `CI / required`
then becomes mandatory for every actor without changing autonomous Factory review-comment behaviour.

GitHub documents pull-request rulesets and pull-request-only bypass modes in
[About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
and the [Repository rules REST API](https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28).
