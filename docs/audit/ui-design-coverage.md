> hellotalk-workspace@1.0.0 report:ui-design-coverage
> node scripts/report-ui-design-coverage.mjs

# UI design coverage report

Generated: 2026-10-11T22:07:44.238Z

Specific coverage means the manifest names the surface (or a child path) rather than inheriting only a broad ancestor mapping such as `frontend/src/app`.

## Counts

| Metric                            | Count |
| --------------------------------- | ----: |
| routes                            |   112 |
| routeFiles                        |    10 |
| runtimeSurfaces                   |   188 |
| componentSurfaces                 |   165 |
| pageSurfaces                      |    23 |
| modalLikeSurfaces                 |    17 |
| spartanHelmComponents             |    12 |
| legacyPrimitiveComponents         |    20 |
| designSyncItems                   |    23 |
| previewHtmlFiles                  |    28 |
| specificallyMappedRuntimeSurfaces |    28 |
| unmappedRuntimeSurfaces           |   160 |
| broadOnlyRuntimeSurfaces          |   160 |
| untestedRuntimeSurfaces           |    43 |
| directBrainRuntimeSurfaces        |     0 |
| legacyDebtSurfaces                |    56 |
| unmappedPreviewPaths              |     3 |
| missingManifestRepositoryPaths    |     0 |
| missingManifestPreviewPaths       |     0 |

## Completion

| Metric                                | Percent |
| ------------------------------------- | ------: |
| specificallyDesignSyncMappedPercent   |    14.9 |
| testsPresentPercent                   |    77.1 |
| specificallyPreviewCoveredPercent     |    14.9 |
| specificallyClaudeDesignMappedPercent |    14.9 |

## Unmapped runtime surfaces

