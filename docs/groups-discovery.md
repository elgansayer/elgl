# Groups Discovery

## Scope

Issue #1307 is implemented by the existing Groups Discovery surface. The same `GroupsDiscoveryComponent` is available as the Groups tab inside `/chat` and as the standalone lazy-loaded `/groups` route. The component lets an authenticated learner browse discoverable groups, narrow the list by interest/topic, see membership and capacity state, and join an available group.

This contract deliberately keeps group discovery separate from one-to-one partner discovery. Group membership remains server-owned; the browser never fabricates membership or capacity state.

## Product contract

The Groups tab embeds `GroupsDiscoveryComponent` with `isEmbedded=true`. The standalone `/groups` route loads the same component, so both entry points share one implementation.

The component loads:

- localized topic metadata from `GET /interests?language=<ui-language>`;
- group cards from `GET /groups/discoverable`;
- membership changes through `POST /groups/:groupId/join`.

Topic selection is presentation-only filtering over the authoritative loaded group collection. Clearing the topic restores the full loaded collection without issuing a second discovery request.

Each card exposes the authoritative `member_count`, `max_members`, and `is_member` values returned by the backend. A non-member can join only while the group is below capacity. Existing members see a joined state and full groups are not offered a Join action.

## Authentication and authorization

`GroupsController` protects discoverable-group reads and join mutations with `SupabaseAuthGuard`. The authenticated user ID comes from `CurrentUser`; callers do not supply the membership owner in the request body.

`GroupsService.joinGroup()` verifies that the group exists, checks existing membership, checks current capacity, and persists membership through `group_members`. The frontend treats the server response as authoritative and reloads discovery after a successful join.

## Accessibility and responsive behavior

Topic choices expose single-selection radio semantics and translated accessible naming. Join actions use the repository-owned Spartan button primitive and native disabled semantics while a join is pending. Joined and full states are rendered as text rather than disabled pseudo-controls.

The discovery list uses a one-column mobile layout and expands to two and three columns at the existing tablet/desktop breakpoints. Logical layout utilities are used so the same surface remains direction-safe under RTL locales.

## Failure behavior

A discovery provider/network failure produces an explicit error state and an empty authoritative collection; the component does not manufacture fallback groups. A failed join does not reload or mark the group as joined, leaving the action retryable. Pending join state is always cleared after success or failure.

Topic metadata is optional presentation data. If the interests request fails, group discovery still works without topic pills.

## Verification

Focused frontend coverage locks:

- the Groups tab embedding and standalone lazy route;
- localized topic metadata and discoverable-group requests;
- client-side topic filtering and filter reset;
- authenticated join request shape, pending state, refresh-on-success, and retryable failure;
- member/full capacity presentation contracts;
- Spartan/native interaction ownership.

Run the focused Angular tests from `frontend/`:

```sh
npm test -- --include='src/app/components/groups-discovery/groups-discovery.component.spec.ts' --include='src/app/groups-discovery.contract.spec.ts'
```

Repository CI remains authoritative for the complete frontend unit, static-analysis, production-build, accessibility/design-governance, and end-to-end gates.

## Rollout and rollback

There is no schema or API migration in this completion change. Rollout is the normal frontend test/documentation deployment path. Rollback is a normal revert of the regression contract and documentation; it does not modify group memberships or user data.
