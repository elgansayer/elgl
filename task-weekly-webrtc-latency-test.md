# Weekly WebRTC & LiveKit Health Test

## Objective
Validate the 24/7 real-time voice and video infrastructure.

## Instructions
1. Review the `livekit-room-flow` integration in the backend.
2. Write or run synthetic tests that simulate 10+ users connecting to an audio room, raising hands, and publishing audio.
3. Ensure the room cleanly tears down when the host leaves, preventing ghost rooms.
4. Verify tests pass against the mock LiveKit SDK.