- `frontend/src/app/components/account-deletion`
- `frontend/src/app/components/active-call`
- `frontend/src/app/components/admin-actions`
- `frontend/src/app/components/admin-error-boundary`
- `frontend/src/app/components/admin-offline-banner`
- `frontend/src/app/components/admin-portal`
- `frontend/src/app/components/admin-user-actions`
- `frontend/src/app/components/age-range-slider`
- `frontend/src/app/components/app-language-selector`
- `frontend/src/app/components/approve-speaker-modal`
- `frontend/src/app/components/audio-intro-recorder`
- `frontend/src/app/components/audio-player`
- `frontend/src/app/components/audio-recorder`
- `frontend/src/app/components/audio-room`
- `frontend/src/app/components/audio-stage`
- `frontend/src/app/components/audio-sync-reader`
- `frontend/src/app/components/avatar-upload`
- `frontend/src/app/components/business-profile`
- `frontend/src/app/components/cart`
- `frontend/src/app/components/celebration-overlay`
- `frontend/src/app/components/change-password`
- `frontend/src/app/components/chat-backup`
- `frontend/src/app/components/chat-list`
- `frontend/src/app/components/chat-media-message`
- `frontend/src/app/components/chat-media-picker`
- `frontend/src/app/components/chat-media-share`
- `frontend/src/app/components/chat-message`
- `frontend/src/app/components/chat-search`
- `frontend/src/app/components/chat-system-bubble`
- `frontend/src/app/components/chat-view`
- `frontend/src/app/components/classrooms-marketplace`
- `frontend/src/app/components/coin-economy-dashboard`
- `frontend/src/app/components/coins-cancel`
- `frontend/src/app/components/coins-success`
- `frontend/src/app/components/confirm-dialog`
- `frontend/src/app/components/correction-modal`
- `frontend/src/app/components/cover-photo-cropper`
- `frontend/src/app/components/cover-photo-uploader`
- `frontend/src/app/components/create-group`
- `frontend/src/app/components/cultural-tip`
- `frontend/src/app/components/daily-learning-tip`
- `frontend/src/app/components/daily-login-modal`
- `frontend/src/app/components/desktop-sidebar`
- `frontend/src/app/components/developer-dashboard`
- `frontend/src/app/components/device-lock`
- `frontend/src/app/components/device-transfer`
- `frontend/src/app/components/diagnostic-quiz`
- `frontend/src/app/components/discovery-error-boundary`
- `frontend/src/app/components/distance-slider`
- `frontend/src/app/components/document-viewer`
- `frontend/src/app/components/doodle-pad`
- `frontend/src/app/components/earned-badges`
- `frontend/src/app/components/emoji-picker`
- `frontend/src/app/components/error-boundary`
- `frontend/src/app/components/escrow-payments`
- `frontend/src/app/components/events-calendar`
- `frontend/src/app/components/events-feed`
- `frontend/src/app/components/external-profile`
- `frontend/src/app/components/favourites`
- `frontend/src/app/components/flashcard-deck`
- `frontend/src/app/components/flashcard-review`
- `frontend/src/app/components/follow-list`
- `frontend/src/app/components/font-scale-slider`
- `frontend/src/app/components/forced-update-modal`
- `frontend/src/app/components/forgot-password`
- `frontend/src/app/components/gdpr`
- `frontend/src/app/components/gift-animation`
- `frontend/src/app/components/gift-animation-overlay`
- `frontend/src/app/components/gift-picker`
- `frontend/src/app/components/group-participant-drawer`
- `frontend/src/app/components/groups-discovery`
- `frontend/src/app/components/hobby-tags`
- `frontend/src/app/components/host-dashboard`
- `frontend/src/app/components/incoming-call`
- `frontend/src/app/components/incoming-call-modal`
- `frontend/src/app/components/instant-video-recorder`
- `frontend/src/app/components/language-parties`
- `frontend/src/app/components/language-questions`
- `frontend/src/app/components/language-selector`
- `frontend/src/app/components/leaderboard`
- `frontend/src/app/components/legal-document-viewer`
- `frontend/src/app/components/lesson-manager`
- `frontend/src/app/components/lightbox`
- `frontend/src/app/components/liked-by-modal`
- `frontend/src/app/components/link-preview-card`
- `frontend/src/app/components/live-chat-overlay`
- `frontend/src/app/components/long-press-context-menu`
- `frontend/src/app/components/media-attachments`
- `frontend/src/app/components/message-reaction-bar`
- `frontend/src/app/components/milestone`
- `frontend/src/app/components/moderation`
- `frontend/src/app/components/moment-translate`
- `frontend/src/app/components/moments-feed`
- `frontend/src/app/components/my-stats`
- `frontend/src/app/components/notification-customization`
- `frontend/src/app/components/notification-preferences`
- `frontend/src/app/components/notifications-inbox`
- `frontend/src/app/components/password-policy-reset`
- `frontend/src/app/components/private-party-create-modal`
- `frontend/src/app/components/proficiency-assessment`
- `frontend/src/app/components/profile-cover-photo`
- `frontend/src/app/components/profile-discovery-card`
- `frontend/src/app/components/profile-edit`
- `frontend/src/app/components/profile-interests`
- `frontend/src/app/components/profile-visitors`
- `frontend/src/app/components/pronunciation-feedback`
- `frontend/src/app/components/quests`
- `frontend/src/app/components/quick-replies`
- `frontend/src/app/components/read-receipt`
- `frontend/src/app/components/reading-engine`
- `frontend/src/app/components/reading-engine-error-boundary`
- `frontend/src/app/components/report-user-modal`
- `frontend/src/app/components/reset-password`
- `frontend/src/app/components/resource-library`
- `frontend/src/app/components/restore-purchases-button`
- `frontend/src/app/components/room-chat`
- `frontend/src/app/components/share-modal`
- `frontend/src/app/components/shop`
- `frontend/src/app/components/social-login-buttons`
- `frontend/src/app/components/soundboard`
- `frontend/src/app/components/split-screen-video`
- `frontend/src/app/components/srs-error-boundary`
- `frontend/src/app/components/srs-rtl-verification`
- `frontend/src/app/components/srs-tour-trigger`
- `frontend/src/app/components/sticker-picker`
- `frontend/src/app/components/sticker-store`
- `frontend/src/app/components/streak-celebration-overlay`
- `frontend/src/app/components/streak-congratulations`
- `frontend/src/app/components/streak-counter`
- `frontend/src/app/components/study-buddy`
- `frontend/src/app/components/study-streak-counter`
- `frontend/src/app/components/study-streak-widget`
- `frontend/src/app/components/subscription-cancel`
- `frontend/src/app/components/subscription-plans`
- `frontend/src/app/components/subscription-success`
- `frontend/src/app/components/suggest-flashcards`
- `frontend/src/app/components/text-to-speech`
- `frontend/src/app/components/theme-selector`
- `frontend/src/app/components/tip-host-modal`
- `frontend/src/app/components/tokenised-text`
- `frontend/src/app/components/topic-following`
- `frontend/src/app/components/trust-safety-modal`
- `frontend/src/app/components/user-detail`
- `frontend/src/app/components/version-check`
- `frontend/src/app/components/video-call`
- `frontend/src/app/components/video-classroom-error-boundary`
- `frontend/src/app/components/video-room`
- `frontend/src/app/components/virtual-gift-modal`
- `frontend/src/app/components/visitor-logs`
- `frontend/src/app/components/visual-diff`
- `frontend/src/app/components/vocabulary-dashboard`
- `frontend/src/app/components/vocabulary-display`
- `frontend/src/app/components/voice-recorder`
- `frontend/src/app/components/voiceroom-create-modal`
- `frontend/src/app/components/voiceroom-notes`
- `frontend/src/app/components/voip-active-call`
- `frontend/src/app/components/voip-call`
- `frontend/src/app/components/word-definition-modal`
- `frontend/src/app/components/word-of-the-day`
- `frontend/src/app/pages/language-islands`

