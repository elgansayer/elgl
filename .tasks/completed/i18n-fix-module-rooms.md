
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'rooms':
  - `roomChat.placeholder` in frontend/src/app/rooms/room-chat/room-chat.component.html
  - `roomChat.empty` in frontend/src/app/rooms/room-chat/room-chat.component.html
  - `roomChat.send` in frontend/src/app/rooms/room-chat/room-chat.component.html

* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `rooms.component.element` structure.
