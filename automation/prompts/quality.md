# Deterministic Quality Repair

The deterministic factory quality gate found blocking evidence in the current diff.

Fix the reported findings in the assigned worktree. Production code must not introduce mocks, fakes,
stubs, knowingly unimplemented UI, or TypeScript `as any` escapes. Do not silence the gate by renaming a
mock or moving fake behaviour elsewhere. Replace it with the real existing API/service/persistence/realtime
integration required by the issue, or remove the incomplete surface if the real dependency does not exist.

New or modified tests must not be skipped. Preserve existing architecture and verify the corrected diff.
Do not broaden the issue beyond what is needed to make the vertical slice genuinely production-ready.