## Broad-only inherited mappings

- `{"path":"frontend/src/app/components/account-deletion","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/active-call","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/admin-actions","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/admin-error-boundary","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/admin-offline-banner","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/admin-portal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/admin-user-actions","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/age-range-slider","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/app-language-selector","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/approve-speaker-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/audio-intro-recorder","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/audio-player","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/audio-recorder","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/audio-room","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/audio-stage","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/audio-sync-reader","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/avatar-upload","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/business-profile","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/cart","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/celebration-overlay","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/change-password","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-backup","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-list","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-media-message","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-media-picker","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-media-share","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-message","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-search","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-system-bubble","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/chat-view","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/classrooms-marketplace","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/coin-economy-dashboard","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/coins-cancel","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/coins-success","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/confirm-dialog","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/correction-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/cover-photo-cropper","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/cover-photo-uploader","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/create-group","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/cultural-tip","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/daily-learning-tip","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/daily-login-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/desktop-sidebar","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/developer-dashboard","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/device-lock","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/device-transfer","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/diagnostic-quiz","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/discovery-error-boundary","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/distance-slider","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/document-viewer","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/doodle-pad","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/earned-badges","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/emoji-picker","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/error-boundary","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/escrow-payments","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/events-calendar","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/events-feed","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/external-profile","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/favourites","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/flashcard-deck","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/flashcard-review","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/follow-list","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/font-scale-slider","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/forced-update-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/forgot-password","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/gdpr","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/gift-animation","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/gift-animation-overlay","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/gift-picker","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/group-participant-drawer","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/groups-discovery","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/hobby-tags","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/host-dashboard","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/incoming-call","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/incoming-call-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/instant-video-recorder","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/language-parties","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/language-questions","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/language-selector","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/leaderboard","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/legal-document-viewer","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/lesson-manager","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/lightbox","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/liked-by-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/link-preview-card","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/live-chat-overlay","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/long-press-context-menu","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/media-attachments","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/message-reaction-bar","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/milestone","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/moderation","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/moment-translate","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/moments-feed","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/my-stats","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/notification-customization","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/notification-preferences","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/notifications-inbox","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/password-policy-reset","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/private-party-create-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/proficiency-assessment","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/profile-cover-photo","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/profile-discovery-card","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/profile-edit","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/profile-interests","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/profile-visitors","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/pronunciation-feedback","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/quests","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/quick-replies","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/read-receipt","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/reading-engine","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/reading-engine-error-boundary","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/report-user-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/reset-password","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/resource-library","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/restore-purchases-button","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/room-chat","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/share-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/shop","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/social-login-buttons","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/soundboard","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/split-screen-video","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/srs-error-boundary","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/srs-rtl-verification","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/srs-tour-trigger","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/sticker-picker","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/sticker-store","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/streak-celebration-overlay","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/streak-congratulations","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/streak-counter","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/study-buddy","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/study-streak-counter","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/study-streak-widget","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/subscription-cancel","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/subscription-plans","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/subscription-success","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/suggest-flashcards","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/text-to-speech","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/theme-selector","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/tip-host-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/tokenised-text","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/topic-following","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/trust-safety-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/user-detail","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/version-check","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/video-call","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/video-classroom-error-boundary","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/video-room","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/virtual-gift-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/visitor-logs","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/visual-diff","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/vocabulary-dashboard","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/vocabulary-display","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/voice-recorder","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/voiceroom-create-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/voiceroom-notes","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/voip-active-call","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/voip-call","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/word-definition-modal","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/components/word-of-the-day","inheritedDesignSyncIds":["spartan.component-system","screen.shell"]}`
- `{"path":"frontend/src/app/pages/language-islands","inheritedDesignSyncIds":["screen.shell"]}`

