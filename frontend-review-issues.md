# Frontend review follow-ups

## Large lists: measure before choosing virtualisation

Reading and chat source contains standard Angular loops. That alone does not prove severe memory use or visible lag. Profile representative article and chat histories with realistic message sizes, images, device memory and pagination. Record DOM-node count, frame time and memory before deciding whether CDK virtual scrolling improves the observed bottleneck.

If virtualisation is justified, preserve dynamic item heights, pagination, scroll position when prepending messages, keyboard navigation, search, selection and screen-reader access. Compare the same workload before and after the change. Existing use of stable tracking keys is a separate concern.

## Conversation analysis: preserve the current request contract

The alleged close-while-pending race was not reproduced. The current template shows the result close control only after a result exists, so the original report's proposed click sequence is not available in that state. Do not reset `running` or cancel a paid operation solely on this claim.

A useful follow-up is to test route teardown, request failure, retry and repeated activation while preserving payment idempotency and the existing single-flight guard. Document a reachable sequence and expected behaviour before changing cancellation semantics.
