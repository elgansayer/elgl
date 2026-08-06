Priority: Medium Impact

Description:
There are scattered hardcoded textual strings and input placeholders directly in the HTML templates and component definitions. An audit found roughly 21 hardcoded HTML element text nodes and 18 hardcoded placeholders, causing those strings to resist localization.

Affected files include:
- `frontend/src/app/components/word-definition-modal/word-definition-modal.component.html`: `<span>Translation</span>`
- `frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts`: `<button>Ban</button>`, `<button>Warn</button>`
- `frontend/src/app/components/sticker-picker/sticker-picker.component.ts`: `<h3>Stickers</h3>`
- `frontend/src/app/components/profile/profile.component.html`: Currency options (`<option>USD</option>`, `<option>EUR</option>`, etc.)
- `frontend/src/app/components/incoming-call-modal/incoming-call-modal.component.ts`: `<span>Decline</span>`, `<span>Accept</span>`
- `frontend/src/app/components/profile-edit/profile-edit.component.html` & `.ts`: `<label>Bio</label>`, `<label>Gender</label>`, Gender options (`<option value="male">Male</option>`, etc.)
- `frontend/src/app/components/moderation-queue/moderation-queue.component.html`: `<span>Profile</span>`
- `frontend/src/app/components/admin-actions/admin-actions.component.ts`: `<button>Ban</button>`, `<button>Warn</button>`
- `frontend/src/app/pages/vip-subscription/vip-subscription.component.html`: `<span>Popular</span>`
- `frontend/src/app/components/chat-list/chat-list.component.html`: `placeholder="Search"`
- `frontend/src/app/components/chat-room/chat-room.component.html`: `placeholder="New Group Name"`, `placeholder="User ID to Add"`, `placeholder="User ID to Remove"`
- `frontend/src/app/components/room-chat/room-chat.component.ts`: `placeholder="Send a chat message to the room..."`, `placeholder="Simulate speech-to-text live subtitle broadcast..."`
- `frontend/src/app/components/emoji-picker/emoji-picker.component.ts`: `placeholder="Search emoji..."`
- `frontend/src/app/components/trust-safety-modal/trust-safety-modal.component.ts`: `placeholder="Provide context or specific phrase where violation occurred..."`
- `frontend/src/app/components/chat-view/chat-view.component.ts`: `placeholder="Type a message..."`
- `frontend/src/app/components/correction-modal/correction-modal.component.html`: `placeholder="Edit sentence to correct grammar, spelling, or natural phrasing..."`, `placeholder="Explain grammar rule, nuance, or native alternative..."`
- `frontend/src/app/pages/chat/chat-page.component.ts`: `placeholder="Corrected text..."`, `placeholder="Explanation (optional)"`, `placeholder="Type a message..."`
- `frontend/src/app/pages/help-centre/help-centre.component.html`: `placeholder="Search…"`
- `frontend/src/app/ai-conversation/ai-conversation.component.ts`: `placeholder="Type your message..."`

Technical Implementation:
1. Wrap HTML text nodes in translation pipes: change `<span>Translation</span>` to `<span>{{ 'wordModal.translationLabel' | t }}</span>`.
2. Convert static `placeholder` attributes to Angular property bindings utilizing the translation pipe: change `placeholder="Search"` to `[placeholder]="'common.search' | t"`. For components using inline templates (e.g. `sticker-picker.component.ts`), make the same modifications inside the template string.
3. Ensure all newly introduced keys are properly appended to `frontend/src/assets/i18n/en.json`.
