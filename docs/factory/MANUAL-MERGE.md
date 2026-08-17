# Manual merge authority

The repository owner may deliberately merge a pull request while `factory/independent-review` is pending or
unavailable. This is a human break-glass path, not an autonomous Factory fallback.

## Server policy

Protection for `main` is split across two active, layered GitHub rulesets:

1. The baseline `main` ruleset has no bypass actors. It requires a pull request and strict `CI / required` on the
   current head. It also owns the repository's non-fast-forward, deletion, and other baseline protections.
2. The `factory-independent-review` ruleset contains only the required
   `factory/independent-review` status. Its sole bypass actor is the exact repository-owner `User`, with
   `bypass_mode=pull_request`.

Because the baseline ruleset has no bypass, the owner cannot use this path to push directly to `main`, merge a
head without successful CI, or bypass the pull-request boundary. Repository roles, teams, apps, deploy keys, and
always-mode bypasses are not permitted.

The online doctor accepts either the stricter single no-bypass ruleset or this layered policy. It fails if the
manual actor is not the exact repository-owner user, if the bypass applies outside pull requests, or if the
bypass-enabled ruleset contains anything besides `factory/independent-review`.

## Manual procedure

Use the GitHub pull-request web page:

1. Confirm the base is `main` and inspect the exact current head commit.
2. Wait for `CI / required` to report success on that head. Update the branch and wait again if GitHub reports it
   behind `main`.
3. Review unresolved conversations and visible failed checks. The owner can choose to override the independent
   Factory review, but should understand which evidence is being waived.
4. Select squash merge. When GitHub offers the ruleset bypass, bypass only
   `factory-independent-review` and record a concise reason.
5. Confirm the merged SHA, then let the Factory reconcile its durable job and source issue.

Do not disable a ruleset, alter required statuses, use a broad administrator CLI bypass, or grant the Factory
token the owner's bypass identity. Those actions would weaken controls beyond the requested manual review
override.

## Autonomous behaviour

The daemon and scheduled merge workflow still require literal success from both `CI / required` and
`factory/independent-review`, an unchanged reviewed SHA, clean mergeability, and no blocking review. They never
invoke the owner bypass. Factory automation never invokes it. Independent review retains first scheduling
position and reserved provider capacity.

## Revocation

To remove manual authority, delete the owner bypass actor from `factory-independent-review`. The review status
then becomes mandatory for every actor without changing the baseline ruleset.

GitHub documents layered rulesets and pull-request-only bypass modes in
[About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
and the [Repository rules REST API](https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28).
