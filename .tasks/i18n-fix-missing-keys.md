Priority: High Impact

Description:
Several translation keys are used in the codebase but missing from the baseline translation file `frontend/src/assets/i18n/en.json`, causing raw keys to be displayed to users. An audit of the codebase (`frontend/src/app`) identified numerous missing keys, for example: `admin.lessons.create`, `audioRoom.hostLabel`, `blockManagement.noBlockedUsers`, `doodle.title`, `events.createTitle`, `favourites.title`, `group.createSubtitle`, `visitors.subtitle`, `voiceRecorder.title`, `profile.visibility.everyone`, `admin.users.targetLanguages`, `common.close`, `common.coins`, `common.loading`, `gdpr.deleteSuccess`, `moderation.error`, `vocabulary.chipGrammar`, `voiceRecorder.startBtn`, `profile.visibility.vipsOnly`, `audioIntro.stop`, `audioRoom.host`, `auth.changePassword.backToSettings`, `backupRestore.selectRoom`, `call.hang_up`, `call_logs.empty`, `coverPhoto.cancel`, `notification_settings.saved_message`, `profile.catalogTitle`, `subscription.status`, `visitors.empty`, `vocabulary.chipPronunciation`, `profile.visibility.hidden`, `admin.lessons.cover_image`, `audio_recorder.discard`, `common.error_occurred`, `loading`, `moderation.analyse`, `moderation.noItems`, `moderation.riskScore`, `notification_preferences.do_not_disturb`, `onboarding.step2.label`, `videoRoom.waitingForHost`, and many more spanning across modules like `privacy`, `admin`, `chatRoom`, `discovery`, `moments`, `studyBuddy`, `voices`, and `vip`.

Technical Implementation:
Update the `frontend/src/assets/i18n/en.json` file. Ensure you add all the missing keys systematically. Follow the nested object structure defined by the key path, so a key like `admin.lessons.create` becomes:
```json
"admin": {
  "lessons": {
    "create": "Create Lesson"
  }
}
```
If flattened structure is preferred in this project (as `en.json` uses a mix of nested and flattened keys like `"visitors.subtitle": "value"`), conform to the predominant style in `en.json` (flattened format: `"admin.lessons.create": "Create Lesson"`). Avoid string concatenation in dynamic text and enforce translation interpolation (`{{ 'key' | t: { param: value } }}`).
