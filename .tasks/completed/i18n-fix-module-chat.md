
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'chat':
  - `chat.contextMenu.title` in frontend/src/app/chat/context-menu/chat-context-menu.component.ts
  - `chat.wallpaper.custom_url_label` in frontend/src/app/chat/wallpaper-picker/wallpaper-picker.component.ts
  - `chat.wallpaper.custom_url_placeholder` in frontend/src/app/chat/wallpaper-picker/wallpaper-picker.component.ts
  - `common.close` in frontend/src/app/chat/wallpaper-picker/wallpaper-picker.component.ts
  - `chat.unknown_user` in frontend/src/app/chat/threaded-reply/threaded-reply.component.ts
  - `chat.wallpaper.title` in frontend/src/app/chat/wallpaper-picker/wallpaper-picker.component.ts
  - `chat.cancel_reply` in frontend/src/app/chat/threaded-reply/threaded-reply.component.ts
  - `chat.wallpaper.apply` in frontend/src/app/chat/wallpaper-picker/wallpaper-picker.component.ts
  - `common.close` in frontend/src/app/chat/context-menu/chat-context-menu.component.ts

* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `chat.component.element` structure.
