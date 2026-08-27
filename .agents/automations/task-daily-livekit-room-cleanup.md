# Daily LiveKit Room Architecture Cleanup

## Objective
Prevent memory leaks and invalid state in the LiveKit audio/video SFU integration.

## Instructions
1. Review the `livekit-room-flow` skill and audit `backend/src/audio-rooms`.
2. Ensure that when a host ends a room, the NestJS service explicitly tears down the LiveKit room and marks the database record `is_active = false`.
3. Check the token minting logic (`AccessToken`) to ensure listener tokens correctly have `canPublish: false` and are only elevated via the 'raise-hand' approval protocol.
4. Run comprehensive backend unit tests to ensure room lifecycle events are handled flawlessly.
