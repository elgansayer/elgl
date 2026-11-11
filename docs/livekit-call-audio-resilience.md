# LiveKit call audio resilience: Bluetooth headsets, interruptions and the background

Issue: #2039

## Scope

Direct calls, audio rooms and video calls now keep their audio usable when a Bluetooth headset connects or disconnects, when the operating system takes the microphone away, when a headset media key pauses playback, when the browser blocks sound, and when the page moves to the background.

This is a frontend change. The media plane, the token endpoints, the E2EE key brokering (see `voice-call-e2ee.md`) and the TURN networking (see `livekit-turn-networking.md`) are unchanged. There is no API, schema or configuration change.

## What was wrong

Evidence from the code before this change:

- No code anywhere attached a remote **audio** track to a media element. Only video tracks were attached, so remote audio had no element to play through, and nothing could resume it.
- `RoomEvent.AudioPlaybackStatusChanged`, `MediaDevicesChanged`, `ActiveDeviceChanged`, `MediaDevicesError` and `LocalAudioSilenceDetected` were never observed. When LiveKit restarted a dead microphone, or muted it after failing to, the person saw no change.
- `AppComponent` called `AppLockService.lockNow()` whenever the page became hidden. That routes to `/lock`, which destroys the routed call screen, and the screen's `ngOnDestroy` leaves the room. With the biometric lock on, switching tab or app hung up the call.

## What LiveKit already does, and what is added

`livekit-client` already restarts an ended microphone on the default device, mutes it when that fails, re-selects default devices on `devicechange` (not on iOS), and pauses upstream when the operating system mutes capture. It does not tell the application what happened, and it never renders remote audio for you.

| Event                                                                                                                                                                                                                                             | Handling                                                                                                                                                                                              | What the person sees                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A remote audio track is subscribed                                                                                                                                                                                                                | Attached to a hidden `audio` element in the document, released on unsubscribe or when the session ends                                                                                                | Sound plays                                                            |
| The browser or system blocks playback (`AudioPlaybackStatusChanged` false, or a paused element that will not restart)                                                                                                                             | `playbackBlocked` is set. `resumePlayback()` calls `room.startAudio()` from the button press                                                                                                          | Alert: "Turn on sound"                                                 |
| A headset media key or an interruption pauses the audio element                                                                                                                                                                                   | The element is restarted immediately. If the browser refuses, playback is reported as blocked                                                                                                         | Nothing, or the alert above                                            |
| The page returns to the foreground                                                                                                                                                                                                                | If sound is blocked or an element is paused, playback is retried. The microphone device is checked again                                                                                              | Nothing, or the alert above                                            |
| The microphone track ends and LiveKit cannot restart it (a mute that follows an `ended`)                                                                                                                                                          | `microphoneInterrupted` is set                                                                                                                                                                        | Alert: "Reconnect microphone"                                          |
| The operating system pauses capture (`UpstreamPaused`), the microphone delivers only silence (`LocalAudioSilenceDetected` when published, `AudioSilenceDetected` after a restart, ignored while muted), or opening it fails (`MediaDevicesError`) | `microphoneInterrupted` is set. `UpstreamResumed`, `Restarted` and `Unmuted` clear it                                                                                                                 | Alert: "Reconnect microphone"                                          |
| `devicechange` and the active microphone is no longer listed                                                                                                                                                                                      | If LiveKit is not already restarting the track, the microphone is restarted on the first listed device. This covers iOS, where LiveKit leaves default devices alone, and acts as a backstop elsewhere | Status: "Microphone switched to ..."                                   |
| The active microphone or speaker changes (`ActiveDeviceChanged`)                                                                                                                                                                                  | A notice names the new device. The first event after publishing only binds the default device to its concrete id and is not announced                                                                 | Status: "Microphone switched to ..." or "Sound output switched to ..." |
| The room ends without its owner noticing (`Disconnected`)                                                                                                                                                                                         | The session is released                                                                                                                                                                               | Banner and app lock stop waiting                                       |

A deliberate mute is never reported as an interruption. A mute only counts after a microphone `ended` that was never followed by a restart.

"Reconnect microphone" restarts the track on the system default device, not the device it last used, because the last device is usually the headset that just left. It unmutes the track, since the person has just asked for sound.

## Architecture

- `CallAudioSessionService` (`frontend/src/app/services/call-audio-session.service.ts`) owns all of the above for one attached `Room` and exposes signals: `isActive`, `isCallActive`, `playbackBlocked`, `microphoneInterrupted`, `deviceNotice`. It has no HTTP or crash-reporting dependency, so attaching a room never changes a consumer's injection graph.
- `CallAudioStatusComponent` (`frontend/src/app/components/call-audio-status`) is mounted once in `app.component.html`. It renders nothing until a signal is set. Blocked sound and a dead microphone are `role="alert"`; a device change is a polite `role="status"`. Controls are Spartan Helm buttons with touch size and visible text names. Copy is translated through `I18nService` (`callAudio.*`), message text uses `dir="auto"` so device names in any script read correctly, and spacing is logical for right-to-left layouts.
- The three places that create a `Room` attach it once connected and detach it before disconnecting:
  - `LivekitService.joinRoom` and `leaveRoom` (voice and video calls through `/active-call`), as a `call` session;
  - `VideoCallComponent` (`/video-call`), as a `call` session;
  - `AudioRoomsStore.joinRoom` and `leaveRoom` (audio rooms), as a `room` session.
