Priority: Low/Medium Impact

Description:
Various accessibility attributes across HTML templates and TypeScript components are hardcoded instead of utilizing the translation pipeline/service. This prevents screen readers from announcing correct localizations. The audit found about 58 instances of hardcoded `aria-label`, `alt`, or `title` attributes.

Files affected include:
- `frontend/src/app/app.component.html` (e.g. `alt="Gift Animation"`)
- `frontend/src/app/components/voiceroom-create-modal/voiceroom-create-modal.component.ts` (`aria-label="Close"`)
- `frontend/src/app/components/word-definition-modal/word-definition-modal.component.html` (`aria-label="Play audio"`, `title="Listen to pronunciation"`, `aria-label="Close"`)
- `frontend/src/app/components/chat-message/chat-message.component.ts` (`aria-label="Play voice message"`, `alt="Doodle"`)
- `frontend/src/app/components/chat-list/chat-list.component.html` (`aria-label="Open menu"`, `aria-label="Filter options"`)
- `frontend/src/app/components/settings/settings.component.html` (`aria-label="Select color"`, `aria-label="Remove interest"`)
- `frontend/src/app/components/lightbox/lightbox.component.ts` (`aria-label="Close"`, `alt="Moment media"`, `aria-label="Previous image"`, `aria-label="Next image"`)
- `frontend/src/app/components/profile/profile.component.html` (`alt="avatar"`, `aria-label="Remove language"`)
- `frontend/src/app/components/notifications-inbox/notifications-inbox.component.html` (`aria-label="Go back"`)
- ...and other instances in `liked-by-modal`, `language-picker`, `chip`, `incoming-call-modal`, `discovery`, `profile-edit`, `chat-room`, `voice-recorder`, `user-detail`, `vocabulary-display`, `moments-feed`, `cover-photo-uploader`, `correction-modal`, `favourites`, `group-participant-drawer`, `doodle-pad`, `image-lightbox`, `linked-accounts`, `chat-settings`, `help-centre`, and `legal` pages.

Technical Implementation:
1. In HTML templates: Replace hardcoded strings with translation bindings, for example changing `aria-label="Close"` to `[attr.aria-label]="'common.close' | t"`. For `alt` and `title`, use `[alt]="'common.avatar' | t"` and `[title]="'wordModal.listenTitle' | t"` respectively.
2. In TypeScript components: Utilize the `i18n.translate()` service call, e.g., `this.i18n.translate('common.close')`.
3. Add any new translation keys used for these accessibility attributes into `frontend/src/assets/i18n/en.json`.
