
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'audio-rooms':
  - `audioRoom.host` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.stageEmpty` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.mutedLabel` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.listening` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.coHostBadge` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.stageGridTitle` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.speaking` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.videoStreamLabel` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.listenerCount` in frontend/src/app/audio-rooms/audio-room.component.html
  - `audioRoom.stageCount` in frontend/src/app/audio-rooms/audio-room.component.html
  - ... and 2 more.
* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `audio-rooms.component.element` structure.