- `VideoCallService` is not used by any component and is not wired.

Attaching a different room releases the previous session, so a stale owner can never keep a dead session alive. Detaching a room that is not the attached one does nothing.

## Background and the app lock

While a one-to-one call is attached, `AppLockService.lockNow()` records that a lock is pending instead of locking. The lock is applied the moment the call ends, whether the call screen ended it or the room disconnected on its own. Switching the biometric lock off clears a pending lock. Audio rooms do not hold the lock.

This is a deliberate trade-off. Locking at the moment of backgrounding hangs up the call, because the lock is a route and the call screen is a routed component. Holding the lock exposes only the call screen for the length of the call: leaving that screen ends the call, which applies the lock straight away. The server-side authentication boundary is untouched, and the lock still applies when the call ends. A product decision to keep audio rooms alive in the background as well would be a one-line change (`attach(room, 'call')` for rooms), and should be taken together with whether room chat may stay visible while the app is locked.

## Data handling

Nothing is persisted. Session state lives in memory and is cleared when the session ends. The only data that leaves the browser is an error-level log entry through the existing crash-reporting path, limited to an enumerated reason. Device labels are shown to the person who owns the device and are never stored or sent.

## Observability

Entries go through `LoggingService` with the context `CallAudioSession`, resolved on use. Data is limited to enumerated reasons and the session kind. Device labels, device ids, room names and tokens are never logged (covered by a test). Errors reach crash reporting through the existing `LoggingService` path.

| Message                                | Level | Data                                                                                                                       |
| -------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| `session-attached`, `session-detached` | info  | `kind` (`call` or `room`)                                                                                                  |
| `audio-device-changed`                 | info  | `kind` (`audioinput` or `audiooutput`)                                                                                     |
| `playback-blocked`                     | warn  | none                                                                                                                       |
| `playback-resume-rejected`             | warn  | `reason`: error name                                                                                                       |
| `microphone-interrupted`               | warn  | `reason`: `ended`, `upstream-paused`, `silence`, `device-error`, `device-missing`; `failure`: error name when there is one |
| `microphone-recovery-failed`           | error | `reason`: error name                                                                                                       |
| `audio-input-fallback-failed`          | error | `reason`: error name                                                                                                       |

Correlate a report of "they could not hear me" by looking for `microphone-interrupted` followed by `microphone-recovery-failed`, and "I could not hear them" by `playback-blocked` followed by `playback-resume-rejected`.

## Verification

Automated:

- `call-audio-session.service.spec.ts`: lifecycle, remote audio rendering and release, pause and resume, blocked playback, foreground retry, every microphone interruption signal, recovery, device notices (including ordering and dismissal while loading), device loss fallback, coalescing of device checks, and log content.
- `call-audio-status.component.spec.ts`: each message, priority, button actions, busy state, live-region roles, touch size, text direction and logical spacing.
- `app-lock.service.spec.ts`: immediate lock without a call, waiting during a call, applying at the end, and clearing when the lock is switched off.
- `livekit.service.audio-session.spec.ts`, `video-call.component.audio-session.spec.ts`, `audio-rooms.store.audio-session.spec.ts`: attach after connecting, never for a room that failed to connect, detach before disconnecting.

Real devices are not available to the test suite. Before a release that changes this area, check by hand on a phone and a desktop:

1. Join a call with a Bluetooth headset, then switch the headset off. Speech should continue on the built-in microphone and a "switched to" notice should appear.
2. Switch it back on mid-call. Sound should continue and nothing should break.
3. Press the headset play or pause key during a call. Sound should keep playing.
4. On iOS Safari, take a phone call or trigger Siri during a call. After it ends, sound should return, or "Turn on sound" should appear and work.
5. With the biometric lock on, switch to another app during a call and come back. The call should still be connected. Hang up and confirm the lock screen appears.

## Rollout and rollback

Frontend only. There is no migration, flag, or ordering constraint with the backend. To roll back, revert the change: remote audio rendering, the banner and the lock waiting all go together, and the previous behaviour returns.

## Known limits and follow-ups

- There is no audio device picker. Devices change only when the system or LiveKit changes them.
- Media Session actions for headset hang-up and microphone toggle are not wired. The TypeScript DOM library in use does not type them, and no call surface exposes a hang-up callback yet.
- iOS route changes could not be verified without a device. The recovery action is the safety net for any case that detection misses.
- Several call components still contain hard-coded English call-state text (`VoipCallComponent`). It is outside this change.