## Runtime surfaces without colocated tests

- `frontend/src/app/components/account-deletion`
- `frontend/src/app/components/admin-actions`
- `frontend/src/app/components/admin-portal`
- `frontend/src/app/components/admin-user-actions`
- `frontend/src/app/components/age-range-slider`
- `frontend/src/app/components/audio-recorder`
- `frontend/src/app/components/celebration-overlay`
- `frontend/src/app/components/chat-backup`
- `frontend/src/app/components/chat-media-share`
- `frontend/src/app/components/chat-view`
- `frontend/src/app/components/external-profile`
- `frontend/src/app/components/flashcard-deck`
- `frontend/src/app/components/hobby-tags`
- `frontend/src/app/components/language-questions`
- `frontend/src/app/components/lesson-manager`
- `frontend/src/app/components/moment-translate`
- `frontend/src/app/components/notification-customization`
- `frontend/src/app/components/onboarding`
- `frontend/src/app/components/proficiency-assessment`
- `frontend/src/app/components/profile-edit`
- `frontend/src/app/components/profile-interests`
- `frontend/src/app/components/profile-visitors`
- `frontend/src/app/components/quick-replies`
- `frontend/src/app/components/read-receipt`
- `frontend/src/app/components/resource-library`
- `frontend/src/app/components/room-chat`
- `frontend/src/app/components/social-login-buttons`
- `frontend/src/app/components/srs-tour-trigger`
- `frontend/src/app/components/sticker-picker`
- `frontend/src/app/components/streak-celebration-overlay`
- `frontend/src/app/components/study-streak-counter`
- `frontend/src/app/components/subscription-cancel`
- `frontend/src/app/components/subscription-plans`
- `frontend/src/app/components/subscription-success`
- `frontend/src/app/components/version-check`
- `frontend/src/app/components/voip-active-call`
- `frontend/src/app/components/word-of-the-day`
- `frontend/src/app/pages/help-centre`
- `frontend/src/app/pages/join-group`
- `frontend/src/app/pages/language-islands`
- `frontend/src/app/pages/subscription`
- `frontend/src/app/pages/support-centre`
- `frontend/src/app/pages/vip-subscription`

## Direct Brain usage outside owned Helm

- None

## Legacy primitive debt surfaces

