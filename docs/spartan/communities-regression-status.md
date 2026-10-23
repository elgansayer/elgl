# Communities regression and design-preview status

Tracks completion of #6060 for `frontend/src/app/components/communities/` and supplements the original #6056 Spartan/Relay audit.

## Locked regression contract

The focused component suite now covers the feature behaviour that must remain stable through later design-system work:

- initial owned-community loading through `CommunitiesService.listMine()`
- trimming of community name and description before create
- omission of a blank optional description
- no create or resource reload for a blank trimmed name
- form reset and collection reload after successful create
- deletion using the selected community id and collection reload after success
- valid list semantics for a loaded empty collection
- semantic Relay surface tokens and absence of palette-specific product colours
- persistent translated input labels
- native, touch-sized Spartan create/delete actions with deterministic keyboard focus
- contextual accessible naming for repeated Delete actions
- 390px-first layout, tablet/desktop refinements, high-zoom wrapping, and RTL-safe directional utilities

The tests mock `CommunitiesService` and do not depend on a live backend.

## Design-preview contract

`frontend/design-preview/components/communities.html` now represents three explicit surface states:

1. light theme, 390px mobile, populated collection
2. dark theme, desktop, populated collection
3. light theme, 390px mobile, loaded empty collection

The preview retains the Relay semantic surface/text/primary/danger roles and models the same accessible input and action semantics as the Angular surface.

## Completion status

Issue #6060 is complete when the focused component regression suite and repository frontend/design governance checks pass on the pull-request head.

This status supersedes historical statements in the original #6056 audit that the component had no focused spec, lacked persistent input labels, used invalid empty-list markup, or lacked contextual Delete naming. Those gaps have since been addressed by the staged migration work.

Loading/error presentation and any future mutation-progress behaviour remain separate product/implementation concerns and are not invented by this regression-lock ticket.