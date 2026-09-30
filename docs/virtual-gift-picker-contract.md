# Virtual gift picker production contract

This document records the production behavior for the chat virtual-gift picker tracked by #1671.

## Architecture

The Angular `GiftPickerComponent` is a presentation and orchestration surface over the existing `EconomyStore`. Gift catalogue data and the current coin balance come from authenticated economy APIs. Gift sends continue through the existing authenticated `POST /economy/send-gift` path; the backend remains authoritative for gift existence, recipient eligibility, sufficient funds, coin deduction, transaction persistence and realtime delivery.

The picker must never manufacture or persist a local coin balance. The displayed balance is the latest balance exposed by `EconomyStore`, normalised defensively for rendering. Selecting a gift does not spend coins. A successful server-confirmed send updates `EconomyStore.coinsBalance`, and the picker closes only after that confirmation.

## Send state machine

1. The user can select only a finite, non-negative-cost gift whose cost is no greater than the current coin balance.
2. The picker re-checks connectivity and affordability immediately before sending. A balance change between selection and confirmation therefore fails closed.
3. Once a send starts, close, deselect, purchase and duplicate-send controls are disabled. Repeated confirmation attempts share the same in-flight UI state and only one store mutation is started.
4. A successful send triggers the existing gift animation and closes the picker after the store has accepted the authoritative server result.
5. A failed send leaves the selected gift visible and retryable. It does not animate or close.

## Offline behavior

Coin spending is not safe to guess or optimistically replay from the picker because the balance, catalogue and recipient eligibility may change while the device is disconnected. Gift selection, gift sending and coin-purchase actions are therefore disabled while offline. The picker does not claim success or animate an undelivered gift.

This is intentionally stricter than cacheable read-only economy data. Cached catalogue/balance data may still be rendered, but it does not grant permission to spend.

## Accessibility and responsive behavior

- Gifts use a labelled `radiogroup` / `radio` interaction model and preserve Spartan button focus behavior.
- The live coin balance uses `aria-live="polite"` so a confirmed server deduction is announced without interrupting the user.
- The send action exposes `aria-busy` while the mutation is in flight.
- Important actions are disabled during an in-flight spend so keyboard, pointer and assistive-technology users receive the same mutation semantics.
- Layout containers can wrap and long package/gift text can break at high zoom instead of forcing horizontal document overflow.
- Gift icons are decorative; accessible names come from translated text rather than emoji alone.

## Security and privacy

The browser does not decide whether a gift may be sent and does not directly mutate coin balances. Authentication, authorization, sufficient-funds checks and persistence remain server-side. The picker sends only the recipient ID, selected gift ID and optional room ID required by the established economy API. No private message text, credentials or payment data are introduced by this component.

## Failure handling and observability

The UI treats `EconomyStore.sendGift()` returning `false` as a retryable failure. It preserves selection and does not emit success side effects. Backend economy logging/metrics remain the authoritative source for send failures; the picker does not log recipient identifiers or other extra personal data.

Malformed local balance values are rendered as zero spendable coins. Malformed or negative gift costs are rejected before a request is attempted.

## Verification

`frontend/src/app/components/gift-picker/gift-picker.component.spec.ts` is an active Vitest suite covering:

- live balance rendering and malformed-balance fail-closed behavior;
- affordable, unaffordable and offline selection;
- no optimistic coin deduction before server confirmation;
- successful sends and animation/close ordering;
- duplicate in-flight confirmation suppression;
- retry behavior after a failed send;
- connectivity or balance changes after selection;
- offline coin-purchase suppression and lazy package loading;
- close suppression while a spend is in flight.

Repository CI remains the authoritative clean-environment validation for frontend unit, static-analysis/build, translation-safety and UI-governance checks.

## Rollout and rollback

No schema, API, persisted-data or generated-client migration is required. Deploy as a normal frontend release after the existing economy backend is available. Mixed versions are safe because the API contract is unchanged.

Rollback is a normal revert of the frontend component/tests/docs. No data repair is required because this change does not alter persisted gift or coin records.