- `{"path":"frontend/src/app/components/admin-portal","mentions":15}`
- `{"path":"frontend/src/app/components/audio-player","mentions":1}`
- `{"path":"frontend/src/app/components/audio-room","mentions":43}`
- `{"path":"frontend/src/app/components/audio-sync-reader","mentions":4}`
- `{"path":"frontend/src/app/components/avatar-upload","mentions":4}`
- `{"path":"frontend/src/app/components/celebration-overlay","mentions":2}`
- `{"path":"frontend/src/app/components/chat-backup","mentions":4}`
- `{"path":"frontend/src/app/components/chat-list","mentions":4}`
- `{"path":"frontend/src/app/components/chat-media-picker","mentions":6}`
- `{"path":"frontend/src/app/components/chat-media-share","mentions":8}`
- `{"path":"frontend/src/app/components/chat-room","mentions":35}`
- `{"path":"frontend/src/app/components/classrooms-marketplace","mentions":2}`
- `{"path":"frontend/src/app/components/coin-economy-dashboard","mentions":14}`
- `{"path":"frontend/src/app/components/daily-learning-tip","mentions":8}`
- `{"path":"frontend/src/app/components/developer-dashboard","mentions":42}`
- `{"path":"frontend/src/app/components/discovery","mentions":10}`
- `{"path":"frontend/src/app/components/document-viewer","mentions":8}`
- `{"path":"frontend/src/app/components/doodle-pad","mentions":8}`
- `{"path":"frontend/src/app/components/earned-badges","mentions":6}`
- `{"path":"frontend/src/app/components/events-calendar","mentions":3}`
- `{"path":"frontend/src/app/components/favourites","mentions":10}`
- `{"path":"frontend/src/app/components/flashcard-deck","mentions":29}`
- `{"path":"frontend/src/app/components/flashcard-review","mentions":9}`
- `{"path":"frontend/src/app/components/hobby-tags","mentions":8}`
- `{"path":"frontend/src/app/components/host-dashboard","mentions":2}`
- `{"path":"frontend/src/app/components/incoming-call","mentions":4}`
- `{"path":"frontend/src/app/components/instant-video-recorder","mentions":10}`
- `{"path":"frontend/src/app/components/language-parties","mentions":1}`
- `{"path":"frontend/src/app/components/leaderboard","mentions":4}`
- `{"path":"frontend/src/app/components/moderation","mentions":4}`
- `{"path":"frontend/src/app/components/moments-feed","mentions":4}`
- `{"path":"frontend/src/app/components/onboarding","mentions":4}`
- `{"path":"frontend/src/app/components/profile","mentions":59}`
- `{"path":"frontend/src/app/components/reading-engine","mentions":30}`
- `{"path":"frontend/src/app/components/reading-engine-error-boundary","mentions":2}`
- `{"path":"frontend/src/app/components/restore-purchases-button","mentions":3}`
- `{"path":"frontend/src/app/components/settings","mentions":2}`
- `{"path":"frontend/src/app/components/split-screen-video","mentions":1}`
- `{"path":"frontend/src/app/components/srs-error-boundary","mentions":2}`
- `{"path":"frontend/src/app/components/srs-tour-trigger","mentions":2}`
- `{"path":"frontend/src/app/components/sticker-store","mentions":9}`
- `{"path":"frontend/src/app/components/subscription-plans","mentions":4}`
- `{"path":"frontend/src/app/components/suggest-flashcards","mentions":5}`
- `{"path":"frontend/src/app/components/video-call","mentions":8}`
- `{"path":"frontend/src/app/components/video-classroom-error-boundary","mentions":2}`
- `{"path":"frontend/src/app/components/vocabulary-display","mentions":3}`
- `{"path":"frontend/src/app/components/voice-recorder","mentions":8}`
- `{"path":"frontend/src/app/pages/admin","mentions":9}`
- `{"path":"frontend/src/app/pages/block-management","mentions":4}`
- `{"path":"frontend/src/app/pages/escrow","mentions":18}`
- `{"path":"frontend/src/app/pages/escrow-detail","mentions":17}`
- `{"path":"frontend/src/app/pages/my-subscription","mentions":21}`
- `{"path":"frontend/src/app/pages/settings","mentions":10}`
- `{"path":"frontend/src/app/pages/subscription","mentions":7}`
- `{"path":"frontend/src/app/pages/vip","mentions":17}`
- `{"path":"frontend/src/app/pages/vip-subscription","mentions":8}`

## Unmapped design-preview files

- `frontend/design-preview/components/correction-modal.html`
- `frontend/design-preview/components/daily-learning-tip.html`
- `frontend/design-preview/components/doodle-pad.html`

## Invalid manifest paths

### Repository

- None

### Preview

- None
