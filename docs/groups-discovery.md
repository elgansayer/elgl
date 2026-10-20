# Groups Discovery

## Scope

Issue #1503 completes the existing Groups Discovery surface that was originally introduced under the earlier #1307 tracking item. The same `GroupsDiscoveryComponent` is available as the Groups tab inside `/chat` and as the standalone lazy-loaded `/groups` route. It lets an authenticated learner browse discoverable groups, narrow the list by interest/topic, see membership and capacity state, and join an available group.

This contract deliberately keeps group discovery separate from one-to-one partner discovery. Group membership and capacity remain server-owned; the browser never fabricates a successful join or trusts an arbitrary group identifier supplied outside the loaded discovery result.

## Product contract

The Groups tab embeds `GroupsDiscoveryComponent` with `isEmbedded=true`. The standalone `/groups` route loads the same component, so both entry points share one implementation.

The component loads:

- localized topic metadata from `GET /interests?language=<ui-language>`;
- group cards from `GET /groups/discoverable`;
- membership changes through `POST /groups/:groupId/join`.

Topic selection is presentation-only filtering over the authoritative loaded group collection. Clearing the topic restores the full loaded collection without issuing a second discovery request.

Each accepted card must contain a unique bounded identifier, a non-empty name, a bounded owner identifier, a valid creation timestamp, a `max_members` value from 2 through 19, an integer `member_count` from 0 through that maximum, a boolean membership flag, and an optional bounded interest identifier. At most 100 group cards and 100 topic records are accepted into UI state. Malformed, duplicate, internally inconsistent, or oversized API payloads fail closed rather than partially rendering untrusted data.

A non-member can join only while the group is below capacity. Existing members see a joined state and full groups are not offered a Join action. Programmatic attempts to join an unknown, already joined, or full group do not issue a network mutation. While one join is pending, all Join actions are disabled and additional join attempts are ignored so rapid input cannot create conflicting client writes.

## Authentication and authorization

`GroupsController` protects discoverable-group reads and join mutations with `SupabaseAuthGuard`. The authenticated user ID comes from `CurrentUser`; callers do not supply the membership owner in the request body.

`GroupsService.joinGroup()` verifies that the group exists, checks existing membership, checks current capacity, and persists membership through `group_members`. The frontend treats only a structurally valid server response as completion and reloads discovery after that response so server state remains authoritative.

## Security and privacy

All API responses are treated as untrusted at the Angular boundary. Group/topic collections are validated and bounded before they enter component state. Group names are rendered through normal Angular text interpolation with `dir="auto"`; no rich-HTML sink is used for user-authored names.

Provider, database, host, and transport error details are never reflected into the UI. Discovery and join failures use the existing localized generic error message. The component does not log response payloads, identifiers, or private membership data.

## Accessibility and responsive behavior

Topic choices expose single-selection radio semantics and translated accessible naming. Join actions use the repository-owned Spartan button primitive and native disabled semantics while a join is pending, with `aria-busy` identifying the active operation. Joined and full states are rendered as text rather than disabled pseudo-controls.

The discovery list uses a one-column mobile layout and expands to two and three columns at the existing tablet/desktop breakpoints. Logical layout utilities are used so the same surface remains direction-safe under RTL locales. Group names use `dir="auto"` so mixed-direction user content remains readable.

The decorative empty-state icon is hidden from assistive technology. A load failure is presented as an alert and is not simultaneously announced as a genuine empty collection.

## Failure behavior

A discovery provider/network failure or an invalid discovery payload produces an explicit generic error state and an empty authoritative collection; the component does not manufacture fallback groups and does not show the normal "no groups" state at the same time.

A failed or malformed join response does not reload or mark the group as joined, leaving the action retryable after pending state is cleared. Raw backend/provider error text is discarded.

Topic metadata is optional presentation data. If the interests request fails validation or cannot be loaded, group discovery still works without topic pills.

## Verification

Focused frontend coverage locks:

- the Groups tab embedding and standalone lazy route;
- localized topic metadata and discoverable-group requests;
- bounded runtime validation for group/topic API responses;
- client-side topic filtering and filter reset;
- join request shape, pending state, serialized mutations, refresh-on-success, and retryable failure;
- suppression of mutations for unknown/joined/full groups;
- rejection of malformed join responses;
- privacy-safe failure text without provider details;
- member/full capacity presentation contracts;
- Spartan/native interaction ownership.

Run the focused Angular tests from `frontend/`:

```sh
npm test -- --include='src/app/components/groups-discovery/groups-discovery.component.spec.ts' --include='src/app/groups-discovery.contract.spec.ts'
```

Repository CI remains authoritative for the complete frontend unit, static-analysis, production-build, accessibility/design-governance, and end-to-end gates.

## Rollout and rollback

There is no schema or API migration in this completion change. The runtime validation is additive at the consumer boundary and remains compatible with the existing backend response shape. Rollout is the normal frontend deployment path.

Rollback is a normal revert of the component/tests/documentation commits. It does not modify group memberships or user data and requires no cleanup.
