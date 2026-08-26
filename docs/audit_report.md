# API Contract Mapping

## Missing Backend Routes (Drift)

- **GET** ``${environment.apiUrl}/achievements/full/${params.userId}`` -> `{param}/achievements/full/{param}` in `achievements/achievements.component.ts` (expects `FullAchievementDto[]`)
- **GET** ``${environment.apiUrl}/interests?language=${params.language}`` -> `{param}/interests?language={param}` in `interests-select/interests-select.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/interests/select`` -> `{param}/interests/select` in `interests-select/interests-select.component.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/two-factor/enable`` -> `{param}/two-factor/enable` in `services/2fa.service.ts` (expects `{ secret: string; qrCodeUrl: string }`)
- **POST** ``${this.apiUrl}/two-factor/verify`` -> `{param}/two-factor/verify` in `services/2fa.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/two-factor/disable`` -> `{param}/two-factor/disable` in `services/2fa.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/two-factor/status`` -> `{param}/two-factor/status` in `services/2fa.service.ts` (expects `{ enabled: boolean }`)
- **GET** ``${this.baseUrl}/users`` -> `{param}/users` in `services/admin.service.ts` (expects `AdminUserListResult`)
- **GET** ``${this.baseUrl}/users`` -> `{param}/users` in `services/admin.service.ts` (expects `AdminUserListResult`)
- **PATCH** ``${this.baseUrl}/users/${userId}/vip`` -> `{param}/users/{param}/vip` in `services/admin.service.ts` (expects `AdminUserSummary`)
- **GET** ``${this.baseUrl}/users/${userId}/login-history`` -> `{param}/users/{param}/login-history` in `services/admin.service.ts` (expects `LoginHistoryEntry[]`)
- **POST** ``${this.baseUrl}/users/${userId}/ban`` -> `{param}/users/{param}/ban` in `services/admin.service.ts` (expects `{ message: string }`)
- **POST** ``${this.baseUrl}/users/${userId}/warn`` -> `{param}/users/{param}/warn` in `services/admin.service.ts` (expects `{ message: string }`)
- **GET** ``${this.baseUrl}/blocks`` -> `{param}/blocks` in `services/admin.service.ts` (expects `AdminBlocksListResult`)
- **DELETE** ``${this.baseUrl}/blocks/${blockId}`` -> `{param}/blocks/{param}` in `services/admin.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.baseUrl}/scenarios`` -> `{param}/scenarios` in `services/ai-conversation.service.ts` (expects `Scenario[]`)
- **POST** ``${this.baseUrl}/message`` -> `{param}/message` in `services/ai-conversation.service.ts` (expects `{ reply: string }`)
- **POST** ``${this.baseUrl}/presigned-upload`` -> `{param}/presigned-upload` in `services/audio-intro.service.ts` (expects `PresignedUploadResponse`)
- **PATCH** ``${this.baseUrl}/${userId}`` -> `{param}/{param}` in `services/audio-intro.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/${userId}`` -> `{param}/{param}` in `services/audio-intro.service.ts` (expects `AudioIntroResponse`)
- **GET** ``${this.baseUrl}/health`` -> `{param}/health` in `services/audio-room-degradation.service.ts` (expects `DegradationState`)
- **GET** ``${this.baseUrl}/list`` -> `{param}/list` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord[]`)
- **GET** ``${this.baseUrl}/by-language`` -> `{param}/by-language` in `services/audio-rooms.store.ts` (expects `Array<{ language_pair: string; count: number; rooms: AudioRoomRecord[] }>`)
- **POST** ``${this.baseUrl}/create`` -> `{param}/create` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/private`` -> `{param}/private` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **GET** ``${this.baseUrl}/private`` -> `{param}/private` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord[]`)
- **POST** ``${this.baseUrl}/token`` -> `{param}/token` in `services/audio-rooms.store.ts` (expects `{
          token: string;
          room_id: string;
          room_name: string;
          livekit_url: string;
          is_speaker: boolean;
        }`)
- **POST** ``${this.baseUrl}/raise-hand`` -> `{param}/raise-hand` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/approve-speaker`` -> `{param}/approve-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/demote-speaker`` -> `{param}/demote-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/dismiss-raised-hand`` -> `{param}/dismiss-raised-hand` in `services/audio-rooms.store.ts` (expects `void`)
- **POST** ``${this.baseUrl}/mute-speaker`` -> `{param}/mute-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/unmute-speaker`` -> `{param}/unmute-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/kick-speaker`` -> `{param}/kick-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/invite-co-host`` -> `{param}/invite-co-host` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/remove-co-host`` -> `{param}/remove-co-host` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/captions`` -> `{param}/captions` in `services/audio-rooms.store.ts` (expects `CaptionRecord`)
- **POST** ``${this.baseUrl}/ai-captions`` -> `{param}/ai-captions` in `services/audio-rooms.store.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${roomId}/tip`` -> `{param}/{param}/tip` in `services/audio-rooms.store.ts` (expects `{
          tip_id: string;
          amount_coins: number;
          receiver_id: string;
          receiver_new_balance: number;
        }`)
- **POST** ``${this.baseUrl}/archive`` -> `{param}/archive` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **GET** ``${this.baseUrl}/${roomId}/stage`` -> `{param}/{param}/stage` in `services/audio-rooms.store.ts` (expects `StageInfo`)
- **POST** ``${this.apiUrl}/auth/two-factor/enable`` -> `{param}/auth/two-factor/enable` in `services/auth.service.ts` (expects `{ secret: string; qrCodeUrl: string }`)
- **POST** ``${this.apiUrl}/auth/two-factor/verify`` -> `{param}/auth/two-factor/verify` in `services/auth.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/auth/two-factor/disable`` -> `{param}/auth/two-factor/disable` in `services/auth.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/auth/two-factor/status`` -> `{param}/auth/two-factor/status` in `services/auth.service.ts` (expects `{ enabled: boolean }`)
- **POST** ``${this.apiUrl}/auth/transfer/generate`` -> `{param}/auth/transfer/generate` in `services/auth.service.ts` (expects `{ url: string }`)
- **POST** ``${this.apiUrl}/auth/transfer/consume`` -> `{param}/auth/transfer/consume` in `services/auth.service.ts` (expects `{ swapToken: string }`)
- **POST** ``${this.apiUrl}/auth/transfer/swap`` -> `{param}/auth/transfer/swap` in `services/auth.service.ts` (expects `{
          access_token: string;
          refresh_token: string;
          user_id: string;
        }`)
- **POST** ``${this.apiUrl}/auth/request-password-reset`` -> `{param}/auth/request-password-reset` in `services/auth.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/auth/reset-password`` -> `{param}/auth/reset-password` in `services/auth.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/auth/change-password`` -> `{param}/auth/change-password` in `services/auth.service.ts` (expects `Unknown`)
- **DELETE** ``${this.apiUrl}/${blockedId}`` -> `{param}/{param}` in `services/block.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/blocks`` -> `{param}/blocks` in `services/blocked-users.service.ts` (expects `BlockedUserResponse[]`)
- **DELETE** ``${this.apiUrl}/blocks/${userId}`` -> `{param}/blocks/{param}` in `services/blocked-users.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/call-logs`` -> `{param}/call-logs` in `services/call-logs.service.ts` (expects `CallLogRecord[]`)
- **POST** ``${environment.apiUrl}/chat/token`` -> `{param}/chat/token` in `services/centrifuge.service.ts` (expects `{ token: string }`)
- **GET** ``${this.baseUrl}/labels`` -> `{param}/labels` in `services/chat.service.ts` (expects `string[]`)
- **POST** ``${this.baseUrl}/labels`` -> `{param}/labels` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/labels/${encodeURIComponent(label)}`` -> `{param}/labels/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/labels`` -> `{param}/rooms/{param}/labels` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/rooms/${roomId}/labels/${encodeURIComponent(label)}`` -> `{param}/rooms/{param}/labels/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/chat/messages/${messageId}/receipts`` -> `{param}/chat/messages/{param}/receipts` in `services/chat.service.ts` (expects `MessageReceiptStatus`)
- **GET** ``${this.baseUrl}/rooms/${payload.room_id}/members`` -> `{param}/rooms/{param}/members` in `services/chat.service.ts` (expects `{ user_id: string }[]`)
- **POST** ``${this.baseUrl}/messages`` -> `{param}/messages` in `services/chat.service.ts` (expects `ChatMessage`)
- **POST** ``${this.baseUrl}/messages`` -> `{param}/messages` in `services/chat.service.ts` (expects `ChatMessage`)
- **GET** ``${this.baseUrl}/messages/${roomId}`` -> `{param}/messages/{param}` in `services/chat.service.ts` (expects `ChatMessage[]`)
- **GET** ``${this.baseUrl}/rooms`` -> `{param}/rooms` in `services/chat.service.ts` (expects `ChatRoom[]`)
- **POST** ``${this.baseUrl}/messages/status-reply`` -> `{param}/messages/status-reply` in `services/chat.service.ts` (expects `ChatMessage`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/lock`` -> `{param}/rooms/{param}/lock` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/unlock`` -> `{param}/rooms/{param}/unlock` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/locked-rooms`` -> `{param}/locked-rooms` in `services/chat.service.ts` (expects `string[]`)
- **POST** ``${this.baseUrl}/favourites`` -> `{param}/favourites` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/search`` -> `{param}/search` in `services/chat.service.ts` (expects `ChatMessage[]`)
- **GET** ``${this.baseUrl}/favourites`` -> `{param}/favourites` in `services/chat.service.ts` (expects `FavouriteRecord[]`)
- **DELETE** ``${this.baseUrl}/favourites/${favouriteId}`` -> `{param}/favourites/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/safety/is-blocked/${userId}`` -> `{param}/safety/is-blocked/{param}` in `services/chat.service.ts` (expects `{ blocked: boolean }`)
- **POST** ``${this.baseUrl}/messages/${messageId}/correct`` -> `{param}/messages/{param}/correct` in `services/chat.service.ts` (expects `ChatMessage`)
- **PATCH** ``${this.baseUrl}/messages/${messageId}/fix`` -> `{param}/messages/{param}/fix` in `services/chat.service.ts` (expects `ChatMessage`)
- **POST** ``${this.baseUrl}/groups`` -> `{param}/groups` in `services/chat.service.ts` (expects `ChatRoom`)
- **PATCH** ``${this.baseUrl}/groups/${roomId}/rename`` -> `{param}/groups/{param}/rename` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/groups/${roomId}/members`` -> `{param}/groups/{param}/members` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/groups/${roomId}/members/${memberId}`` -> `{param}/groups/{param}/members/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/groups/${roomId}/members`` -> `{param}/groups/{param}/members` in `services/chat.service.ts` (expects `GroupMember[]`)
- **GET** ``${this.baseUrl}/rooms/${roomId}/members`` -> `{param}/rooms/{param}/members` in `services/chat.service.ts` (expects `{ user_id: string; display_name?: string; avatar_url?: string | null }[]`)
- **POST** ``${environment.apiUrl}/nlp/translate`` -> `{param}/nlp/translate` in `services/chat.service.ts` (expects `{ translated_text: string }`)
- **POST** ``${environment.apiUrl}/nlp/transcribe-voice`` -> `{param}/nlp/transcribe-voice` in `services/chat.service.ts` (expects `{ original_text: string; detected_language: string; confidence: number }`)
- **POST** ``${this.baseUrl}/suggested-replies`` -> `{param}/suggested-replies` in `services/chat.service.ts` (expects `{ suggestions: string[] }`)
- **POST** ``${this.baseUrl}/conversation-starters`` -> `{param}/conversation-starters` in `services/chat.service.ts` (expects `{ suggestions: string[] }`)
- **POST** ``${environment.apiUrl}/chat/translate-voiceroom`` -> `{param}/chat/translate-voiceroom` in `services/chat.service.ts` (expects `{ translated_text: string; detected_language: string }`)
- **GET** ``${this.baseUrl}/rooms/${roomId}/export`` -> `{param}/rooms/{param}/export` in `services/chat.service.ts` (expects `ChatMessage[]`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/wallpaper`` -> `{param}/rooms/{param}/wallpaper` in `services/chat.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/rooms/${roomId}/wallpaper`` -> `{param}/rooms/{param}/wallpaper` in `services/chat.service.ts` (expects `{ wallpaperUrl: string | null }`)
- **POST** ``${this.baseUrl}/typing`` -> `{param}/typing` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/messages/${messageId}`` -> `{param}/messages/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/messages/${messageId}/forward`` -> `{param}/messages/{param}/forward` in `services/chat.service.ts` (expects `Unknown`)
- **PATCH** ``${this.baseUrl}/messages/${messageId}/status`` -> `{param}/messages/{param}/status` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/${communityId}`` -> `{param}/{param}` in `services/communities.service.ts` (expects `Community`)
- **PATCH** ``${this.apiUrl}/${communityId}`` -> `{param}/{param}` in `services/communities.service.ts` (expects `{ success: boolean }`)
- **DELETE** ``${this.apiUrl}/${communityId}`` -> `{param}/{param}` in `services/communities.service.ts` (expects `void`)
- **POST** ``${this.apiUrl}/${communityId}/groups`` -> `{param}/{param}/groups` in `services/communities.service.ts` (expects `{ success: boolean }`)
- **DELETE** ``${this.apiUrl}/${communityId}/groups/${groupId}`` -> `{param}/{param}/groups/{param}` in `services/communities.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/${communityId}/groups`` -> `{param}/{param}/groups` in `services/communities.service.ts` (expects `CommunityGroup[]`)
- **GET** ``${this.apiUrl}/${language}`` -> `{param}/{param}` in `services/cultural-guide.service.ts` (expects `CulturalGuideResponse`)
- **GET** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/deck.service.ts` (expects `Deck`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/deck.service.ts` (expects `Deck`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/deck.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${deckId}/flashcards`` -> `{param}/{param}/flashcards` in `services/deck.service.ts` (expects `void`)
- **DELETE** ``${this.baseUrl}/${deckId}/flashcards/${flashcardId}`` -> `{param}/{param}/flashcards/{param}` in `services/deck.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/${deckId}/flashcards`` -> `{param}/{param}/flashcards` in `services/deck.service.ts` (expects `{ id: string }[]`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `{param}/analytics/client-error` in `services/discovery-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/partner-of-week`` -> `{param}/partner-of-week` in `services/discovery.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/partners`` -> `{param}/partners` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/search-by-location`` -> `{param}/search-by-location` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/audio-intros`` -> `{param}/audio-intros` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/recent-native-speakers`` -> `{param}/recent-native-speakers` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/spotlight`` -> `{param}/spotlight` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/language-pair`` -> `{param}/language-pair` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **POST** ``${environment.apiUrl}/nlp/translate-bio`` -> `{param}/nlp/translate-bio` in `services/discovery.service.ts` (expects `{ translated_text: string }`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `{param}/analytics/client-error` in `services/economy-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/catalog`` -> `{param}/catalog` in `services/economy.store.ts` (expects `VirtualGift[]`)
- **GET** ``${this.baseUrl}/balance`` -> `{param}/balance` in `services/economy.store.ts` (expects `{ coins_balance: number }`)
- **GET** ``${this.safetyUrl}/blocked-ids`` -> `{param}/blocked-ids` in `services/economy.store.ts` (expects `string[]`)
- **POST** ``${this.baseUrl}/daily-check-in`` -> `{param}/daily-check-in` in `services/economy.store.ts` (expects `{ claimed: boolean; coins_rewarded: number; new_balance: number }`)
- **GET** ``${this.baseUrl}/packages`` -> `{param}/packages` in `services/economy.store.ts` (expects `CoinPackage[]`)
- **GET** ``${this.baseUrl}/health`` -> `{param}/health` in `services/economy.store.ts` (expects `{
          overall: 'healthy' | 'degraded' | 'unavailable';
          degradedFeatures: string[];
        }`)
- **POST** ``${this.baseUrl}/create-checkout-session`` -> `{param}/create-checkout-session` in `services/economy.store.ts` (expects `{ sessionUrl: string; sessionId: string }`)
- **POST** ``${this.baseUrl}/purchase-coins`` -> `{param}/purchase-coins` in `services/economy.store.ts` (expects `{ coins: number; newBalance: number }`)
- **POST** ``${this.baseUrl}/send-gift`` -> `{param}/send-gift` in `services/economy.store.ts` (expects `{ success: boolean; coins_remaining: number; gift: VirtualGift }`)
- **POST** ``${this.monetisationUrl}/create-checkout-session`` -> `{param}/create-checkout-session` in `services/economy.store.ts` (expects `{ sessionUrl: string; sessionId: string }`)
- **GET** ``${this.monetisationUrl}/analytics`` -> `{param}/analytics` in `services/economy.store.ts` (expects `DeveloperAnalytics`)
- **GET** ``${this.monetisationUrl}/diagnostics/logs`` -> `{param}/diagnostics/logs` in `services/economy.store.ts` (expects `DiagnosticLogApiRecord[]`)
- **POST** ``${this.monetisationUrl}/diagnostics/logs`` -> `{param}/diagnostics/logs` in `services/economy.store.ts` (expects `DiagnosticLogApiRecord`)
- **POST** ``${this.monetisationUrl}/generate-api-key`` -> `{param}/generate-api-key` in `services/economy.store.ts` (expects `{ api_key: string; tier: string; rate_limit_rpm: number }`)
- **GET** ``${this.baseUrl}/transactions`` -> `{param}/transactions` in `services/economy.store.ts` (expects `{ transactions: TransactionRecord[] }`)
- **GET** ``${this.baseUrl}/sticker-packs`` -> `{param}/sticker-packs` in `services/economy.store.ts` (expects `{
          packs: StickerPack[];
          owned_pack_ids: string[];
          user_coins: number;
        }`)
- **POST** ``${this.baseUrl}/unlock-sticker-pack`` -> `{param}/unlock-sticker-pack` in `services/economy.store.ts` (expects `{
          success: boolean;
          coins_remaining: number;
          pack: StickerPack;
        }`)
- **POST** ``${this.baseUrl}/create`` -> `{param}/create` in `services/escrow.service.ts` (expects `EscrowCreateResult`)
- **POST** ``${this.baseUrl}/release`` -> `{param}/release` in `services/escrow.service.ts` (expects `EscrowReleaseResult`)
- **POST** ``${this.baseUrl}/refund`` -> `{param}/refund` in `services/escrow.service.ts` (expects `EscrowRefundResult`)
- **POST** ``${this.baseUrl}/dispute`` -> `{param}/dispute` in `services/escrow.service.ts` (expects `EscrowRow`)
- **GET** ``${this.baseUrl}/${escrowId}`` -> `{param}/{param}` in `services/escrow.service.ts` (expects `EscrowRow`)
- **GET** ``${environment.apiUrl}/events`` -> `{param}/events` in `services/events.service.ts` (expects `Event[]`)
- **POST** ``${environment.apiUrl}/group-chats`` -> `{param}/group-chats` in `services/events.service.ts` (expects `{ id: string }`)
- **GET** ``${environment.apiUrl}/group-chats/${chatId}`` -> `{param}/group-chats/{param}` in `services/events.service.ts` (expects `{ id: string; name: string; description?: string; members: string[] }`)
- **PATCH** ``${environment.apiUrl}/group-chats/${chatId}`` -> `{param}/group-chats/{param}` in `services/events.service.ts` (expects `void`)
- **DELETE** ``${environment.apiUrl}/group-chats/${chatId}`` -> `{param}/group-chats/{param}` in `services/events.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/chats/${chatId}/labels`` -> `{param}/chats/{param}/labels` in `services/events.service.ts` (expects `void`)
- **DELETE** ``${environment.apiUrl}/chats/${chatId}/labels/${label}`` -> `{param}/chats/{param}/labels/{param}` in `services/events.service.ts` (expects `void`)
- **GET** ``${environment.apiUrl}/events/${eventId}`` -> `{param}/events/{param}` in `services/events.service.ts` (expects `Event`)
- **POST** ``${environment.apiUrl}/events`` -> `{param}/events` in `services/events.service.ts` (expects `Event`)
- **POST** ``${environment.apiUrl}/users/me/contact-sharing`` -> `{param}/users/me/contact-sharing` in `services/events.service.ts` (expects `{ phone_number?: string; email?: string }`)
- **GET** ``${environment.apiUrl}/events/my`` -> `{param}/events/my` in `services/events.service.ts` (expects `Event[]`)
- **GET** ``${environment.apiUrl}/events/${eventId}/rsvp`` -> `{param}/events/{param}/rsvp` in `services/events.service.ts` (expects `{ id?: string; event_id: string; user_id: string; status: string } | null`)
- **POST** ``${environment.apiUrl}/events/${eventId}/rsvp`` -> `{param}/events/{param}/rsvp` in `services/events.service.ts` (expects `{ id: string; event_id: string; user_id: string; status: string }`)
- **DELETE** ``${environment.apiUrl}/events/${eventId}/rsvp`` -> `{param}/events/{param}/rsvp` in `services/events.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/faqs`` -> `{param}/faqs` in `services/faq.service.ts` (expects `FAQ[]`)
- **POST** ``${this.baseUrl}/favourites`` -> `{param}/favourites` in `services/favourite.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/favourites/${favouriteId}`` -> `{param}/favourites/{param}` in `services/favourite.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/favourites`` -> `{param}/favourites` in `services/favourite.service.ts` (expects `FavouriteRecord[]`)
- **GET** ``${this.baseUrl}`` -> `{param}` in `services/feed.service.ts` (expects `Moment[]`)
- **GET** ``${this.baseUrl}/${momentId}`` -> `{param}/{param}` in `services/feed.service.ts` (expects `Moment`)
- **POST** ``${this.baseUrl}`` -> `{param}` in `services/feed.service.ts` (expects `Moment`)
- **DELETE** ``${this.baseUrl}/${momentId}`` -> `{param}/{param}` in `services/feed.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/${momentId}/like`` -> `{param}/{param}/like` in `services/feed.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/${momentId}/like`` -> `{param}/{param}/like` in `services/feed.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/${momentId}/comments`` -> `{param}/{param}/comments` in `services/feed.service.ts` (expects `unknown[]`)
- **POST** ``${this.baseUrl}/${momentId}/comments`` -> `{param}/{param}/comments` in `services/feed.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/health`` -> `{param}/health` in `services/flashcard.service.ts` (expects `SrsHealthStatus`)
- **PATCH** ``${this.baseUrl}/${flashcardId}/srs`` -> `{param}/{param}/srs` in `services/flashcard.service.ts` (expects `Flashcard`)
- **GET** ``${this.baseUrl}/due`` -> `{param}/due` in `services/flashcard.service.ts` (expects `Flashcard[]`)
- **PATCH** ``${this.baseUrl}/${item.flashcardId}/srs`` -> `{param}/{param}/srs` in `services/flashcard.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/${groupId}/restrict-send-messages`` -> `{param}/{param}/restrict-send-messages` in `services/groups.service.ts` (expects `void`)
- **POST** ``${this.apiUrl}/${groupId}/restrict-edit-info`` -> `{param}/{param}/restrict-edit-info` in `services/groups.service.ts` (expects `void`)
- **PUT** ``${this.apiUrl}/${groupId}/rename`` -> `{param}/{param}/rename` in `services/groups.service.ts` (expects `ChatGroup`)
- **GET** ``${this.apiUrl}/mine`` -> `{param}/mine` in `services/groups.service.ts` (expects `ChatGroup[]`)
- **POST** ``${this.apiUrl}/${groupId}/add-member`` -> `{param}/{param}/add-member` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/${groupId}/remove-member`` -> `{param}/{param}/remove-member` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/${roomId}/invite-code`` -> `{param}/{param}/invite-code` in `services/groups.service.ts` (expects `{ code: string }`)
- **GET** ``${this.apiUrl}/${roomId}/invite-link`` -> `{param}/{param}/invite-link` in `services/groups.service.ts` (expects `{ code: string; url: string }`)
- **GET** ``${this.apiUrl}/invite-info/${code}`` -> `{param}/invite-info/{param}` in `services/groups.service.ts` (expects `{ roomId: string; title: string }`)
- **POST** ``${this.apiUrl}/join-by-code`` -> `{param}/join-by-code` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/${groupId}/announcement`` -> `{param}/{param}/announcement` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/${groupId}/announcements`` -> `{param}/{param}/announcements` in `services/groups.service.ts` (expects `ChatAnnouncement[]`)
- **POST** ``${this.apiUrl}/announcement-group`` -> `{param}/announcement-group` in `services/groups.service.ts` (expects `ChatGroup`)
- **POST** ``${this.apiUrl}/${groupId}/broadcast`` -> `{param}/{param}/broadcast` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/discoverable`` -> `{param}/discoverable` in `services/groups.service.ts` (expects `DiscoverableGroup[]`)
- **POST** ``${this.apiUrl}/${groupId}/join`` -> `{param}/{param}/join` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.baseUrl}/articles`` -> `{param}/articles` in `services/help-centre.service.ts` (expects `HelpResponse`)
- **GET** ``${this.baseUrl}/categories`` -> `{param}/categories` in `services/help-centre.service.ts` (expects `string[]`)
- **GET** ``${environment.apiUrl}/help/articles?${params}`` -> `{param}/help/articles?{param}` in `services/help-faq.service.ts` (expects `FAQResponse`)
- **GET** ``${environment.apiUrl}/help/categories`` -> `{param}/help/categories` in `services/help-faq.service.ts` (expects `string[]`)
- **GET** ``${environment.apiUrl}/help/quick-replies`` -> `{param}/help/quick-replies` in `services/help-faq.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/articles`` -> `{param}/articles` in `services/help.service.ts` (expects `HelpResult`)
- **GET** ``${this.baseUrl}/categories`` -> `{param}/categories` in `services/help.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/my`` -> `{param}/my` in `services/hobby-tags.service.ts` (expects `UserHobbyTag[]`)
- **POST** ``${this.apiUrl}/my`` -> `{param}/my` in `services/hobby-tags.service.ts` (expects `UserHobbyTag`)
- **DELETE** ``${this.apiUrl}/my/${hobbyTagId}`` -> `{param}/my/{param}` in `services/hobby-tags.service.ts` (expects `{ success: boolean }`)
- **PATCH** ``${this.apiUrl}/my/${hobbyTagId}/proficiency`` -> `{param}/my/{param}/proficiency` in `services/hobby-tags.service.ts` (expects `UserHobbyTag`)
- **GET** ``${this.apiUrl}/vocabulary`` -> `{param}/vocabulary` in `services/hobby-tags.service.ts` (expects `Array<VocabularyItem>`)
- **POST** ``${environment.apiUrl}/nlp/translate-ui`` -> `{param}/nlp/translate-ui` in `services/i18n.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/language-islands.service.ts` (expects `LanguageIsland`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/language-islands.service.ts` (expects `LanguageIsland`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/language-islands.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${id}/join`` -> `{param}/{param}/join` in `services/language-islands.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${id}/leave`` -> `{param}/{param}/leave` in `services/language-islands.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/my`` -> `{param}/my` in `services/language-islands.service.ts` (expects `LanguageIsland[]`)
- **GET** ``${this.baseUrl}/terms`` -> `{param}/terms` in `services/legal.service.ts` (expects `LegalDocument`)
- **GET** ``${this.baseUrl}/privacy`` -> `{param}/privacy` in `services/legal.service.ts` (expects `LegalDocument`)
- **GET** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/lesson.service.ts` (expects `Lesson`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/lesson.service.ts` (expects `Lesson`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/lesson.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}`` -> `{param}` in `services/linked-accounts.service.ts` (expects `LinkedAccount[]`)
- **POST** ``${this.baseUrl}/link`` -> `{param}/link` in `services/linked-accounts.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/unlink`` -> `{param}/unlink` in `services/linked-accounts.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/video-calls/accept`` -> `{param}/video-calls/accept` in `services/livekit.service.ts` (expects `VideoClassroomTokenResponse`)
- **POST** ``${environment.apiUrl}/video-calls/start`` -> `{param}/video-calls/start` in `services/livekit.service.ts` (expects `VideoClassroomTokenResponse`)
- **GET** ``${environment.apiUrl}/location/${userId}/current`` -> `{param}/location/{param}/current` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/location/${userId}/current`` -> `{param}/location/{param}/current` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/location/${userId}/live/start`` -> `{param}/location/{param}/live/start` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/location/${userId}/live/update`` -> `{param}/location/{param}/live/update` in `services/location.service.ts` (expects `Unknown`)
- **DELETE** ``${environment.apiUrl}/location/${userId}/live`` -> `{param}/location/{param}/live` in `services/location.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/location/${sharerUserId}/live`` -> `{param}/location/{param}/live` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/media/moments/presigned-url`` -> `{param}/media/moments/presigned-url` in `services/media-upload.service.ts` (expects `{
        uploadUrl: string;
        mediaUrl: string;
        objectKey: string;
        mediaKind: 'image' | 'video';
      }`)
- **POST** ``${this.baseUrl}/avatar/upload`` -> `{param}/avatar/upload` in `services/media.service.ts` (expects `AvatarUploadResponse`)
- **POST** ``${this.baseUrl}/voice-note`` -> `{param}/voice-note` in `services/media.service.ts` (expects `VoiceNoteUploadResponse`)
- **POST** ``${this.baseUrl}/view-once/mark-viewed`` -> `{param}/view-once/mark-viewed` in `services/media.service.ts` (expects `void`)
- **GET** ``${this.apiUrl}/progress`` -> `{param}/progress` in `services/milestone.service.ts` (expects `MilestoneProgress`)
- **POST** ``${this.apiUrl}/${id}/complete`` -> `{param}/{param}/complete` in `services/milestone.service.ts` (expects `Milestone`)
- **DELETE** ``${this.apiUrl}/${id}`` -> `{param}/{param}` in `services/milestone.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/items`` -> `{param}/items` in `services/moderation.service.ts` (expects `ModerationItem[]`)
- **POST** ``${this.baseUrl}/approve`` -> `{param}/approve` in `services/moderation.service.ts` (expects `ModerationActionResponse`)
- **POST** ``${this.baseUrl}/reject`` -> `{param}/reject` in `services/moderation.service.ts` (expects `ModerationActionResponse`)
- **POST** ``${this.baseUrl}/report`` -> `{param}/report` in `services/moderation.service.ts` (expects `ModerationActionResponse`)
- **GET** ``${this.baseUrl}/analyse/${userId}`` -> `{param}/analyse/{param}` in `services/moderation.service.ts` (expects `UserAnalysisResult`)
- **GET** ``${this.baseUrl}/feed`` -> `{param}/feed` in `services/moments.store.ts` (expects `MomentRecord[]`)
- **POST** ``${this.baseUrl}/${momentId}/like`` -> `{param}/{param}/like` in `services/moments.store.ts` (expects `{ likes_count: number; is_liked: boolean }`)
- **GET** ``${this.baseUrl}/${momentId}/comments`` -> `{param}/{param}/comments` in `services/moments.store.ts` (expects `MomentComment[]`)
- **POST** ``${this.baseUrl}/${momentId}/comments`` -> `{param}/{param}/comments` in `services/moments.store.ts` (expects `MomentComment`)
- **POST** ``${this.baseUrl}/${momentId}/comments/${commentId}/vote`` -> `{param}/{param}/comments/{param}/vote` in `services/moments.store.ts` (expects `VoteCorrectionResponse`)
- **PATCH** ``${this.baseUrl}/${momentId}/pin`` -> `{param}/{param}/pin` in `services/moments.store.ts` (expects `MomentRecord`)
- **POST** ``${this.baseUrl}/create-checkout-session`` -> `{param}/create-checkout-session` in `services/monetisation.service.ts` (expects `CreateCheckoutSessionResponse`)
- **POST** ``${this.baseUrl}/generate-api-key`` -> `{param}/generate-api-key` in `services/monetisation.service.ts` (expects `GenerateApiKeyResponse`)
- **GET** ``${this.baseUrl}/analytics`` -> `{param}/analytics` in `services/monetisation.service.ts` (expects `DeveloperAnalyticsResponse`)
- **GET** ``${this.baseUrl}/diagnostics/logs`` -> `{param}/diagnostics/logs` in `services/monetisation.service.ts` (expects `DiagnosticLog[]`)
- **POST** ``${this.baseUrl}/diagnostics/logs`` -> `{param}/diagnostics/logs` in `services/monetisation.service.ts` (expects `DiagnosticLog`)
- **POST** ``${this.baseUrl}/validate-apple-receipt`` -> `{param}/validate-apple-receipt` in `services/monetisation.service.ts` (expects `AppleReceiptValidationResponse`)
- **POST** ``${this.baseUrl}/restore-purchases`` -> `{param}/restore-purchases` in `services/monetisation.service.ts` (expects `{ received: boolean; status: string }`)
- **GET** ``${this.baseUrl}/coins-balance`` -> `{param}/coins-balance` in `services/monetisation.service.ts` (expects `{ coins_balance: number }`)
- **POST** ``${environment.apiUrl}/nlp/explain-grammar`` -> `{param}/nlp/explain-grammar` in `services/nlp.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/nlp/simplify`` -> `{param}/nlp/simplify` in `services/nlp.service.ts` (expects `Unknown`)
- **GET** ``${this.notificationsUrl}/preferences`` -> `{param}/preferences` in `services/notification-preferences.service.ts` (expects `LegacyNotificationPreferences`)
- **PUT** ``${this.notificationsUrl}/preferences`` -> `{param}/preferences` in `services/notification-preferences.service.ts` (expects `{ success: boolean; preferences: LegacyNotificationPreferences }`)
- **PATCH** ``${environment.apiUrl}/users/me/notification-preferences`` -> `{param}/users/me/notification-preferences` in `services/notification-preferences.service.ts` (expects `void`)
- **GET** ``${environment.apiUrl}/users/me/notification-preferences`` -> `{param}/users/me/notification-preferences` in `services/notification-preferences.service.ts` (expects `{ custom_tone_url?: string; vibration_pattern?: number[] }`)
- **GET** ``${this.baseUrl}/unread-count`` -> `{param}/unread-count` in `services/notification.service.ts` (expects `{ unreadCount: number }`)
- **PATCH** ``${this.baseUrl}/${notificationId}/read`` -> `{param}/{param}/read` in `services/notification.service.ts` (expects `void`)
- **PATCH** ``${this.baseUrl}/read-all`` -> `{param}/read-all` in `services/notification.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/users/onboarding`` -> `{param}/users/onboarding` in `services/onboarding.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/proficiency/assess`` -> `{param}/proficiency/assess` in `services/proficiency.service.ts` (expects `AssessmentResult`)
- **POST** ``${environment.apiUrl}/proficiency/languages`` -> `{param}/proficiency/languages` in `services/proficiency.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.baseUrl}/my-visitors`` -> `{param}/my-visitors` in `services/profile-visits.service.ts` (expects `ProfileVisit[]`)
- **POST** ``${this.baseUrl}/${viewedId}`` -> `{param}/{param}` in `services/profile-visits.service.ts` (expects `void`)
- **POST** ``${this.apiUrl}/voice-feedback`` -> `{param}/voice-feedback` in `services/pronunciation.service.ts` (expects `{ success: boolean }`)
- **GET** ``${environment.apiUrl}/quests`` -> `{param}/quests` in `services/quests.store.ts` (expects `Quest[]`)
- **GET** ``/api/audio-rooms${path}`` -> `/api/audio-rooms{param}` in `services/quick-poll.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/chat/quick-replies`` -> `{param}/chat/quick-replies` in `services/quick-replies.service.ts` (expects `QuickReply[]`)
- **POST** ``${this.apiUrl}/chat/quick-replies`` -> `{param}/chat/quick-replies` in `services/quick-replies.service.ts` (expects `QuickReply`)
- **GET** ``/api/quiz/questions?language=${language}`` -> `/api/quiz/questions?language={param}` in `services/quiz.service.ts` (expects `QuizQuestion[]`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `{param}/analytics/client-error` in `services/reading-engine-crash-reporting.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `{param}/analytics/client-error` in `services/reading-engine-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/resource-library.service.ts` (expects `ResourceItem`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/resource-library.service.ts` (expects `ResourceItem`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `{param}/{param}` in `services/resource-library.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/monetisation/restore-purchases`` -> `{param}/monetisation/restore-purchases` in `services/restore-purchases.service.ts` (expects `RestorePurchasesApiResponse`)
- **GET** ``${this.apiUrl}/safety/blocked-ids`` -> `{param}/safety/blocked-ids` in `services/safety.service.ts` (expects `string[]`)
- **POST** ``${this.apiUrl}/safety/report`` -> `{param}/safety/report` in `services/safety.service.ts` (expects `ReportResponse`)
- **POST** ``${this.apiUrl}/safety/block/${blockedId}`` -> `{param}/safety/block/{param}` in `services/safety.service.ts` (expects `{ success: boolean; blocked_id: string }`)
- **POST** ``${this.apiUrl}/safety/unblock/${blockedId}`` -> `{param}/safety/unblock/{param}` in `services/safety.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/safety/blocked-ids`` -> `{param}/safety/blocked-ids` in `services/safety.service.ts` (expects `string[]`)
- **POST** ``${this.apiUrl}/safety/silence-unknown-callers`` -> `{param}/safety/silence-unknown-callers` in `services/safety.service.ts` (expects `void`)
- **GET** ``${this.apiUrl}/safety/silence-unknown-callers/${userId}`` -> `{param}/safety/silence-unknown-callers/{param}` in `services/safety.service.ts` (expects `{ silenceUnknownCallers: boolean }`)
- **GET** ``${this.apiUrl}/safety/report-categories`` -> `{param}/safety/report-categories` in `services/safety.service.ts` (expects `ReportCategory[]`)
- **GET** ``${this.apiUrl}/safety/blocked-ids/${userId}`` -> `{param}/safety/blocked-ids/{param}` in `services/safety.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/safety/blocker-ids/${userId}`` -> `{param}/safety/blocker-ids/{param}` in `services/safety.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/safety/blocked-and-blocker-ids/${userId}`` -> `{param}/safety/blocked-and-blocker-ids/{param}` in `services/safety.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/safety/is-blocked/${userId}`` -> `{param}/safety/is-blocked/{param}` in `services/safety.service.ts` (expects `{ blocked: boolean }`)
- **GET** ``${environment.apiUrl}/favourites`` -> `{param}/favourites` in `services/saved-content.service.ts` (expects `SavedContent[]`)
- **GET** ``${this.baseUrl}/list`` -> `{param}/list` in `services/soundboard.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/play`` -> `{param}/play` in `services/soundboard.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/create-checkout-session`` -> `{param}/create-checkout-session` in `services/stripe.service.ts` (expects `CreateCheckoutSessionResponse`)
- **POST** ``${this.apiUrl}/study-buddies/follow`` -> `{param}/study-buddies/follow` in `services/study-buddies.service.ts` (expects `Unknown`)
- **DELETE** ``${this.apiUrl}/study-buddies/unfollow`` -> `{param}/study-buddies/unfollow` in `services/study-buddies.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/study-buddies/channel`` -> `{param}/study-buddies/channel` in `services/study-buddies.service.ts` (expects `{ channel: string }`)
- **POST** ``${this.apiUrl}/request`` -> `{param}/request` in `services/study-buddy.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/matches`` -> `{param}/matches` in `services/study-buddy.service.ts` (expects `Record<string, unknown>[]`)
- **GET** ``${this.apiUrl}/requests`` -> `{param}/requests` in `services/study-buddy.service.ts` (expects `BuddyRequest[]`)
- **POST** ``${this.apiUrl}/requests/${id}/accept`` -> `{param}/requests/{param}/accept` in `services/study-buddy.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/requests/${id}/decline`` -> `{param}/requests/{param}/decline` in `services/study-buddy.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/study-streak/me`` -> `{param}/study-streak/me` in `services/study-streak.service.ts` (expects `{ streak: number }`)
- **POST** ``${environment.apiUrl}/study-streak/checkin`` -> `{param}/study-streak/checkin` in `services/study-streak.service.ts` (expects `{ streak: number }`)
- **GET** ``${this.apiUrl}/${id}`` -> `{param}/{param}` in `services/subscription-plans.service.ts` (expects `SubscriptionPlan`)
- **GET** ``${this.apiUrl}/${planId}/benefits`` -> `{param}/{param}/benefits` in `services/subscription-plans.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/showcase`` -> `{param}/showcase` in `services/subscription-plans.service.ts` (expects `SubscriptionPlan[]`)
- **GET** ``${this.baseUrl}/subscription`` -> `{param}/subscription` in `services/subscription.service.ts` (expects `SubscriptionDetails`)
- **POST** ``${this.baseUrl}/subscription/cancel`` -> `{param}/subscription/cancel` in `services/subscription.service.ts` (expects `CancelSubscriptionResponse`)
- **POST** ``${this.baseUrl}/subscription/resume`` -> `{param}/subscription/resume` in `services/subscription.service.ts` (expects `ResumeSubscriptionResponse`)
- **GET** ``${this.baseUrl}/subscription/invoices`` -> `{param}/subscription/invoices` in `services/subscription.service.ts` (expects `SubscriptionInvoice[]`)
- **POST** ``${this.baseUrl}/subscription/billing-portal`` -> `{param}/subscription/billing-portal` in `services/subscription.service.ts` (expects `BillingPortalSessionResponse`)
- **POST** ``${this.baseUrl}/avatar/upload`` -> `{param}/avatar/upload` in `services/upload.service.ts` (expects `UploadResult`)
- **GET** ``${this.baseUrl}/tags`` -> `{param}/tags` in `services/user-interests.service.ts` (expects `{ tags: string[] }`)
- **POST** ``${this.baseUrl}/tags`` -> `{param}/tags` in `services/user-interests.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/vocabulary`` -> `{param}/vocabulary` in `services/user-interests.service.ts` (expects `{ entries: VocabularyEntry[] }`)
- **GET** ``${this.baseUrl}/me`` -> `{param}/me` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.baseUrl}/${userId}`` -> `{param}/{param}` in `services/user.service.ts` (expects `UserProfile`)
- **POST** ``${this.baseUrl}/${userId}/follow`` -> `{param}/{param}/follow` in `services/user.service.ts` (expects `void`)
- **DELETE** ``${this.baseUrl}/${userId}/follow`` -> `{param}/{param}/follow` in `services/user.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/${userId}/followers`` -> `{param}/{param}/followers` in `services/user.service.ts` (expects `{ data: UserProfile[]; total: number }`)
- **GET** ``${this.baseUrl}/${userId}/following`` -> `{param}/{param}/following` in `services/user.service.ts` (expects `{ data: UserProfile[]; total: number }`)
- **POST** ``${this.baseUrl}/${userId}/like`` -> `{param}/{param}/like` in `services/user.service.ts` (expects `void`)
- **PATCH** ``${this.baseUrl}/me`` -> `{param}/me` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.visitsUrl}/my-visitors`` -> `{param}/my-visitors` in `services/user.service.ts` (expects `VisitorLog[]`)
- **GET** ``${this.baseUrl}/me/visitors`` -> `{param}/me/visitors` in `services/user.service.ts` (expects `ProfileVisitor[]`)
- **POST** ``${this.visitsUrl}/${viewedUserId}`` -> `{param}/{param}` in `services/user.service.ts` (expects `Unknown`)
- **POST** ``${this.mediaUrl}/presigned-url`` -> `{param}/presigned-url` in `services/user.service.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **POST** ``${this.baseUrl}/me/cover-photo/presigned-url`` -> `{param}/me/cover-photo/presigned-url` in `services/user.service.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **POST** ``${this.baseUrl}/me/avatar/presigned-url`` -> `{param}/me/avatar/presigned-url` in `services/user.service.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **PATCH** ``${this.baseUrl}/me/cover-photo`` -> `{param}/me/cover-photo` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.baseUrl}/me/export`` -> `{param}/me/export` in `services/user.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/corrector-score/rate`` -> `{param}/corrector-score/rate` in `services/user.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/me/linked-accounts`` -> `{param}/me/linked-accounts` in `services/user.service.ts` (expects `LinkedAccount[]`)
- **GET** ``${this.baseUrl}/me/privacy-settings`` -> `{param}/me/privacy-settings` in `services/user.service.ts` (expects `{
          privacy_hide_age: boolean;
          privacy_hide_location: boolean;
          privacy_hide_from_search: boolean;
          privacy_hide_gender: boolean;
          privacy_last_seen?: string;
          privacy_profile_photo?: string;
          privacy_about_info?: string;
          privacy_status?: string;
          privacy_hide_exact_location: boolean;
          privacy_hide_online_status: boolean;
          privacy_hide_vip_status: boolean;
        }`)
- **POST** ``${this.baseUrl}/me/linked-accounts/link`` -> `{param}/me/linked-accounts/link` in `services/user.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/me/linked-accounts/unlink`` -> `{param}/me/linked-accounts/unlink` in `services/user.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/me/stats`` -> `{param}/me/stats` in `services/user.service.ts` (expects `Partial<UserProfile>`)
- **GET** ``${this.baseUrl}/hobbies`` -> `{param}/hobbies` in `services/user.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/interests`` -> `{param}/interests` in `services/user.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/search`` -> `{param}/search` in `services/user.service.ts` (expects `{ id: string; display_name: string; avatar_url: string | null }[]`)
- **POST** ``${this.baseUrl}/query-language-pairs`` -> `{param}/query-language-pairs` in `services/user.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/me/badges`` -> `{param}/me/badges` in `services/user.service.ts` (expects `Badge[]`)
- **POST** ``${this.baseUrl}/me/assess-proficiency`` -> `{param}/me/assess-proficiency` in `services/user.service.ts` (expects `{ level: string }`)
- **GET** ``${this.baseUrl}/stats/me`` -> `{param}/stats/me` in `services/user.service.ts` (expects `{
          translations_count: number;
          corrections_count: number;
          moments_count: number;
        }`)
- **GET** ``${this.baseUrl}/me/xp`` -> `{param}/me/xp` in `services/user.service.ts` (expects `{ totalXp: number }`)
- **PATCH** ``${this.baseUrl}/me/privacy`` -> `{param}/me/privacy` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.baseUrl}/me/business`` -> `{param}/me/business` in `services/user.service.ts` (expects `{
        business_name?: string;
        business_hours?: string;
        website_url?: string;
        catalog?: BusinessCatalogItem[];
      }`)
- **PATCH** ``${this.baseUrl}/me/business`` -> `{param}/me/business` in `services/user.service.ts` (expects `UserProfile`)
- **POST** ``${environment.apiUrl}/safety/block`` -> `{param}/safety/block` in `services/user.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/safety/unblock`` -> `{param}/safety/unblock` in `services/user.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/safety/report`` -> `{param}/safety/report` in `services/user.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/fcm/subscribe`` -> `{param}/fcm/subscribe` in `services/user.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.baseUrl}/fcm/unsubscribe`` -> `{param}/fcm/unsubscribe` in `services/user.service.ts` (expects `{ success: boolean }`)
- **DELETE** ``${this.baseUrl}/me`` -> `{param}/me` in `services/user.service.ts` (expects `{ message: string; scheduled_for_deletion_at: string }`)
- **POST** ``${this.baseUrl}/me/restore`` -> `{param}/me/restore` in `services/user.service.ts` (expects `{ message: string }`)
- **GET** ``${this.baseUrl}/me/message-filters`` -> `{param}/me/message-filters` in `services/user.service.ts` (expects `{
          age_min?: number;
          age_max?: number;
          allowed_genders?: string[];
          allowed_native_languages?: string[];
        }`)
- **PUT** ``${this.baseUrl}/me/message-filters`` -> `{param}/me/message-filters` in `services/user.service.ts` (expects `void`)
- **PATCH** ``${this.baseUrl}/me/dnd`` -> `{param}/me/dnd` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${environment.apiUrl}/version`` -> `{param}/version` in `services/version.service.ts` (expects `VersionInfo`)
- **POST** ``${environment.apiUrl}/video-calls/start`` -> `{param}/video-calls/start` in `services/video-call.service.ts` (expects `{ token: string; roomName: string }`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `{param}/analytics/client-error` in `services/video-classroom-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.flashcardsUrl}/due`` -> `{param}/due` in `services/vocabulary.store.ts` (expects `Flashcard[]`)
- **PATCH** ``${this.flashcardsUrl}/${flashcardId}/srs`` -> `{param}/{param}/srs` in `services/vocabulary.store.ts` (expects `Flashcard`)
- **PATCH** ``${this.flashcardsUrl}/${item.flashcardId}/srs`` -> `{param}/{param}/srs` in `services/vocabulary.store.ts` (expects `Flashcard`)
- **POST** ``${this.nlpUrl}/translate`` -> `{param}/translate` in `services/vocabulary.store.ts` (expects `TranslationResult`)
- **POST** ``${this.nlpUrl}/grammar-check`` -> `{param}/grammar-check` in `services/vocabulary.store.ts` (expects `GrammarCheckResult`)
- **POST** ``${this.nlpUrl}/pronunciation-score`` -> `{param}/pronunciation-score` in `services/vocabulary.store.ts` (expects `PronunciationScoreResult`)
- **GET** ``${environment.apiUrl}/shopping/cart`` -> `{param}/shopping/cart` in `components/cart/cart.component.ts` (expects `CartItem[]`)
- **DELETE** ``${environment.apiUrl}/shopping/cart`` -> `{param}/shopping/cart` in `components/cart/cart.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/shopping/cart/checkout`` -> `{param}/shopping/cart/checkout` in `components/cart/cart.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/nlp/transcribe-audio`` -> `{param}/nlp/transcribe-audio` in `components/chat-message/chat-message.component.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/list`` -> `{param}/list` in `components/classrooms-marketplace/classrooms-marketplace.ts` (expects `AudioRoomRecord[]`)
- **POST** ``${environment.apiUrl}/media/cover/presigned-url`` -> `{param}/media/cover/presigned-url` in `components/cover-photo-uploader/cover-photo-uploader.component.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **POST** ``${environment.apiUrl}/media/cover/confirm`` -> `{param}/media/cover/confirm` in `components/cover-photo-uploader/cover-photo-uploader.component.ts` (expects `{ coverUrl: string }`)
- **GET** ``${environment.apiUrl}/daily-tip`` -> `{param}/daily-tip` in `components/daily-learning-tip/daily-learning-tip.component.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/interests?language=${lang}`` -> `{param}/interests?language={param}` in `components/groups-discovery/groups-discovery.component.ts` (expects `InterestTopic[]`)
- **GET** ``${this.apiUrl}/groups/discoverable`` -> `{param}/groups/discoverable` in `components/groups-discovery/groups-discovery.component.ts` (expects `DiscoverableGroup[]`)
- **POST** ``${this.apiUrl}/groups/${groupId}/join`` -> `{param}/groups/{param}/join` in `components/groups-discovery/groups-discovery.component.ts` (expects `unknown`)
- **GET** ``${environment.apiUrl}/audio-rooms/list?${queryParams.toString()}`` -> `{param}/audio-rooms/list?{param}` in `components/language-parties/language-parties.component.ts` (expects `LanguageParty[]`)
- **POST** ``${environment.apiUrl}/audio-rooms/language-parties`` -> `{param}/audio-rooms/language-parties` in `components/language-parties/language-parties.component.ts` (expects `AudioRoomRecord`)
- **GET** ``${environment.apiUrl}/audio-rooms/${party.id}`` -> `{param}/audio-rooms/{param}` in `components/language-parties/language-parties.component.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.apiUrl}/moments/${questionId}/answer`` -> `{param}/moments/{param}/answer` in `components/language-questions/language-questions.component.ts` (expects `{ correct: boolean }`)
- **GET** ``${environment.apiUrl}/leaderboard/top-correctors?limit=20`` -> `{param}/leaderboard/top-correctors?limit=20` in `components/leaderboard/leaderboard.component.ts` (expects `Corrector[]`)
- **POST** ``${environment.apiUrl}/nlp/translate`` -> `{param}/nlp/translate` in `components/moment-translate/moment-translate.component.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/stats/me`` -> `{param}/stats/me` in `components/my-stats/my-stats.component.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/shopping/catalog`` -> `{param}/shopping/catalog` in `components/shop/shop.component.ts` (expects `CatalogItem[]`)
- **POST** ``${environment.apiUrl}/shopping/cart`` -> `{param}/shopping/cart` in `components/shop/shop.component.ts` (expects `{ success: boolean }`)
- **POST** ``${environment.apiUrl}/monetisation/create-checkout-session`` -> `{param}/monetisation/create-checkout-session` in `components/subscription-plans/subscription-plans.component.ts` (expects `{ sessionUrl: string; sessionId: string }`)
- **GET** ``${environment.apiUrl}/word-of-the-day`` -> `{param}/word-of-the-day` in `components/word-of-the-day/word-of-the-day.component.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/scenarios`` -> `{param}/scenarios` in `pages/chat/ai-conversation.service.ts` (expects `Scenario[]`)
- **POST** ``${this.baseUrl}/message`` -> `{param}/message` in `pages/chat/ai-conversation.service.ts` (expects `AiMessageReply`)
- **POST** ``${apiUrl}/groups/join-by-code`` -> `{param}/groups/join-by-code` in `pages/join-group/join-group.component.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiBase}/chat/rooms`` -> `{param}/chat/rooms` in `pages/settings/backup-restore.component.ts` (expects `unknown`)
- **GET** ``${environment.apiUrl}/audio-rooms/${roomId}`` -> `{param}/audio-rooms/{param}` in `pages/voiceroom-preview/voiceroom-preview.component.ts` (expects `RoomPreview`)

## Unused Backend Routes

- **GET** `/api` in `app.controller.ts` (function: `getHello`)
- **GET** `/api/health` in `app.controller.ts` (function: `getHealth`)
- **GET** `/api/achievements` in `achievements/achievements.controller.ts` (function: `listAchievements`)
- **GET** `/api/achievements/user/:userId` in `achievements/achievements.controller.ts` (function: `getUserAchievements`)
- **GET** `/api/achievements/full/:userId` in `achievements/achievements.controller.ts` (function: `getFullAchievements`)
- **GET** `/api/achievements/my` in `achievements/achievements.controller.ts` (function: `getMyAchievements`)
- **POST** `/api/achievements/evaluate` in `achievements/achievements.controller.ts` (function: `evaluateForCurrentUser`)
- **POST** `/api/achievements/evaluate/:userId` in `achievements/achievements.controller.ts` (function: `evaluateForUser`)
- **GET** `/api/admin/v1/logs` in `admin/admin-operational-events-v1.controller.ts` (function: `list`)
- **GET** `/api/admin/v1/roles/assignments` in `admin/admin-roles-v1.controller.ts` (function: `listAssignments`)
- **GET** `/api/admin/v1/me` in `admin/admin-v1.controller.ts` (function: `getMe`)
- **GET** `/api/admin/v1/roles` in `admin/admin-v1.controller.ts` (function: `listRoles`)
- **GET** `/api/admin/v1/system/health` in `admin/admin-v1.controller.ts` (function: `getSystemHealth`)
- **GET** `/api/admin/v1/audit` in `admin/admin-v1.controller.ts` (function: `listAudit`)
- **GET** `/api/admin/v1/moderation/reports` in `admin/admin-v1.controller.ts` (function: `listModerationReports`)
- **GET** `/api/admin/v1/users` in `admin/admin-v1.controller.ts` (function: `listUsers`)
- **GET** `/api/admin/v1/users/:id/login-history` in `admin/admin-v1.controller.ts` (function: `getUserLoginHistory`)
- **GET** `/api/admin/v1/users/:id` in `admin/admin-v1.controller.ts` (function: `getUser`)
- **GET** `/api/admin/users` in `admin/admin.controller.ts` (function: `listUsers`)
- **PATCH** `/api/admin/users/:id/vip` in `admin/admin.controller.ts` (function: `setVipStatus`)
- **GET** `/api/admin/users/:id/login-history` in `admin/admin.controller.ts` (function: `getLoginHistory`)
- **POST** `/api/admin/users/:id/ban` in `admin/admin.controller.ts` (function: `banUser`)
- **POST** `/api/admin/users/:id/warn` in `admin/admin.controller.ts` (function: `warnUser`)
- **GET** `/api/admin/blocks` in `admin/admin.controller.ts` (function: `listAllBlocks`)
- **GET** `/api/admin/reports` in `admin/admin.controller.ts` (function: `listReports`)
- **DELETE** `/api/admin/blocks/:blockId` in `admin/admin.controller.ts` (function: `removeBlock`)
- **GET** `/api/ai-conversation/scenarios` in `ai-conversation/ai-conversation.controller.ts` (function: `getScenarios`)
- **POST** `/api/ai-conversation/message` in `ai-conversation/ai-conversation.controller.ts` (function: `handleMessage`)
- **POST** `/api/analytics/client-error` in `analytics/analytics.controller.ts` (function: `logClientError`)
- **GET** `/api/assessments/questions` in `assessments/assessments.controller.ts` (function: `getQuestions`)
- **GET** `/api/audio-intro/:userId` in `audio-intro/audio-intro.controller.ts` (function: `getAudioIntro`)
- **PATCH** `/api/audio-intro/:userId` in `audio-intro/audio-intro.controller.ts` (function: `updateAudioIntro`)
- **POST** `/api/audio-intro/presigned-upload` in `audio-intro/audio-intro.controller.ts` (function: `getUploadUrl`)
- **GET** `/api/audio-rooms/health` in `audio-rooms/audio-rooms-health.controller.ts` (function: `getHealth`)
- **GET** `/api/audio-rooms/preview/:id` in `audio-rooms/audio-rooms-preview.controller.ts` (function: `getRoomPreview`)
- **POST** `/api/audio-rooms/create` in `audio-rooms/audio-rooms.controller.ts` (function: `createRoom`)
- **POST** `/api/audio-rooms/archive-recording` in `audio-rooms/audio-rooms.controller.ts` (function: `archiveRecording`)
- **POST** `/api/audio-rooms/token` in `audio-rooms/audio-rooms.controller.ts` (function: `generateToken`)
- **GET** `/api/audio-rooms/list` in `audio-rooms/audio-rooms.controller.ts` (function: `listActiveRooms`)
- **GET** `/api/audio-rooms/by-language` in `audio-rooms/audio-rooms.controller.ts` (function: `listActiveRoomsByLanguage`)
- **GET** `/api/audio-rooms/topics` in `audio-rooms/audio-rooms.controller.ts` (function: `getDistinctTopics`)
- **GET** `/api/audio-rooms/levels` in `audio-rooms/audio-rooms.controller.ts` (function: `getDistinctLevels`)
- **GET** `/api/audio-rooms/private` in `audio-rooms/audio-rooms.controller.ts` (function: `getPrivateRooms`)
- **GET** `/api/audio-rooms/call-logs` in `audio-rooms/audio-rooms.controller.ts` (function: `getCallLogs`)
- **GET** `/api/audio-rooms/exclusive-emojis` in `audio-rooms/audio-rooms.controller.ts` (function: `getExclusiveEmojis`)
- **GET** `/api/audio-rooms/:id` in `audio-rooms/audio-rooms.controller.ts` (function: `getRoom`)
- **GET** `/api/audio-rooms/:id/stage` in `audio-rooms/audio-rooms.controller.ts` (function: `getStage`)
- **POST** `/api/audio-rooms/:id/stage/reorder` in `audio-rooms/audio-rooms.controller.ts` (function: `reorderSpeakers`)
- **POST** `/api/audio-rooms/:id/stage/clear` in `audio-rooms/audio-rooms.controller.ts` (function: `clearStage`)
- **POST** `/api/audio-rooms/language-parties` in `audio-rooms/audio-rooms.controller.ts` (function: `createLanguageParty`)
- **POST** `/api/audio-rooms/private` in `audio-rooms/audio-rooms.controller.ts` (function: `createPrivateParty`)
- **POST** `/api/audio-rooms/raise-hand` in `audio-rooms/audio-rooms.controller.ts` (function: `raiseHand`)
- **POST** `/api/audio-rooms/approve-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `approveSpeaker`)
- **POST** `/api/audio-rooms/mute-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `muteSpeaker`)
- **POST** `/api/audio-rooms/kick-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `kickSpeaker`)
- **POST** `/api/audio-rooms/demote-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `demoteSpeaker`)
- **POST** `/api/audio-rooms/dismiss-raised-hand` in `audio-rooms/audio-rooms.controller.ts` (function: `dismissRaisedHand`)
- **POST** `/api/audio-rooms/invite-co-host` in `audio-rooms/audio-rooms.controller.ts` (function: `inviteCoHost`)
- **POST** `/api/audio-rooms/remove-co-host` in `audio-rooms/audio-rooms.controller.ts` (function: `removeCoHost`)
- **POST** `/api/audio-rooms/captions` in `audio-rooms/audio-rooms.controller.ts` (function: `sendCaption`)
- **POST** `/api/audio-rooms/ai-captions` in `audio-rooms/audio-rooms.controller.ts` (function: `broadcastAICaption`)
- **POST** `/api/audio-rooms/archive` in `audio-rooms/audio-rooms.controller.ts` (function: `archiveRoom`)
- **GET** `/api/audio-rooms/:id/transcript` in `audio-rooms/audio-rooms.controller.ts` (function: `getTranscript`)
- **POST** `/api/audio-rooms/:roomId/polls` in `audio-rooms/audio-rooms.controller.ts` (function: `createPoll`)
- **POST** `/api/audio-rooms/polls/vote` in `audio-rooms/audio-rooms.controller.ts` (function: `submitVote`)
- **GET** `/api/audio-rooms/:roomId/polls/:pollId` in `audio-rooms/audio-rooms.controller.ts` (function: `getPollResults`)
- **GET** `/api/audio-rooms/soundboard/list` in `audio-rooms/audio-rooms.controller.ts` (function: `listSoundboardSounds`)
- **POST** `/api/audio-rooms/soundboard/play` in `audio-rooms/audio-rooms.controller.ts` (function: `playSound`)
- **POST** `/api/audio-rooms/:roomId/reactions` in `audio-rooms/audio-rooms.controller.ts` (function: `sendReaction`)
- **POST** `/api/audio-rooms/:roomId/tip` in `audio-rooms/audio-rooms.controller.ts` (function: `tipHost`)
- **POST** `/api/auth/change-password` in `auth/auth.controller.ts` (function: `changePassword`)
- **POST** `/api/auth/two-factor/enable` in `auth/auth.controller.ts` (function: `enableTwoFactor`)
- **POST** `/api/auth/two-factor/verify` in `auth/auth.controller.ts` (function: `verifyTwoFactor`)
- **POST** `/api/auth/two-factor/disable` in `auth/auth.controller.ts` (function: `disableTwoFactor`)
- **GET** `/api/auth/two-factor/status` in `auth/auth.controller.ts` (function: `twoFactorStatus`)
- **POST** `/api/auth/transfer/generate` in `auth/auth.controller.ts` (function: `generateTransferLink`)
- **POST** `/api/auth/transfer/consume` in `auth/auth.controller.ts` (function: `consumeTransferLink`)
- **POST** `/api/auth/transfer/swap` in `auth/auth.controller.ts` (function: `swapTransferLink`)
- **GET** `/api/blocks` in `blocks/blocks.controller.ts` (function: `getBlockedUsers`)
- **POST** `/api/blocks` in `blocks/blocks.controller.ts` (function: `blockUser`)
- **DELETE** `/api/blocks/:blockedId` in `blocks/blocks.controller.ts` (function: `unblockUser`)
- **POST** `/api/calls/initiate` in `calls/calls.controller.ts` (function: `initiateCall`)
- **POST** `/api/calls/group` in `calls/calls.controller.ts` (function: `createGroupCall`)
- **GET** `/api/calls/active` in `calls/calls.controller.ts` (function: `getActiveCalls`)
- **GET** `/api/calls/active/:room_name` in `calls/calls.controller.ts` (function: `getActiveCall`)
- **GET** `/api/calls/waiting` in `calls/calls.controller.ts` (function: `getWaitingCalls`)
- **PUT** `/api/calls/switch` in `calls/calls.controller.ts` (function: `switchCall`)
- **PUT** `/api/calls/:room_name/accept-waiting` in `calls/calls.controller.ts` (function: `acceptWaitingCall`)
- **PUT** `/api/calls/:room_name/hold` in `calls/calls.controller.ts` (function: `holdCall`)
- **PUT** `/api/calls/:room_name/resume` in `calls/calls.controller.ts` (function: `resumeCall`)
- **PUT** `/api/calls/:room_name/leave` in `calls/calls.controller.ts` (function: `leaveCall`)
- **GET** `/api/chat/settings` in `chat/chat-settings.controller.ts` (function: `getSettings`)
- **PUT** `/api/chat/settings` in `chat/chat-settings.controller.ts` (function: `updateSettings`)
- **POST** `/api/chat/token` in `chat/chat.controller.ts` (function: `getConnectionToken`)
- **POST** `/api/chat/messages` in `chat/chat.controller.ts` (function: `sendMessage`)
- **POST** `/api/chat/contacts/share` in `chat/chat.controller.ts` (function: `shareContact`)
- **GET** `/api/chat/rooms` in `chat/chat.controller.ts` (function: `getRooms`)
- **GET** `/api/chat/messages/:roomId` in `chat/chat.controller.ts` (function: `getMessages`)
- **POST** `/api/chat/favourites` in `chat/chat.controller.ts` (function: `addFavourite`)
- **GET** `/api/chat/favourites` in `chat/chat.controller.ts` (function: `getFavourites`)
- **DELETE** `/api/chat/favourites/:id` in `chat/chat.controller.ts` (function: `deleteFavourite`)
- **POST** `/api/chat/llm-proxy` in `chat/chat.controller.ts` (function: `chatLlmProxy`)
- **POST** `/api/chat/ai-partner` in `chat/chat.controller.ts` (function: `generateAiPartnerReply`)
- **POST** `/api/chat/suggested-replies` in `chat/chat.controller.ts` (function: `getSuggestedReplies`)
- **POST** `/api/chat/conversation-starters` in `chat/chat.controller.ts` (function: `getConversationStarters`)
- **POST** `/api/chat/translate-voiceroom` in `chat/chat.controller.ts` (function: `translateVoiceroomText`)
- **POST** `/api/chat/translate-real-time` in `chat/chat.controller.ts` (function: `translateRealTime`)
- **POST** `/api/chat/messages/status-reply` in `chat/chat.controller.ts` (function: `replyToStatusUpdate`)
- **POST** `/api/chat/messages/:messageId/correct` in `chat/chat.controller.ts` (function: `correctMessage`)
- **PATCH** `/api/chat/messages/:messageId/fix` in `chat/chat.controller.ts` (function: `fixMessage`)
- **PATCH** `/api/chat/messages/:messageId/status` in `chat/chat.controller.ts` (function: `updateMessageStatus`)
- **POST** `/api/chat/messages/:messageId/view` in `chat/chat.controller.ts` (function: `viewMessageMedia`)
- **DELETE** `/api/chat/messages/:messageId` in `chat/chat.controller.ts` (function: `deleteMessage`)
- **GET** `/api/chat/rooms/:roomId/members` in `chat/chat.controller.ts` (function: `getRoomMembers`)
- **POST** `/api/chat/rooms/:roomId/lock` in `chat/chat.controller.ts` (function: `lockChat`)
- **POST** `/api/chat/rooms/:roomId/unlock` in `chat/chat.controller.ts` (function: `unlockChat`)
- **GET** `/api/chat/locked-rooms` in `chat/chat.controller.ts` (function: `getLockedRooms`)
- **POST** `/api/chat/labels` in `chat/chat.controller.ts` (function: `addLabel`)
- **DELETE** `/api/chat/labels` in `chat/chat.controller.ts` (function: `removeLabel`)
- **GET** `/api/chat/labels` in `chat/chat.controller.ts` (function: `getUserLabels`)
- **GET** `/api/chat/labels/:label/rooms` in `chat/chat.controller.ts` (function: `getRoomsByLabel`)
- **GET** `/api/chat/rooms/:roomId/export` in `chat/chat.controller.ts` (function: `exportChatHistory`)
- **GET** `/api/chat/rooms/:roomId/greeting` in `chat/chat.controller.ts` (function: `getRoomGreeting`)
- **POST** `/api/chat/rooms/:roomId/wallpaper` in `chat/chat.controller.ts` (function: `setWallpaper`)
- **GET** `/api/chat/rooms/:roomId/wallpaper` in `chat/chat.controller.ts` (function: `getWallpaper`)
- **GET** `/api/chat-backup/export/:channelId` in `chat-backup/chat-backup.controller.ts` (function: `exportBackup`)
- **POST** `/api/chat-backup/import/:channelId` in `chat-backup/chat-backup.controller.ts` (function: `importBackup`)
- **POST** `/api/communities` in `communities/communities.controller.ts` (function: `create`)
- **GET** `/api/communities/:communityId` in `communities/communities.controller.ts` (function: `find`)
- **GET** `/api/communities` in `communities/communities.controller.ts` (function: `listMine`)
- **PATCH** `/api/communities/:communityId` in `communities/communities.controller.ts` (function: `update`)
- **DELETE** `/api/communities/:communityId` in `communities/communities.controller.ts` (function: `remove`)
- **POST** `/api/communities/:communityId/groups` in `communities/communities.controller.ts` (function: `addGroup`)
- **DELETE** `/api/communities/:communityId/groups/:groupId` in `communities/communities.controller.ts` (function: `removeGroup`)
- **GET** `/api/communities/:communityId/groups` in `communities/communities.controller.ts` (function: `getGroups`)
- **POST** `/api/corrector-score/rate` in `corrector-score/corrector-score.controller.ts` (function: `rateUser`)
- **GET** `/api/corrector-score/:userId` in `corrector-score/corrector-score.controller.ts` (function: `getScore`)
- **GET** `/api/cultural-guides/:language` in `cultural/cultural.controller.ts` (function: `getGuide`)
- **POST** `/api/cultural-insights/tags` in `cultural-insights/cultural-insights.controller.ts` (function: `createTag`)
- **GET** `/api/cultural-insights/tags/:momentId` in `cultural-insights/cultural-insights.controller.ts` (function: `getTagsForMoment`)
- **GET** `/api/cultural-insights/moments` in `cultural-insights/cultural-insights.controller.ts` (function: `searchByTags`)
- **GET** `/api/curated-content/articles` in `curated-content/curated-content.controller.ts` (function: `getArticles`)
- **GET** `/api/curated-content/articles/:id` in `curated-content/curated-content.controller.ts` (function: `getArticleById`)
- **POST** `/api/curated-content/articles` in `curated-content/curated-content.controller.ts` (function: `createArticle`)
- **GET** `/api/curated-content/dialogues` in `curated-content/curated-content.controller.ts` (function: `getDialogues`)
- **GET** `/api/curated-content/dialogues/:id` in `curated-content/curated-content.controller.ts` (function: `getDialogueById`)
- **POST** `/api/curated-content/dialogues` in `curated-content/curated-content.controller.ts` (function: `createDialogue`)
- **GET** `/api/daily-tip` in `daily-tip/daily-tip.controller.ts` (function: `getTodayTip`)
- **POST** `/api/decks` in `decks/decks.controller.ts` (function: `createDeck`)
- **GET** `/api/decks` in `decks/decks.controller.ts` (function: `getDecks`)
- **GET** `/api/decks/:id` in `decks/decks.controller.ts` (function: `getDeck`)
- **PATCH** `/api/decks/:id` in `decks/decks.controller.ts` (function: `updateDeck`)
- **DELETE** `/api/decks/:id` in `decks/decks.controller.ts` (function: `deleteDeck`)
- **POST** `/api/decks/:id/flashcards` in `decks/decks.controller.ts` (function: `addFlashcard`)
- **DELETE** `/api/decks/:id/flashcards/:flashcardId` in `decks/decks.controller.ts` (function: `removeFlashcard`)
- **GET** `/api/decks/:id/flashcards` in `decks/decks.controller.ts` (function: `getDeckFlashcards`)
- **GET** `/api/discovery/partners` in `discovery/discovery.controller.ts` (function: `findPartners`)
- **GET** `/api/discovery/partner-of-week` in `discovery/discovery.controller.ts` (function: `getPartnerOfWeek`)
- **GET** `/api/discovery/audio-intros` in `discovery/discovery.controller.ts` (function: `getAudioIntros`)
- **GET** `/api/discovery/recent-native-speakers` in `discovery/discovery.controller.ts` (function: `getRecentNativeSpeakers`)
- **GET** `/api/discovery/spotlight` in `discovery/discovery.controller.ts` (function: `getSpotlight`)
- **GET** `/api/discovery/language-pair` in `discovery/discovery.controller.ts` (function: `findByLanguagePair`)
- **GET** `/api/discovery/search-by-location` in `discovery/discovery.controller.ts` (function: `searchByLocation`)
- **GET** `/api/discovery/degradation-status` in `discovery/discovery.controller.ts` (function: `getDegradationStatus`)
- **GET** `/api/discovery/partners-with-degradation` in `discovery/discovery.controller.ts` (function: `findPartnersWithDegradation`)
- **GET** `/api/economy/catalog` in `economy/economy.controller.ts` (function: `getCatalog`)
- **GET** `/api/economy/packages` in `economy/economy.controller.ts` (function: `getPackages`)
- **GET** `/api/economy/balance` in `economy/economy.controller.ts` (function: `getBalance`)
- **POST** `/api/economy/daily-check-in` in `economy/economy.controller.ts` (function: `claimDailyCheckIn`)
- **POST** `/api/economy/create-checkout-session` in `economy/economy.controller.ts` (function: `createCheckoutSession`)
- **POST** `/api/economy/purchase-coins` in `economy/economy.controller.ts` (function: `purchaseCoins`)
- **POST** `/api/economy/send-gift` in `economy/economy.controller.ts` (function: `sendGift`)
- **GET** `/api/economy/transactions` in `economy/economy.controller.ts` (function: `getTransactions`)
- **GET** `/api/economy/sticker-packs` in `economy/economy.controller.ts` (function: `getStickerPacks`)
- **POST** `/api/economy/unlock-sticker-pack` in `economy/economy.controller.ts` (function: `unlockStickerPack`)
- **GET** `/api/economy/health` in `economy/economy.controller.ts` (function: `getHealth`)
- **POST** `/api/escrow/hold` in `escrow/escrow.controller.ts` (function: `holdCoins`)
- **POST** `/api/escrow/release` in `escrow/escrow.controller.ts` (function: `releaseCoins`)
- **POST** `/api/escrow/refund` in `escrow/escrow.controller.ts` (function: `refundCoins`)
- **POST** `/api/escrow/cancel` in `escrow/escrow.controller.ts` (function: `cancelEscrow`)
- **POST** `/api/escrow/dispute` in `escrow/escrow.controller.ts` (function: `disputeEscrow`)
- **GET** `/api/escrow/transactions` in `escrow/escrow.controller.ts` (function: `listTransactions`)
- **GET** `/api/escrow/transactions/:id` in `escrow/escrow.controller.ts` (function: `getTransaction`)
- **GET** `/api/escrow/circuit-breaker/status` in `escrow/escrow.controller.ts` (function: `getCircuitBreakerStatus`)
- **POST** `/api/escrow/circuit-breaker/reset` in `escrow/escrow.controller.ts` (function: `resetCircuitBreaker`)
- **GET** `/api/escrow/crash-reports` in `escrow/escrow.controller.ts` (function: `listCrashReports`)
- **POST** `/api/escrow/crash-reports/acknowledge` in `escrow/escrow.controller.ts` (function: `acknowledgeCrashReport`)
- **POST** `/api/escrow/crash-reports/resolve` in `escrow/escrow.controller.ts` (function: `resolveCrashReport`)
- **POST** `/api/events` in `events/events.controller.ts` (function: `create`)
- **GET** `/api/events` in `events/events.controller.ts` (function: `list`)
- **GET** `/api/events/categories` in `events/events.controller.ts` (function: `getCategories`)
- **GET** `/api/events/my` in `events/events.controller.ts` (function: `getMyEvents`)
- **GET** `/api/events/:id` in `events/events.controller.ts` (function: `getById`)
- **GET** `/api/events/:id/rsvp` in `events/events.controller.ts` (function: `getMyRsvp`)
- **POST** `/api/events/:id/rsvp` in `events/events.controller.ts` (function: `rsvp`)
- **DELETE** `/api/events/:id/rsvp` in `events/events.controller.ts` (function: `removeRsvp`)
- **POST** `/api/favourites` in `favourites/favourites.controller.ts` (function: `addFavourite`)
- **DELETE** `/api/favourites/:id` in `favourites/favourites.controller.ts` (function: `removeFavourite`)
- **GET** `/api/favourites/user/:userId` in `favourites/favourites.controller.ts` (function: `getUserFavourites`)
- **GET** `/api/flashcards/health` in `flashcards/flashcards.controller.ts` (function: `getHealth`)
- **POST** `/api/flashcards` in `flashcards/flashcards.controller.ts` (function: `createFlashcard`)
- **PATCH** `/api/flashcards/:id/srs` in `flashcards/flashcards.controller.ts` (function: `updateSrs`)
- **GET** `/api/flashcards` in `flashcards/flashcards.controller.ts` (function: `getFlashcards`)
- **GET** `/api/flashcards/due` in `flashcards/flashcards.controller.ts` (function: `getDueReviews`)
- **GET** `/api/flashcards/suggest` in `flashcards/suggest-flashcards.controller.ts` (function: `suggest`)
- **POST** `/api/groups` in `groups/groups.controller.ts` (function: `create`)
- **GET** `/api/groups` in `groups/groups.controller.ts` (function: `getGroups`)
- **GET** `/api/groups/discoverable` in `groups/groups.controller.ts` (function: `getDiscoverableGroups`)
- **GET** `/api/groups/:groupId/members` in `groups/groups.controller.ts` (function: `getMembers`)
- **GET** `/api/groups/:groupId/settings` in `groups/groups.controller.ts` (function: `getSettings`)
- **GET** `/api/groups/:groupId/announcements` in `groups/groups.controller.ts` (function: `getAnnouncements`)
- **GET** `/api/groups/mine` in `groups/groups.controller.ts` (function: `getMyAdminGroups`)
- **GET** `/api/groups/:groupId` in `groups/groups.controller.ts` (function: `getGroupInfo`)
- **POST** `/api/groups/:groupId/add-member` in `groups/groups.controller.ts` (function: `addMember`)
- **POST** `/api/groups/:groupId/remove-member` in `groups/groups.controller.ts` (function: `removeMember`)
- **POST** `/api/groups/:groupId/settings` in `groups/groups.controller.ts` (function: `updateSettings`)
- **POST** `/api/groups/:groupId/restrict-send-messages` in `groups/groups.controller.ts` (function: `restrictSendMessages`)
- **POST** `/api/groups/:groupId/restrict-edit-info` in `groups/groups.controller.ts` (function: `restrictEditInfo`)
- **POST** `/api/groups/:groupId/rename` in `groups/groups.controller.ts` (function: `renameGroup`)
- **POST** `/api/groups/:groupId/announcement` in `groups/groups.controller.ts` (function: `sendAnnouncement`)
- **POST** `/api/groups/:groupId/join` in `groups/groups.controller.ts` (function: `joinGroup`)
- **GET** `/api/groups/:groupId/resources` in `groups/groups.controller.ts` (function: `getGroupResources`)
- **DELETE** `/api/groups/:groupId/resources/:resourceId` in `groups/groups.controller.ts` (function: `deleteGroupResource`)
- **GET** `/api/help/articles` in `help/help.controller.ts` (function: `getArticles`)
- **GET** `/api/help/categories` in `help/help.controller.ts` (function: `getCategories`)
- **GET** `/api/help/quick-replies` in `help/help.controller.ts` (function: `getQuickReplies`)
- **GET** `/api/hobby-tags` in `hobby-tags/hobby-tags.controller.ts` (function: `getAllTags`)
- **POST** `/api/hobby-tags` in `hobby-tags/hobby-tags.controller.ts` (function: `createGlobalTag`)
- **GET** `/api/hobby-tags/my` in `hobby-tags/hobby-tags.controller.ts` (function: `getMyTags`)
- **POST** `/api/hobby-tags/my` in `hobby-tags/hobby-tags.controller.ts` (function: `addTag`)
- **DELETE** `/api/hobby-tags/my/:hobbyTagId` in `hobby-tags/hobby-tags.controller.ts` (function: `removeTag`)
- **PATCH** `/api/hobby-tags/my/:hobbyTagId` in `hobby-tags/hobby-tags.controller.ts` (function: `updateProficiency`)
- **GET** `/api/hobby-tags/vocabulary` in `hobby-tags/hobby-tags.controller.ts` (function: `getVocabulary`)
- **GET** `/api/host-dashboard/:roomId/stats` in `host-dashboard/host-dashboard.controller.ts` (function: `getStats`)
- **GET** `/api/interests` in `interests/interests.controller.ts` (function: `listInterests`)
- **POST** `/api/interests/select` in `interests/interests.controller.ts` (function: `selectInterests`)
- **POST** `/api/language-challenges` in `language-challenges/language-challenges.controller.ts` (function: `create`)
- **GET** `/api/language-challenges` in `language-challenges/language-challenges.controller.ts` (function: `list`)
- **POST** `/api/language-challenges/:id/join` in `language-challenges/language-challenges.controller.ts` (function: `join`)
- **POST** `/api/language-challenges/:id/daily-checkin` in `language-challenges/language-challenges.controller.ts` (function: `dailyCheckin`)
- **POST** `/api/language-challenges/:id/claim` in `language-challenges/language-challenges.controller.ts` (function: `claim`)
- **GET** `/api/language-islands` in `language-islands/language-islands.controller.ts` (function: `list`)
- **GET** `/api/language-islands/my` in `language-islands/language-islands.controller.ts` (function: `getMyIslands`)
- **GET** `/api/language-islands/:id` in `language-islands/language-islands.controller.ts` (function: `getById`)
- **POST** `/api/language-islands` in `language-islands/language-islands.controller.ts` (function: `create`)
- **PATCH** `/api/language-islands/:id` in `language-islands/language-islands.controller.ts` (function: `update`)
- **DELETE** `/api/language-islands/:id` in `language-islands/language-islands.controller.ts` (function: `remove`)
- **POST** `/api/language-islands/:id/join` in `language-islands/language-islands.controller.ts` (function: `join`)
- **POST** `/api/language-islands/:id/leave` in `language-islands/language-islands.controller.ts` (function: `leave`)
- **GET** `/api/leaderboard/top-correctors` in `leaderboard/leaderboard.controller.ts` (function: `getTopCorrectors`)
- **GET** `/api/legal/terms` in `legal/legal.controller.ts` (function: `getTerms`)
- **GET** `/api/legal/privacy` in `legal/legal.controller.ts` (function: `getPrivacy`)
- **GET** `/api/admin/lessons` in `lessons/lessons.controller.ts` (function: `list`)
- **GET** `/api/admin/lessons/:id` in `lessons/lessons.controller.ts` (function: `get`)
- **POST** `/api/admin/lessons` in `lessons/lessons.controller.ts` (function: `create`)
- **PATCH** `/api/admin/lessons/:id` in `lessons/lessons.controller.ts` (function: `update`)
- **DELETE** `/api/admin/lessons/:id` in `lessons/lessons.controller.ts` (function: `remove`)
- **GET** `/api/link-preview` in `link-preview/link-preview.controller.ts` (function: `getPreview`)
- **GET** `/api/users/me/linked-accounts` in `linked-accounts/linked-accounts.controller.ts` (function: `getLinkedAccounts`)
- **POST** `/api/users/me/linked-accounts/link` in `linked-accounts/linked-accounts.controller.ts` (function: `linkAccount`)
- **POST** `/api/users/me/linked-accounts/unlink` in `linked-accounts/linked-accounts.controller.ts` (function: `unlinkAccount`)
- **POST** `/api/livekit/token` in `livekit/livekit.controller.ts` (function: `getToken`)
- **POST** `/api/location/:userId/current` in `location/location.controller.ts` (function: `setCurrentLocation`)
- **GET** `/api/location/:userId/current` in `location/location.controller.ts` (function: `getCurrentLocation`)
- **POST** `/api/location/:userId/live/start` in `location/location.controller.ts` (function: `startLiveShare`)
- **POST** `/api/location/:userId/live/update` in `location/location.controller.ts` (function: `updateLiveLocation`)
- **DELETE** `/api/location/:userId/live` in `location/location.controller.ts` (function: `stopLiveShare`)
- **GET** `/api/location/:userId/live` in `location/location.controller.ts` (function: `getLiveLocation`)
- **POST** `/api/media/cover/presigned-url` in `media/media.controller.ts` (function: `getCoverPresignedUrl`)
- **POST** `/api/media/voice-note` in `media/media.controller.ts` (function: `uploadVoiceNote`)
- **POST** `/api/media/cover/confirm` in `media/media.controller.ts` (function: `confirmCoverUpload`)
- **POST** `/api/media/cover/upload` in `media/media.controller.ts` (function: `uploadCoverImage`)
- **POST** `/api/media/avatar/upload` in `media/media.controller.ts` (function: `uploadAvatarImage`)
- **POST** `/api/media/view-once/mark-viewed` in `media/media.controller.ts` (function: `markMediaAsViewed`)
- **GET** `/api/metrics` in `metrics/metrics.controller.ts` (function: `getMetrics`)
- **POST** `/api/milestones` in `milestones/milestones.controller.ts` (function: `create`)
- **GET** `/api/milestones` in `milestones/milestones.controller.ts` (function: `findAll`)
- **GET** `/api/milestones/progress` in `milestones/milestones.controller.ts` (function: `getProgress`)
- **GET** `/api/milestones/:id` in `milestones/milestones.controller.ts` (function: `findOne`)
- **POST** `/api/milestones/:id/complete` in `milestones/milestones.controller.ts` (function: `markCompleted`)
- **DELETE** `/api/milestones/:id` in `milestones/milestones.controller.ts` (function: `remove`)
- **GET** `/api/moderation/items` in `moderation/moderation.controller.ts` (function: `getItems`)
- **POST** `/api/moderation/report` in `moderation/moderation.controller.ts` (function: `reportUser`)
- **POST** `/api/moderation/approve` in `moderation/moderation.controller.ts` (function: `approve`)
- **POST** `/api/moderation/reject` in `moderation/moderation.controller.ts` (function: `reject`)
- **GET** `/api/moderation/analyse/:userId` in `moderation/moderation.controller.ts` (function: `analyseUser`)
- **POST** `/api/moments` in `moments/moments.controller.ts` (function: `createMoment`)
- **GET** `/api/moments/feed` in `moments/moments.controller.ts` (function: `getFeed`)
- **GET** `/api/moments/lifetime-counts` in `moments/moments.controller.ts` (function: `getLifetimeCounts`)
- **GET** `/api/moments/stories` in `moments/moments.controller.ts` (function: `getActiveStories`)
- **POST** `/api/moments/upload-voice` in `moments/moments.controller.ts` (function: `uploadVoice`)
- **POST** `/api/moments/upload-media` in `moments/moments.controller.ts` (function: `uploadMedia`)
- **POST** `/api/moments/stories` in `moments/moments.controller.ts` (function: `createStory`)
- **POST** `/api/moments/language-questions` in `moments/moments.controller.ts` (function: `createLanguageQuestion`)
- **POST** `/api/moments/:id/answer` in `moments/moments.controller.ts` (function: `answerLanguageQuestion`)
- **GET** `/api/moments/questions` in `moments/moments.controller.ts` (function: `getQuestions`)
- **POST** `/api/moments/:id/like` in `moments/moments.controller.ts` (function: `likeMoment`)
- **POST** `/api/moments/:id/comments` in `moments/moments.controller.ts` (function: `addComment`)
- **POST** `/api/moments/:id/comments/:commentId/vote` in `moments/moments.controller.ts` (function: `voteOnCorrection`)
- **GET** `/api/moments/:id/comments` in `moments/moments.controller.ts` (function: `getComments`)
- **PATCH** `/api/moments/:id/edit-text` in `moments/moments.controller.ts` (function: `editMomentText`)
- **PATCH** `/api/moments/:id/pin` in `moments/moments.controller.ts` (function: `pinMoment`)
- **POST** `/api/monetisation/webhooks/apple` in `monetisation/apple-notification.controller.ts` (function: `handleNotification`)
- **POST** `/api/monetisation/webhooks/google` in `monetisation/google-play-notification.controller.ts` (function: `handleNotification`)
- **POST** `/api/monetisation/webhooks/stripe` in `monetisation/monetisation.controller.ts` (function: `handleStripeWebhook`)
- **POST** `/api/monetisation/webhooks/apple` in `monetisation/monetisation.controller.ts` (function: `handleAppleWebhook`)
- **POST** `/api/monetisation/webhooks/google` in `monetisation/monetisation.controller.ts` (function: `handleGoogleWebhook`)
- **POST** `/api/monetisation/generate-api-key` in `monetisation/monetisation.controller.ts` (function: `generateApiKey`)
- **GET** `/api/monetisation/analytics` in `monetisation/monetisation.controller.ts` (function: `getAnalytics`)
- **GET** `/api/monetisation/diagnostics/logs` in `monetisation/monetisation.controller.ts` (function: `getDiagnosticLogs`)
- **POST** `/api/monetisation/diagnostics/logs` in `monetisation/monetisation.controller.ts` (function: `createDiagnosticLog`)
- **POST** `/api/monetisation/validate-apple-receipt` in `monetisation/monetisation.controller.ts` (function: `validateAppleReceipt`)
- **POST** `/api/monetisation/create-checkout-session` in `monetisation/monetisation.controller.ts` (function: `createCheckoutSession`)
- **POST** `/api/monetisation/restore-purchases` in `monetisation/monetisation.controller.ts` (function: `restorePurchases`)
- **GET** `/api/monetisation/coins-balance` in `monetisation/monetisation.controller.ts` (function: `getCoinsBalance`)
- **GET** `/api/monetisation/subscription` in `monetisation/monetisation.controller.ts` (function: `getSubscription`)
- **POST** `/api/monetisation/subscription/cancel` in `monetisation/monetisation.controller.ts` (function: `cancelSubscription`)
- **POST** `/api/monetisation/subscription/resume` in `monetisation/monetisation.controller.ts` (function: `resumeSubscription`)
- **GET** `/api/monetisation/subscription/invoices` in `monetisation/monetisation.controller.ts` (function: `getInvoices`)
- **POST** `/api/monetisation/subscription/billing-portal` in `monetisation/monetisation.controller.ts` (function: `createBillingPortalSession`)
- **POST** `/api/nlp/detect-language` in `nlp/nlp.controller.ts` (function: `detectLanguage`)
- **POST** `/api/nlp/translate` in `nlp/nlp.controller.ts` (function: `translate`)
- **POST** `/api/nlp/translate-ui` in `nlp/nlp.controller.ts` (function: `translateUi`)
- **POST** `/api/nlp/grammar-check` in `nlp/nlp.controller.ts` (function: `grammarCheck`)
- **POST** `/api/nlp/explain-grammar` in `nlp/nlp.controller.ts` (function: `explainGrammar`)
- **POST** `/api/nlp/pronunciation-score` in `nlp/nlp.controller.ts` (function: `pronunciationScore`)
- **POST** `/api/nlp/simplify` in `nlp/nlp.controller.ts` (function: `simplify`)
- **POST** `/api/nlp/translate-and-correct` in `nlp/nlp.controller.ts` (function: `translateAndCorrect`)
- **POST** `/api/nlp/translate-bio` in `nlp/nlp.controller.ts` (function: `translateBio`)
- **POST** `/api/nlp/transcribe-audio` in `nlp/nlp.controller.ts` (function: `transcribeAudio`)
- **GET** `/api/notification-preferences` in `notification-preferences/notification-preferences.controller.ts` (function: `getPreferences`)
- **PUT** `/api/notification-preferences` in `notification-preferences/notification-preferences.controller.ts` (function: `updatePreferences`)
- **POST** `/api/notification-preferences/reset` in `notification-preferences/notification-preferences.controller.ts` (function: `resetToDefaults`)
- **GET** `/api/notification-preferences` in `notifications/notification-preferences.controller.ts` (function: `getPreferences`)
- **PUT** `/api/notification-preferences` in `notifications/notification-preferences.controller.ts` (function: `updatePreferences`)
- **POST** `/api/notification-preferences/reset` in `notifications/notification-preferences.controller.ts` (function: `resetPreferences`)
- **PATCH** `/api/notification-preferences/:category/:channel` in `notifications/notification-preferences.controller.ts` (function: `toggleCategoryChannel`)
- **GET** `/api/notifications` in `notifications/notifications.controller.ts` (function: `getNotifications`)
- **GET** `/api/notifications/unread-count` in `notifications/notifications.controller.ts` (function: `getUnreadCount`)
- **GET** `/api/notifications/preferences` in `notifications/notifications.controller.ts` (function: `getPreferences`)
- **PUT** `/api/notifications/preferences` in `notifications/notifications.controller.ts` (function: `updatePreferences`)
- **PATCH** `/api/notifications/read-all` in `notifications/notifications.controller.ts` (function: `markAllAsRead`)
- **PATCH** `/api/notifications/:id/read` in `notifications/notifications.controller.ts` (function: `markAsRead`)
- **POST** `/api/auth/request-password-reset` in `password-reset/password-reset.controller.ts` (function: `requestPasswordReset`)
- **POST** `/api/auth/reset-password` in `password-reset/password-reset.controller.ts` (function: `resetPassword`)
- **POST** `/api/proficiency/assess` in `proficiency/proficiency.controller.ts` (function: `assess`)
- **POST** `/api/proficiency/languages` in `proficiency/proficiency.controller.ts` (function: `setLanguages`)
- **POST** `/api/profile-visits/:viewedId` in `profile-visits/profile-visits.controller.ts` (function: `recordVisit`)
- **GET** `/api/profile-visits/my-visitors` in `profile-visits/profile-visits.controller.ts` (function: `getMyVisitors`)
- **POST** `/api/pronunciation/feedback` in `pronunciation/pronunciation.controller.ts` (function: `getFeedback`)
- **POST** `/api/pronunciation/voice-feedback` in `pronunciation/pronunciation.controller.ts` (function: `submitVoiceFeedback`)
- **GET** `/api/quests` in `quests/quests.controller.ts` (function: `getQuests`)
- **GET** `/api/quiz/questions` in `quiz/quiz.controller.ts` (function: `getQuestions`)
- **POST** `/api/reading/resources` in `reading-engine/reading-engine.controller.ts` (function: `createResource`)
- **GET** `/api/reading/resources` in `reading-engine/reading-engine.controller.ts` (function: `listResources`)
- **GET** `/api/reading/resources/:id` in `reading-engine/reading-engine.controller.ts` (function: `getResource`)
- **PUT** `/api/reading/resources/:id` in `reading-engine/reading-engine.controller.ts` (function: `updateResource`)
- **DELETE** `/api/reading/resources/:id` in `reading-engine/reading-engine.controller.ts` (function: `deleteResource`)
- **GET** `/api/reading/resources/:id/tokenise` in `reading-engine/reading-engine.controller.ts` (function: `tokenise`)
- **GET** `/api/reading/progress` in `reading-engine/reading-engine.controller.ts` (function: `getProgress`)
- **POST** `/api/reading/progress/session` in `reading-engine/reading-engine.controller.ts` (function: `recordSession`)
- **DELETE** `/api/reading/cache/user` in `reading-engine/reading-engine.controller.ts` (function: `clearUserCache`)
- **GET** `/api/recommendations/for-you` in `recommendations/recommendations.controller.ts` (function: `getForYou`)
- **GET** `/api/recommendations/daily` in `recommendations/recommendations.controller.ts` (function: `getDaily`)
- **POST** `/api/resource-library` in `resource-library/resource-library.controller.ts` (function: `create`)
- **GET** `/api/resource-library` in `resource-library/resource-library.controller.ts` (function: `findAll`)
- **GET** `/api/resource-library/:id` in `resource-library/resource-library.controller.ts` (function: `findOne`)
- **PATCH** `/api/resource-library/:id` in `resource-library/resource-library.controller.ts` (function: `update`)
- **DELETE** `/api/resource-library/:id` in `resource-library/resource-library.controller.ts` (function: `remove`)
- **GET** `/api/safety/report-categories` in `safety/safety.controller.ts` (function: `getReportCategories`)
- **POST** `/api/safety/block` in `safety/safety.controller.ts` (function: `blockUser`)
- **POST** `/api/safety/unblock` in `safety/safety.controller.ts` (function: `unblockUser`)
- **GET** `/api/safety/blocked-ids` in `safety/safety.controller.ts` (function: `getBlockedIds`)
- **GET** `/api/safety/blocked-users` in `safety/safety.controller.ts` (function: `getBlockedUsers`)
- **GET** `/api/safety/blocked-ids/:userId` in `safety/safety.controller.ts` (function: `getBlockedUserIds`)
- **GET** `/api/safety/blocker-ids/:userId` in `safety/safety.controller.ts` (function: `getBlockerUserIds`)
- **GET** `/api/safety/is-blocked/:blockedId` in `safety/safety.controller.ts` (function: `isBlocked`)
- **POST** `/api/safety/block/:blockedId` in `safety/safety.controller.ts` (function: `blockUserByParam`)
- **POST** `/api/safety/unblock/:blockedId` in `safety/safety.controller.ts` (function: `unblockUserByParam`)
- **GET** `/api/safety/blocked-and-blocker-ids/:userId` in `safety/safety.controller.ts` (function: `getBlockedAndBlockerIds`)
- **GET** `/api/safety/blocked-users-details` in `safety/safety.controller.ts` (function: `getBlockedUserDetails`)
- **GET** `/api/cart` in `shopping/cart.controller.ts` (function: `getCart`)
- **POST** `/api/cart/add` in `shopping/cart.controller.ts` (function: `addItem`)
- **POST** `/api/cart/remove` in `shopping/cart.controller.ts` (function: `removeItem`)
- **POST** `/api/cart/checkout` in `shopping/cart.controller.ts` (function: `checkout`)
- **GET** `/api/shopping/catalog` in `shopping/shopping.controller.ts` (function: `getCatalog`)
- **GET** `/api/shopping/items/:id` in `shopping/shopping.controller.ts` (function: `getItem`)
- **GET** `/api/shopping/cart` in `shopping/shopping.controller.ts` (function: `getCart`)
- **POST** `/api/shopping/cart` in `shopping/shopping.controller.ts` (function: `addToCart`)
- **DELETE** `/api/shopping/cart` in `shopping/shopping.controller.ts` (function: `removeFromCart`)
- **POST** `/api/shopping/cart/checkout` in `shopping/shopping.controller.ts` (function: `checkout`)
- **POST** `/api/spam-detection/check` in `spam-detection/spam-detection.controller.ts` (function: `check`)
- **GET** `/api/stats/me` in `stats/stats.controller.ts` (function: `getMyStats`)
- **POST** `/api/study-buddies/request` in `study-buddies/study-buddies.controller.ts` (function: `requestBuddy`)
- **GET** `/api/study-buddies/requests` in `study-buddies/study-buddies.controller.ts` (function: `getIncomingRequests`)
- **POST** `/api/study-buddies/requests/:id/accept` in `study-buddies/study-buddies.controller.ts` (function: `acceptRequest`)
- **POST** `/api/study-buddies/requests/:id/decline` in `study-buddies/study-buddies.controller.ts` (function: `declineRequest`)
- **GET** `/api/study-buddies/matches` in `study-buddies/study-buddies.controller.ts` (function: `getMatches`)
- **POST** `/api/study-buddies/follow` in `study-buddies/study-buddies.controller.ts` (function: `followUser`)
- **DELETE** `/api/study-buddies/unfollow` in `study-buddies/study-buddies.controller.ts` (function: `unfollowUser`)
- **GET** `/api/study-buddies/channel` in `study-buddies/study-buddies.controller.ts` (function: `getChannel`)
- **GET** `/api/study-streak/me` in `study-streak/study-streak.controller.ts` (function: `getMyStreak`)
- **POST** `/api/study-streak/checkin` in `study-streak/study-streak.controller.ts` (function: `checkin`)
- **GET** `/api/study-streak/health` in `study-streak/study-streak.controller.ts` (function: `health`)
- **POST** `/api/transfer/generate` in `transfer/transfer.controller.ts` (function: `generate`)
- **GET** `/api/transfer/consume` in `transfer/transfer.controller.ts` (function: `consume`)
- **POST** `/api/two-factor/enable` in `two-factor/two-factor.controller.ts` (function: `enable`)
- **POST** `/api/two-factor/verify` in `two-factor/two-factor.controller.ts` (function: `verify`)
- **POST** `/api/two-factor/disable` in `two-factor/two-factor.controller.ts` (function: `disable`)
- **GET** `/api/two-factor/status` in `two-factor/two-factor.controller.ts` (function: `status`)
- **GET** `/api/user-statistics/:userId` in `user-statistics/user-statistics.controller.ts` (function: `getStatistics`)
- **POST** `/api/generate-device-link` in `users/device-link.controller.ts` (function: `generate`)
- **DELETE** `/api/users/me` in `users/users.controller.ts` (function: `deleteMyAccount`)
- **DELETE** `/api/users/me/permanent` in `users/users.controller.ts` (function: `permanentlyDeleteMyAccount`)
- **POST** `/api/users/me/restore` in `users/users.controller.ts` (function: `restoreMyAccount`)
- **GET** `/api/users/me/export` in `users/users.controller.ts` (function: `exportMyData`)
- **GET** `/api/users/me/notification-preferences` in `users/users.controller.ts` (function: `getMyNotificationPreferences`)
- **GET** `/api/users/me` in `users/users.controller.ts` (function: `getMyProfile`)
- **GET** `/api/users/me/stats` in `users/users.controller.ts` (function: `getMyStats`)
- **GET** `/api/users/me/xp` in `users/users.controller.ts` (function: `getMyXp`)
- **POST** `/api/users/me/assess-proficiency` in `users/users.controller.ts` (function: `assessProficiency`)
- **PATCH** `/api/users/me` in `users/users.controller.ts` (function: `updateMyProfile`)
- **PATCH** `/api/users/me/greeting` in `users/users.controller.ts` (function: `updateGreetingMessage`)
- **PATCH** `/api/users/me/away` in `users/users.controller.ts` (function: `updateAwayMessage`)
- **POST** `/api/users/me/cover-photo/presigned-url` in `users/users.controller.ts` (function: `getCoverPhotoPresignedUrl`)
- **PATCH** `/api/users/me/cover-photo` in `users/users.controller.ts` (function: `updateCoverPhoto`)
- **POST** `/api/users/me/avatar/presigned-url` in `users/users.controller.ts` (function: `getAvatarPresignedUrl`)
- **GET** `/api/users/me/visitors` in `users/users.controller.ts` (function: `getMyVisitors`)
- **GET** `/api/users/status/:statusId/viewers` in `users/users.controller.ts` (function: `getStatusViewers`)
- **GET** `/api/users/me/status-viewers` in `users/users.controller.ts` (function: `getMyStatusViewers`)
- **GET** `/api/users/hobbies` in `users/users.controller.ts` (function: `getAvailableHobbies`)
- **GET** `/api/users/interests` in `users/users.controller.ts` (function: `getAvailableInterests`)
- **GET** `/api/users/search` in `users/users.controller.ts` (function: `searchUsers`)
- **GET** `/api/users/me/badges` in `users/users.controller.ts` (function: `getMyBadges`)
- **GET** `/api/users/:id` in `users/users.controller.ts` (function: `getUserProfile`)
- **GET** `/api/users/:id/stats` in `users/users.controller.ts` (function: `getUserStats`)
- **GET** `/api/users/:id/followers` in `users/users.controller.ts` (function: `getFollowers`)
- **GET** `/api/users/:id/following` in `users/users.controller.ts` (function: `getFollowing`)
- **POST** `/api/users/:id/follow` in `users/users.controller.ts` (function: `followUser`)
- **DELETE** `/api/users/:id/follow` in `users/users.controller.ts` (function: `unfollowUser`)
- **POST** `/api/users/block/:id` in `users/users.controller.ts` (function: `blockUser`)
- **DELETE** `/api/users/block/:id` in `users/users.controller.ts` (function: `unblockUser`)
- **POST** `/api/users/report` in `users/users.controller.ts` (function: `reportUser`)
- **GET** `/api/users/me/privacy-settings` in `users/users.controller.ts` (function: `getMyPrivacySettings`)
- **GET** `/api/users/me/message-filters` in `users/users.controller.ts` (function: `getMyMessageFilters`)
- **PUT** `/api/users/me/message-filters` in `users/users.controller.ts` (function: `setMyMessageFilters`)
- **PATCH** `/api/users/me/privacy` in `users/users.controller.ts` (function: `updatePrivacySettings`)
- **GET** `/api/users/me/business` in `users/users.controller.ts` (function: `getMyBusinessProfile`)
- **PATCH** `/api/users/me/business` in `users/users.controller.ts` (function: `updateMyBusinessProfile`)
- **PATCH** `/api/users/me/dnd` in `users/users.controller.ts` (function: `setDoNotDisturb`)
- **PATCH** `/api/users/me/status-visibility` in `users/users.controller.ts` (function: `updateStatusVisibility`)
- **POST** `/api/users/me/contact-sharing` in `users/users.controller.ts` (function: `shareContact`)
- **PATCH** `/api/users/me/notification-preferences` in `users/users.controller.ts` (function: `updateNotificationPreferences`)
- **GET** `/api/version` in `version/version.controller.ts` (function: `getVersion`)
- **GET** `/api/version/minimum` in `version/version.controller.ts` (function: `getMinimumSupportedVersion`)
- **POST** `/api/video-calls/start` in `video-calls/video-calls.controller.ts` (function: `startCall`)
- **POST** `/api/video-calls/accept` in `video-calls/video-calls.controller.ts` (function: `acceptCall`)
- **GET** `/api/video-calls/health` in `video-calls/video-calls.controller.ts` (function: `health`)
- **GET** `/api/word-of-the-day` in `word-of-the-day/word-of-the-day.controller.ts` (function: `findOne`)
- **GET** `/api/xp` in `xp/xp.controller.ts` (function: `getXp`)
- **GET** `/api/xp/history` in `xp/xp.controller.ts` (function: `getXpHistory`)
- **GET** `/api/xp/activities` in `xp/xp.controller.ts` (function: `getActivityPoints`)
- **GET** `/api/chat/quick-replies` in `chat/quick-replies/quick-replies.controller.ts` (function: `getQuickReplies`)
- **POST** `/api/chat/quick-replies` in `chat/quick-replies/quick-replies.controller.ts` (function: `createQuickReply`)
- **GET** `/api/user-interests/tags` in `modules/user-interests/user-interests.controller.ts` (function: `getUserInterests`)
- **POST** `/api/user-interests/tags` in `modules/user-interests/user-interests.controller.ts` (function: `updateUserInterests`)
- **GET** `/api/user-interests/vocabulary` in `modules/user-interests/user-interests.controller.ts` (function: `getVocabulary`)
- **POST** `/api/stripe/webhook` in `monetisation/controllers/stripe.controller.ts` (function: `handleWebhook`)
- **GET** `/api/subscription-plans` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getAllPlans`)
- **GET** `/api/subscription-plans/popular` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getPopularPlan`)
- **GET** `/api/subscription-plans/free` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getFreePlan`)
- **GET** `/api/subscription-plans/paid` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getPaidPlans`)
- **GET** `/api/subscription-plans/:id` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getPlanById`)
- **GET** `/api/subscription-plans/:id/benefits` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getHighlightedBenefits`)
- **GET** `/api/subscription-plans/showcase` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getShowcasePlans`)

## Backend API Map

| Method | Path | Controller | Service | Req DTO | Res Model |
|---|---|---|---|---|---|
| GET | /api | app.controller.ts | appService | None | string |
| GET | /api/health | app.controller.ts | Unknown | None | { status: string } |
| GET | /api/achievements | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /api/achievements/user/:userId | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /api/achievements/full/:userId | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /api/achievements/my | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| POST | /api/achievements/evaluate | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| POST | /api/achievements/evaluate/:userId | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /api/admin/v1/logs | admin/admin-operational-events-v1.controller.ts | events | AdminOperationalEventsQueryDto | AdminOperationalEventsResult |
| GET | /api/admin/v1/roles/assignments | admin/admin-roles-v1.controller.ts | assignments | AdminRoleAssignmentsQueryDto | AdminRoleAssignmentsListResult |
| GET | /api/admin/v1/me | admin/admin-v1.controller.ts | authorization | None | Unknown |
| GET | /api/admin/v1/roles | admin/admin-v1.controller.ts | roleInventory | None | AdminRoleInventoryEntry[] |
| GET | /api/admin/v1/system/health | admin/admin-v1.controller.ts | systemHealth | None | AdminSystemHealthSnapshot |
| GET | /api/admin/v1/audit | admin/admin-v1.controller.ts | auditQuery | AdminAuditQueryDto | AdminAuditListResult |
| GET | /api/admin/v1/moderation/reports | admin/admin-v1.controller.ts | moderationQuery | AdminReportsQueryDto | AdminReportsListResult |
| GET | /api/admin/v1/users | admin/admin-v1.controller.ts | adminService | AdminUserQueryDto | AdminUserListResult |
| GET | /api/admin/v1/users/:id/login-history | admin/admin-v1.controller.ts | loginHistoryQuery | None | LoginHistoryEntry[] |
| GET | /api/admin/v1/users/:id | admin/admin-v1.controller.ts | userDetailService | None | AdminUserSummary |
| GET | /api/admin/users | admin/admin.controller.ts | adminService | AdminUserQueryDto | AdminUserListResult |
| PATCH | /api/admin/users/:id/vip | admin/admin.controller.ts | adminService | ToggleVipDto | AdminUserSummary |
| GET | /api/admin/users/:id/login-history | admin/admin.controller.ts | adminService | None | LoginHistoryEntry[] |
| POST | /api/admin/users/:id/ban | admin/admin.controller.ts | adminService | None | { message: string } |
| POST | /api/admin/users/:id/warn | admin/admin.controller.ts | adminService | None | { message: string } |
| GET | /api/admin/blocks | admin/admin.controller.ts | adminService | string | AdminBlocksListResult |
| GET | /api/admin/reports | admin/admin.controller.ts | adminService | string | AdminReportsListResult |
| DELETE | /api/admin/blocks/:blockId | admin/admin.controller.ts | adminService | None | { success: boolean } |
| GET | /api/ai-conversation/scenarios | ai-conversation/ai-conversation.controller.ts | aiConversationService | None | Unknown |
| POST | /api/ai-conversation/message | ai-conversation/ai-conversation.controller.ts | aiConversationService | {
      message: string;
      scenarioId?: string;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    } | { reply: string } |
| POST | /api/analytics/client-error | analytics/analytics.controller.ts | analyticsService | ClientErrorDto | { status: string } |
| GET | /api/assessments/questions | assessments/assessments.controller.ts | assessmentsService | string | Unknown |
| GET | /api/audio-intro/:userId | audio-intro/audio-intro.controller.ts | audioIntroService | None | Unknown |
| PATCH | /api/audio-intro/:userId | audio-intro/audio-intro.controller.ts | audioIntroService | UpdateAudioIntroDto | Unknown |
| POST | /api/audio-intro/presigned-upload | audio-intro/audio-intro.controller.ts | audioIntroService | { filename: string; contentType: string } | Unknown |
| GET | /api/audio-rooms/health | audio-rooms/audio-rooms-health.controller.ts | healthService | None | DegradationState |
| GET | /api/audio-rooms/preview/:id | audio-rooms/audio-rooms-preview.controller.ts | audioRoomsService | None | RoomPreviewDto |
| POST | /api/audio-rooms/create | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreateAudioRoomDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/archive-recording | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ArchiveRecordingDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/token | audio-rooms/audio-rooms.controller.ts | audioRoomsService | AudioRoomTokenDto | RoomTokenResponse | null |
| GET | /api/audio-rooms/list | audio-rooms/audio-rooms.controller.ts | audioRoomsService | string | AudioRoomRecord[] |
| GET | /api/audio-rooms/by-language | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None |
    Array<{
      language_pair: string;
      count: number;
      rooms: AudioRoomRecord[];
    }>
   |
| GET | /api/audio-rooms/topics | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | string[] |
| GET | /api/audio-rooms/levels | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | string[] |
| GET | /api/audio-rooms/private | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | AudioRoomRecord[] |
| GET | /api/audio-rooms/call-logs | audio-rooms/audio-rooms.controller.ts | audioRoomsService | GetCallLogsQueryDto | CallLogRecord[] |
| GET | /api/audio-rooms/exclusive-emojis | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | {
    emojiId: string;
    name: string;
    animationUrl: string;
  }[] |
| GET | /api/audio-rooms/:id | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | AudioRoomRecord |
| GET | /api/audio-rooms/:id/stage | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | StageInfo |
| POST | /api/audio-rooms/:id/stage/reorder | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ReorderStageDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/:id/stage/clear | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | AudioRoomRecord | null |
| POST | /api/audio-rooms/language-parties | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreateLanguagePartyDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/private | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreatePrivatePartyDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/raise-hand | audio-rooms/audio-rooms.controller.ts | audioRoomsService | RaiseHandDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/approve-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ApproveSpeakerDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/mute-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DemoteSpeakerDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/kick-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DemoteSpeakerDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/demote-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DemoteSpeakerDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/dismiss-raised-hand | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DismissRaisedHandDto | void |
| POST | /api/audio-rooms/invite-co-host | audio-rooms/audio-rooms.controller.ts | audioRoomsService | InviteCoHostDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/remove-co-host | audio-rooms/audio-rooms.controller.ts | audioRoomsService | RemoveCoHostDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/captions | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SendCaptionDto | CaptionRecord | null |
| POST | /api/audio-rooms/ai-captions | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SendCaptionDto | void |
| POST | /api/audio-rooms/archive | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ArchiveRoomDto | AudioRoomRecord | null |
| POST | /api/audio-rooms/:roomId/notes | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreateVoiceRoomNoteDto | VoiceRoomNote | null |
| GET | /api/audio-rooms/:roomId/notes | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | VoiceRoomNote[] |
| DELETE | /api/audio-rooms/:roomId/notes/:noteId | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | void |
| GET | /api/audio-rooms/:id/transcript | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | {
    recording_url: string | null;
    transcript_text: string | null;
    session_summary: string | null;
    vocabulary: string[];
  } |
| POST | /api/audio-rooms/:roomId/polls | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreatePollDto | { poll_id: string } | null |
| POST | /api/audio-rooms/polls/vote | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SubmitVoteDto | void |
| GET | /api/audio-rooms/:roomId/polls/:pollId | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | {
    question: string;
    options: string[];
    votes: number[];
    totalVotes: number;
  } |
| GET | /api/audio-rooms/soundboard/list | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | { sounds: SoundboardSound[] } |
| POST | /api/audio-rooms/soundboard/play | audio-rooms/audio-rooms.controller.ts | audioRoomsService | PlaySoundDto | { success: boolean; soundUrl: string | null } | null |
| POST | /api/audio-rooms/:roomId/reactions | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SendReactionDto | { emojiId: string; animationUrl: string } | null |
| POST | /api/audio-rooms/:roomId/tip | audio-rooms/audio-rooms.controller.ts | audioRoomsService | TipHostDto | {
    tip_id: string;
    amount_coins: number;
    receiver_id: string;
    receiver_new_balance: number;
  } | null |
| POST | /api/auth/change-password | auth/auth.controller.ts | authService | ChangePasswordDto | Unknown |
| POST | /api/auth/two-factor/enable | auth/auth.controller.ts | authService | None | { secret: string; qrCodeUrl: string } |
| POST | /api/auth/two-factor/verify | auth/auth.controller.ts | authService | string | { success: boolean } |
| POST | /api/auth/two-factor/disable | auth/auth.controller.ts | authService | string | { success: boolean } |
| GET | /api/auth/two-factor/status | auth/auth.controller.ts | authService | None | { enabled: boolean } |
| POST | /api/auth/transfer/generate | auth/auth.controller.ts | transferService | None | { url: string } |
| POST | /api/auth/transfer/consume | auth/auth.controller.ts | transferService | string | { swapToken: string } |
| POST | /api/auth/transfer/swap | auth/auth.controller.ts | transferService | string | {
    access_token: string;
    refresh_token: string;
    user_id: string;
  } |
| GET | /api/blocks | blocks/blocks.controller.ts | blocksService | None | Unknown |
| POST | /api/blocks | blocks/blocks.controller.ts | blocksService | { blocked_id: string } | Unknown |
| DELETE | /api/blocks/:blockedId | blocks/blocks.controller.ts | blocksService | None | Unknown |
| POST | /api/calls/initiate | calls/calls.controller.ts | callsService | InitiateCallDto | Unknown |
| POST | /api/calls/group | calls/calls.controller.ts | callsService | CreateGroupCallDto | Unknown |
| GET | /api/calls/active | calls/calls.controller.ts | callsService | None | Unknown |
| GET | /api/calls/active/:room_name | calls/calls.controller.ts | callsService | None | Unknown |
| GET | /api/calls/waiting | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /api/calls/switch | calls/calls.controller.ts | callsService | SwitchCallDto | Unknown |
| PUT | /api/calls/:room_name/accept-waiting | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /api/calls/:room_name/hold | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /api/calls/:room_name/resume | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /api/calls/:room_name/leave | calls/calls.controller.ts | callsService | None | Unknown |
| GET | /api/chat/settings | chat/chat-settings.controller.ts | settingsService | None | ChatSettingsDto |
| PUT | /api/chat/settings | chat/chat-settings.controller.ts | settingsService | ChatSettingsDto | ChatSettingsDto |
| POST | /api/chat/token | chat/chat.controller.ts | centrifugoService | None | { token: string } | null |
| POST | /api/chat/messages | chat/chat.controller.ts | chatService | SendMessageDto | ChatMessage | null |
| POST | /api/chat/contacts/share | chat/chat.controller.ts | chatService | ShareContactDto | ChatMessage | null |
| GET | /api/chat/rooms | chat/chat.controller.ts | chatService | None | ChatRoomRecord[] |
| GET | /api/chat/messages/:roomId | chat/chat.controller.ts | chatService | string | ChatMessage[] |
| POST | /api/chat/favourites | chat/chat.controller.ts | chatService | AddFavouriteDto | { success: boolean } | null |
| GET | /api/chat/favourites | chat/chat.controller.ts | chatService | None | FavouriteRecord[] |
| DELETE | /api/chat/favourites/:id | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| POST | /api/chat/llm-proxy | chat/chat.controller.ts | chatService | LlmProxyDto | { response: string } | null |
| POST | /api/chat/ai-partner | chat/chat.controller.ts | chatService | AiGenerateReplyDto | { response: string } | null |
| POST | /api/chat/suggested-replies | chat/chat.controller.ts | chatService | SuggestedRepliesRequestDto | { suggestions: string[] } | null |
| POST | /api/chat/conversation-starters | chat/chat.controller.ts | conversationStarterService | ConversationStarterDto | { suggestions: string[] } | null |
| POST | /api/chat/translate-voiceroom | chat/chat.controller.ts | translationService | { text: string; target_language: string } | { translated_text: string; detected_language: string } | null |
| POST | /api/chat/translate-real-time | chat/chat.controller.ts | translationService | { text: string; target_language: string } | {
    translated_text: string;
    original_text: string;
    target_language: string;
    detected_language: string;
  } | null |
| POST | /api/chat/messages/status-reply | chat/chat.controller.ts | chatService | ReplyToStatusUpdateDto | ChatMessage | null |
| POST | /api/chat/messages/:messageId/correct | chat/chat.controller.ts | chatService | { correctedText: string; explanation?: string } | ChatMessage | null |
| PATCH | /api/chat/messages/:messageId/fix | chat/chat.controller.ts | chatService | FixMessageDto | ChatMessage | null |
| PATCH | /api/chat/messages/:messageId/status | chat/chat.controller.ts | chatService | UpdateMessageStatusDto | { success: boolean } | null |
| POST | /api/chat/messages/:messageId/view | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| DELETE | /api/chat/messages/:messageId | chat/chat.controller.ts | chatService | DeleteMessageDto | { success: boolean } | null |
| GET | /api/chat/rooms/:roomId/members | chat/chat.controller.ts | chatService | None |
    { user_id: string; display_name?: string; avatar_url?: string | null }[]
   |
| POST | /api/chat/rooms/:roomId/lock | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| POST | /api/chat/rooms/:roomId/unlock | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| GET | /api/chat/locked-rooms | chat/chat.controller.ts | chatService | None | string[] |
| POST | /api/chat/labels | chat/chat.controller.ts | chatService | AddLabelDto | { success: boolean } | null |
| DELETE | /api/chat/labels | chat/chat.controller.ts | chatService | RemoveLabelDto | { success: boolean } | null |
| GET | /api/chat/labels | chat/chat.controller.ts | chatService | None | string[] |
| GET | /api/chat/labels/:label/rooms | chat/chat.controller.ts | chatService | None | ChatRoomRecord[] |
| GET | /api/chat/rooms/:roomId/export | chat/chat.controller.ts | chatService | None | ChatMessage[] |
| GET | /api/chat/rooms/:roomId/greeting | chat/chat.controller.ts | chatService | None | { greetingMessage?: string; awayMessage?: string } |
| POST | /api/chat/rooms/:roomId/wallpaper | chat/chat.controller.ts | chatService | SetWallpaperDto | { success: boolean } | null |
| GET | /api/chat/rooms/:roomId/wallpaper | chat/chat.controller.ts | chatService | None | { wallpaperUrl: string | null } | null |
| GET | /api/chat-backup/export/:channelId | chat-backup/chat-backup.controller.ts | backupService | None | void |
| POST | /api/chat-backup/import/:channelId | chat-backup/chat-backup.controller.ts | backupService | Record<string, unknown>[] | { importedCount: number } |
| POST | /api/communities | communities/communities.controller.ts | communitiesService | CreateCommunityDto | Unknown |
| GET | /api/communities/:communityId | communities/communities.controller.ts | communitiesService | None | Unknown |
| GET | /api/communities | communities/communities.controller.ts | communitiesService | None | Unknown |
| PATCH | /api/communities/:communityId | communities/communities.controller.ts | communitiesService | UpdateCommunityDto | Unknown |
| DELETE | /api/communities/:communityId | communities/communities.controller.ts | communitiesService | None | Unknown |
| POST | /api/communities/:communityId/groups | communities/communities.controller.ts | communitiesService | AddGroupDto | Unknown |
| DELETE | /api/communities/:communityId/groups/:groupId | communities/communities.controller.ts | communitiesService | None | Unknown |
| GET | /api/communities/:communityId/groups | communities/communities.controller.ts | communitiesService | None | Unknown |
| POST | /api/corrector-score/rate | corrector-score/corrector-score.controller.ts | correctorScoreService | RateCorrectorDto | { message: string } |
| GET | /api/corrector-score/:userId | corrector-score/corrector-score.controller.ts | correctorScoreService | None | Unknown |
| GET | /api/cultural-guides/:language | cultural/cultural.controller.ts | culturalService | None | Unknown |
| POST | /api/cultural-insights/tags | cultural-insights/cultural-insights.controller.ts | service | CreateCulturalTagDto | Unknown |
| GET | /api/cultural-insights/tags/:momentId | cultural-insights/cultural-insights.controller.ts | service | None | Unknown |
| GET | /api/cultural-insights/moments | cultural-insights/cultural-insights.controller.ts | service | CulturalTagFilterDto | Unknown |
| GET | /api/curated-content/articles | curated-content/curated-content.controller.ts | service | string | Unknown |
| GET | /api/curated-content/articles/:id | curated-content/curated-content.controller.ts | service | None | Unknown |
| POST | /api/curated-content/articles | curated-content/curated-content.controller.ts | service | CreateArticleDto | Unknown |
| GET | /api/curated-content/dialogues | curated-content/curated-content.controller.ts | service | string | Unknown |
| GET | /api/curated-content/dialogues/:id | curated-content/curated-content.controller.ts | service | None | Unknown |
| POST | /api/curated-content/dialogues | curated-content/curated-content.controller.ts | service | CreateDialogueDto | Unknown |
| GET | /api/daily-tip | daily-tip/daily-tip.controller.ts | dailyTipService | None | { tip: string } |
| POST | /api/decks | decks/decks.controller.ts | decksService | CreateDeckDto | Deck | null |
| GET | /api/decks | decks/decks.controller.ts | decksService | None | Deck[] |
| GET | /api/decks/:id | decks/decks.controller.ts | decksService | None | Deck | null |
| PATCH | /api/decks/:id | decks/decks.controller.ts | decksService | UpdateDeckDto | Deck | null |
| DELETE | /api/decks/:id | decks/decks.controller.ts | decksService | None | { success: boolean } |
| POST | /api/decks/:id/flashcards | decks/decks.controller.ts | decksService | AddFlashcardToDeckDto | { success: boolean } |
| DELETE | /api/decks/:id/flashcards/:flashcardId | decks/decks.controller.ts | decksService | None | { success: boolean } |
| GET | /api/decks/:id/flashcards | decks/decks.controller.ts | decksService | string | { id: string }[] |
| GET | /api/discovery/partners | discovery/discovery.controller.ts | usersService | SearchQueryDto | UserProfile[] |
| GET | /api/discovery/partner-of-week | discovery/discovery.controller.ts | discoveryService | None | string[] |
| GET | /api/discovery/audio-intros | discovery/discovery.controller.ts | usersService | SearchQueryDto | UserProfile[] |
| GET | /api/discovery/recent-native-speakers | discovery/discovery.controller.ts | discoveryService | None | UserProfile[] |
| GET | /api/discovery/spotlight | discovery/discovery.controller.ts | discoveryService | None | UserProfile[] |
| GET | /api/discovery/language-pair | discovery/discovery.controller.ts | discoveryService | LanguagePairQueryDto | UserProfile[] |
| GET | /api/discovery/search-by-location | discovery/discovery.controller.ts | discoveryService | string | UserProfile[] |
| GET | /api/discovery/degradation-status | discovery/discovery.controller.ts | degradationService | None | {
    breakers: Record<string, unknown>;
    events: unknown[];
  } |
| GET | /api/discovery/partners-with-degradation | discovery/discovery.controller.ts | usersService | SearchQueryDto | DiscoveryResult |
| GET | /api/economy/catalog | economy/economy.controller.ts | economyService | None | Unknown |
| GET | /api/economy/packages | economy/economy.controller.ts | economyService | None | Unknown |
| GET | /api/economy/balance | economy/economy.controller.ts | economyService | None | Unknown |
| POST | /api/economy/daily-check-in | economy/economy.controller.ts | economyService | None | Unknown |
| POST | /api/economy/create-checkout-session | economy/economy.controller.ts | economyService | CreateCoinCheckoutSessionDto | Unknown |
| POST | /api/economy/purchase-coins | economy/economy.controller.ts | economyService | PurchaseCoinsDto | Unknown |
| POST | /api/economy/send-gift | economy/economy.controller.ts | economyService | SendGiftDto | Unknown |
| GET | /api/economy/transactions | economy/economy.controller.ts | economyService | None | Unknown |
| GET | /api/economy/sticker-packs | economy/economy.controller.ts | economyService | None | Unknown |
| POST | /api/economy/unlock-sticker-pack | economy/economy.controller.ts | economyService | UnlockStickerPackDto | Unknown |
| GET | /api/economy/health | economy/economy.controller.ts | healthService | None | Unknown |
| POST | /api/escrow/hold | escrow/escrow.controller.ts | escrowService | CreateEscrowHoldDto | Unknown |
| POST | /api/escrow/release | escrow/escrow.controller.ts | escrowService | ReleaseEscrowDto | Unknown |
| POST | /api/escrow/refund | escrow/escrow.controller.ts | escrowService | RefundEscrowDto | Unknown |
| POST | /api/escrow/cancel | escrow/escrow.controller.ts | escrowService | CancelEscrowDto | Unknown |
| POST | /api/escrow/dispute | escrow/escrow.controller.ts | escrowService | DisputeEscrowDto | Unknown |
| GET | /api/escrow/transactions | escrow/escrow.controller.ts | escrowService | string | EscrowTransactionResponse[] |
| GET | /api/escrow/transactions/:id | escrow/escrow.controller.ts | escrowService | None | EscrowTransactionResponse |
| GET | /api/escrow/circuit-breaker/status | escrow/escrow.controller.ts | escrowService | None | CircuitBreakerStatusResponse |
| POST | /api/escrow/circuit-breaker/reset | escrow/escrow.controller.ts | escrowService | None | { reset: boolean } |
| GET | /api/escrow/crash-reports | escrow/escrow.controller.ts | crashReportService | None | Unknown |
| POST | /api/escrow/crash-reports/acknowledge | escrow/escrow.controller.ts | crashReportService | AcknowledgeCrashReportDto | { acknowledged: boolean } |
| POST | /api/escrow/crash-reports/resolve | escrow/escrow.controller.ts | crashReportService | AcknowledgeCrashReportDto | { resolved: boolean } |
| POST | /api/events | events/events.controller.ts | eventsService | CreateEventDto | Unknown |
| GET | /api/events | events/events.controller.ts | eventsService | EventsQueryDto | Unknown |
| GET | /api/events/categories | events/events.controller.ts | eventsService | None | Unknown |
| GET | /api/events/my | events/events.controller.ts | eventsService | string | Unknown |
| GET | /api/events/:id | events/events.controller.ts | eventsService | None | Unknown |
| GET | /api/events/:id/rsvp | events/events.controller.ts | eventsService | None | Unknown |
| POST | /api/events/:id/rsvp | events/events.controller.ts | eventsService | RsvpDto | Unknown |
| DELETE | /api/events/:id/rsvp | events/events.controller.ts | eventsService | None | Unknown |
| POST | /api/favourites | favourites/favourites.controller.ts | favouritesService | { message_id: string; note_text?: string } | unknown |
| DELETE | /api/favourites/:id | favourites/favourites.controller.ts | favouritesService | None | Unknown |
| GET | /api/favourites/user/:userId | favourites/favourites.controller.ts | favouritesService | None | Unknown |
| GET | /api/flashcards/health | flashcards/flashcards.controller.ts | flashcardsService | None | SrsHealthStatus |
| POST | /api/flashcards | flashcards/flashcards.controller.ts | flashcardsService | CreateFlashcardDto | Flashcard | null |
| PATCH | /api/flashcards/:id/srs | flashcards/flashcards.controller.ts | flashcardsService | UpdateSrsDto | Flashcard | null |
| GET | /api/flashcards | flashcards/flashcards.controller.ts | flashcardsService | QueryFlashcardsDto | Flashcard[] |
| GET | /api/flashcards/due | flashcards/flashcards.controller.ts | flashcardsService | QueryDueReviewsDto | Flashcard[] |
| GET | /api/flashcards/suggest | flashcards/suggest-flashcards.controller.ts | suggestService | SuggestFlashcardsDto | Unknown |
| POST | /api/groups | groups/groups.controller.ts | groupsService | CreateGroupDto | Unknown |
| GET | /api/groups | groups/groups.controller.ts | groupsService | string | Unknown |
| GET | /api/groups/discoverable | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /api/groups/:groupId/members | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /api/groups/:groupId/settings | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /api/groups/:groupId/announcements | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /api/groups/mine | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /api/groups/:groupId | groups/groups.controller.ts | groupsService | None | Unknown |
| POST | /api/groups/:groupId/add-member | groups/groups.controller.ts | groupsService | AddMemberDto | Unknown |
| POST | /api/groups/:groupId/remove-member | groups/groups.controller.ts | groupsService | RemoveMemberDto | Unknown |
| POST | /api/groups/:groupId/settings | groups/groups.controller.ts | groupsService | UpdateGroupSettingsDto | Unknown |
| POST | /api/groups/:groupId/restrict-send-messages | groups/groups.controller.ts | groupsService | { canSendMessages: boolean } | Unknown |
| POST | /api/groups/:groupId/restrict-edit-info | groups/groups.controller.ts | groupsService | { canEditInfo: boolean } | Unknown |
| POST | /api/groups/:groupId/rename | groups/groups.controller.ts | groupsService | RenameGroupDto | Unknown |
| POST | /api/groups/:groupId/announcement | groups/groups.controller.ts | groupsService | SendAnnouncementDto | { success: boolean } |
| POST | /api/groups/:groupId/join | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /api/groups/:groupId/resources | groups/groups.controller.ts | groupsService | None | Unknown |
| DELETE | /api/groups/:groupId/resources/:resourceId | groups/groups.controller.ts | groupsService | None | void |
| GET | /api/help/articles | help/help.controller.ts | helpService | HelpQueryDto | Unknown |
| GET | /api/help/categories | help/help.controller.ts | helpService | None | Unknown |
| GET | /api/help/quick-replies | help/help.controller.ts | helpService | None | string[] |
| GET | /api/hobby-tags | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | None | Unknown |
| POST | /api/hobby-tags | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | { name: string; category: string; icon?: string } | any |
| GET | /api/hobby-tags/my | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | None | unknown |
| POST | /api/hobby-tags/my | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | { hobby_tag_id: string; proficiency_level?: number } | unknown |
| DELETE | /api/hobby-tags/my/:hobbyTagId | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | None | { message: string } |
| PATCH | /api/hobby-tags/my/:hobbyTagId | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | { proficiency_level: number } | unknown |
| GET | /api/hobby-tags/vocabulary | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | string | VocabularyResultItem[] |
| GET | /api/host-dashboard/:roomId/stats | host-dashboard/host-dashboard.controller.ts | service | None | HostDashboardStatsDto |
| GET | /api/interests | interests/interests.controller.ts | interestsService | string | Unknown |
| POST | /api/interests/select | interests/interests.controller.ts | interestsService | string[] | Unknown |
| POST | /api/language-challenges | language-challenges/language-challenges.controller.ts | challengesService | CreateChallengeDto | Unknown |
| GET | /api/language-challenges | language-challenges/language-challenges.controller.ts | challengesService | None | Unknown |
| POST | /api/language-challenges/:id/join | language-challenges/language-challenges.controller.ts | challengesService | JoinChallengeDto | Unknown |
| POST | /api/language-challenges/:id/daily-checkin | language-challenges/language-challenges.controller.ts | challengesService | None | Unknown |
| POST | /api/language-challenges/:id/claim | language-challenges/language-challenges.controller.ts | challengesService | ClaimPrizeDto | Unknown |
| GET | /api/language-islands | language-islands/language-islands.controller.ts | languageIslandsService | QueryLanguageIslandsDto | Unknown |
| GET | /api/language-islands/my | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| GET | /api/language-islands/:id | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| POST | /api/language-islands | language-islands/language-islands.controller.ts | languageIslandsService | CreateLanguageIslandDto | Unknown |
| PATCH | /api/language-islands/:id | language-islands/language-islands.controller.ts | languageIslandsService | UpdateLanguageIslandDto | Unknown |
| DELETE | /api/language-islands/:id | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| POST | /api/language-islands/:id/join | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| POST | /api/language-islands/:id/leave | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| GET | /api/leaderboard/top-correctors | leaderboard/leaderboard.controller.ts | leaderboardService | string | Corrector[] |
| GET | /api/legal/terms | legal/legal.controller.ts | legalService | None | Unknown |
| GET | /api/legal/privacy | legal/legal.controller.ts | legalService | None | Unknown |
| GET | /api/admin/lessons | lessons/lessons.controller.ts | lessonsService | None | Unknown |
| GET | /api/admin/lessons/:id | lessons/lessons.controller.ts | lessonsService | None | Unknown |
| POST | /api/admin/lessons | lessons/lessons.controller.ts | lessonsService | CreateLessonDto | Unknown |
| PATCH | /api/admin/lessons/:id | lessons/lessons.controller.ts | lessonsService | UpdateLessonDto | Unknown |
| DELETE | /api/admin/lessons/:id | lessons/lessons.controller.ts | lessonsService | None | Unknown |
| GET | /api/link-preview | link-preview/link-preview.controller.ts | linkPreviewService | string | LinkPreview | null |
| GET | /api/users/me/linked-accounts | linked-accounts/linked-accounts.controller.ts | linkedAccountsService | None | Unknown |
| POST | /api/users/me/linked-accounts/link | linked-accounts/linked-accounts.controller.ts | linkedAccountsService | { provider: string; name?: string } | Unknown |
| POST | /api/users/me/linked-accounts/unlink | linked-accounts/linked-accounts.controller.ts | linkedAccountsService | { provider: string } | Unknown |
| POST | /api/livekit/token | livekit/livekit.controller.ts | livekitService | LivekitTokenDto | Unknown |
| POST | /api/location/:userId/current | location/location.controller.ts | locationService | number | { success: boolean } |
| GET | /api/location/:userId/current | location/location.controller.ts | locationService | None | { latitude: number; longitude: number } | null |
| POST | /api/location/:userId/live/start | location/location.controller.ts | locationService | string | { shareId: string; channel: string } |
| POST | /api/location/:userId/live/update | location/location.controller.ts | locationService | number | { success: boolean } |
| DELETE | /api/location/:userId/live | location/location.controller.ts | locationService | None | { success: boolean } |
| GET | /api/location/:userId/live | location/location.controller.ts | locationService | None | {
    sharer_user_id: string;
    latitude: number;
    longitude: number;
    updated_at: string;
  } |
| POST | /api/media/cover/presigned-url | media/media.controller.ts | mediaService | PresignedUrlDto | { uploadUrl: string; mediaUrl: string; objectKey: string } |
| POST | /api/media/voice-note | media/media.controller.ts | mediaService | None | { url: string } |
| POST | /api/media/cover/confirm | media/media.controller.ts | mediaService | string | { coverUrl: string } |
| POST | /api/media/cover/upload | media/media.controller.ts | mediaService | None | { coverUrl: string } |
| POST | /api/media/avatar/upload | media/media.controller.ts | mediaService | None | { avatarUrl: string } |
| POST | /api/media/view-once/mark-viewed | media/media.controller.ts | mediaService | string | { success: boolean } |
| GET | /api/metrics | metrics/metrics.controller.ts | metricsService | None | void |
| POST | /api/milestones | milestones/milestones.controller.ts | milestonesService | CreateMilestoneDto | Milestone |
| GET | /api/milestones | milestones/milestones.controller.ts | milestonesService | None | Milestone[] |
| GET | /api/milestones/progress | milestones/milestones.controller.ts | milestonesService | None | MilestoneProgress |
| GET | /api/milestones/:id | milestones/milestones.controller.ts | milestonesService | None | Milestone |
| POST | /api/milestones/:id/complete | milestones/milestones.controller.ts | milestonesService | None | Milestone |
| DELETE | /api/milestones/:id | milestones/milestones.controller.ts | milestonesService | None | void |
| GET | /api/moderation/items | moderation/moderation.controller.ts | moderationService | string | ModerationItem[] |
| POST | /api/moderation/report | moderation/moderation.controller.ts | moderationService | ReportUserDto | Unknown |
| POST | /api/moderation/approve | moderation/moderation.controller.ts | moderationService | ModerationActionDto | Unknown |
| POST | /api/moderation/reject | moderation/moderation.controller.ts | moderationService | ModerationActionDto | Unknown |
| GET | /api/moderation/analyse/:userId | moderation/moderation.controller.ts | moderationService | None | Unknown |
| POST | /api/moments | moments/moments.controller.ts | momentsService | CreateMomentDto | MomentRecord | null |
| GET | /api/moments/feed | moments/moments.controller.ts | momentsService | string | MomentRecord[] |
| GET | /api/moments/lifetime-counts | moments/moments.controller.ts | momentsService | None | {
    translations: number;
    corrections: number;
    moments: number;
  } | null |
| GET | /api/moments/stories | moments/moments.controller.ts | momentsService | None | MomentRecord[] |
| POST | /api/moments/upload-voice | moments/moments.controller.ts | momentsService | string | { uploadUrl: string; publicUrl: string } | null |
| POST | /api/moments/upload-media | moments/moments.controller.ts | momentsService | string | { uploadUrl: string; publicUrl: string } |
| POST | /api/moments/stories | moments/moments.controller.ts | momentsService | CreateStoryDto | StoryResponse | null |
| POST | /api/moments/language-questions | moments/moments.controller.ts | momentsService | CreateLanguageQuestionDto | MomentRecord | null |
| POST | /api/moments/:id/answer | moments/moments.controller.ts | momentsService | AnswerLanguageQuestionDto | { correct: boolean; correctAnswer: string } | null |
| GET | /api/moments/questions | moments/moments.controller.ts | momentsService | string | MomentRecord[] |
| POST | /api/moments/:id/like | moments/moments.controller.ts | momentsService | None | { likes_count: number; is_liked: boolean } | null |
| GET | /api/moments/:id/likes | moments/moments.controller.ts | momentsService | None | MomentLikeUser[] |
| POST | /api/moments/:id/comments | moments/moments.controller.ts | momentsService | CreateCommentDto | MomentComment | null |
| POST | /api/moments/:id/comments/:commentId/vote | moments/moments.controller.ts | momentsService | VoteCorrectionDto | {
    commentId: string;
    vote: string;
    upVotes: number;
    downVotes: number;
    userVote: string | null;
  } | null |
| GET | /api/moments/:id/comments | moments/moments.controller.ts | momentsService | None | MomentComment[] |
| PATCH | /api/moments/:id/edit-text | moments/moments.controller.ts | momentsService | EditTextDto | MomentRecord | null |
| PATCH | /api/moments/:id/pin | moments/moments.controller.ts | usersService | None | MomentRecord | null |
| POST | /api/monetisation/webhooks/apple | monetisation/apple-notification.controller.ts | logger | unknown | Unknown |
| POST | /api/monetisation/webhooks/google | monetisation/google-play-notification.controller.ts | logger | unknown | Unknown |
| POST | /api/monetisation/webhooks/stripe | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /api/monetisation/webhooks/apple | monetisation/monetisation.controller.ts | monetisationService | AppleNotificationDto | Unknown |
| POST | /api/monetisation/webhooks/google | monetisation/monetisation.controller.ts | monetisationService | GoogleNotificationDto | Unknown |
| POST | /api/monetisation/generate-api-key | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /api/monetisation/analytics | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /api/monetisation/diagnostics/logs | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /api/monetisation/diagnostics/logs | monetisation/monetisation.controller.ts | monetisationService | CreateDiagnosticLogDto | Unknown |
| POST | /api/monetisation/validate-apple-receipt | monetisation/monetisation.controller.ts | appleReceiptValidatorService | AppleReceiptValidationDto | Unknown |
| POST | /api/monetisation/create-checkout-session | monetisation/monetisation.controller.ts | monetisationService | CreateCheckoutSessionDto | Unknown |
| POST | /api/monetisation/restore-purchases | monetisation/monetisation.controller.ts | monetisationService | { platform?: string; receipt_data?: string } | Unknown |
| GET | /api/monetisation/coins-balance | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /api/monetisation/subscription | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /api/monetisation/subscription/cancel | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /api/monetisation/subscription/resume | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /api/monetisation/subscription/invoices | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /api/monetisation/subscription/billing-portal | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /api/nlp/detect-language | nlp/nlp.controller.ts | nlpService | { text?: string } | {
    language: string;
    confidence: number;
  } |
| POST | /api/nlp/translate | nlp/nlp.controller.ts | usersService | TranslateDto | TranslationResult | null |
| POST | /api/nlp/translate-ui | nlp/nlp.controller.ts | nlpService | TranslateUiDto | TranslateUiResult |
| POST | /api/nlp/grammar-check | nlp/nlp.controller.ts | usersService | GrammarCheckDto | GrammarCheckResult | null |
| POST | /api/nlp/explain-grammar | nlp/nlp.controller.ts | usersService | ExplainGrammarDto | {
    original: string;
    corrected: string;
    explanation: string;
  } | null |
| POST | /api/nlp/pronunciation-score | nlp/nlp.controller.ts | usersService | PronunciationScoreDto | PronunciationScoreResult | null |
| POST | /api/nlp/simplify | nlp/nlp.controller.ts | usersService | SimplifyDto | { original: string; simplified: string } | null |
| POST | /api/nlp/translate-and-correct | nlp/nlp.controller.ts | usersService | TranslateDto | Unknown |
| POST | /api/nlp/translate-bio | nlp/nlp.controller.ts | usersService | TranslateBioDto | {
    original_text: string;
    translated_text: string;
    detected_language: string;
  } | null |
| POST | /api/nlp/transcribe-audio | nlp/nlp.controller.ts | nlpService | TranscribeAudioDto | { transcription: string; language: string } |
| GET | /api/notification-preferences | notification-preferences/notification-preferences.controller.ts | service | None | Unknown |
| PUT | /api/notification-preferences | notification-preferences/notification-preferences.controller.ts | service | UpdateNotificationPreferencesDto | Unknown |
| POST | /api/notification-preferences/reset | notification-preferences/notification-preferences.controller.ts | service | None | Unknown |
| GET | /api/notification-preferences | notifications/notification-preferences.controller.ts | preferencesService | None | NotificationPreferences |
| PUT | /api/notification-preferences | notifications/notification-preferences.controller.ts | preferencesService | NotificationPreferencesDto | NotificationPreferences |
| POST | /api/notification-preferences/reset | notifications/notification-preferences.controller.ts | preferencesService | None | NotificationPreferences |
| PATCH | /api/notification-preferences/:category/:channel | notifications/notification-preferences.controller.ts | preferencesService | boolean | NotificationPreferences |
| GET | /api/notifications | notifications/notifications.controller.ts | notificationsService | string | NotificationDto[] |
| GET | /api/notifications/unread-count | notifications/notifications.controller.ts | notificationsService | None | { unreadCount: number } |
| GET | /api/notifications/preferences | notifications/notifications.controller.ts | notificationsService | None | Unknown |
| PUT | /api/notifications/preferences | notifications/notifications.controller.ts | notificationsService | UpdateNotificationPreferencesDto | { success: boolean; preferences: unknown } |
| PATCH | /api/notifications/read-all | notifications/notifications.controller.ts | notificationsService | None | { success: boolean } |
| PATCH | /api/notifications/:id/read | notifications/notifications.controller.ts | notificationsService | None | { success: boolean } |
| POST | /api/auth/request-password-reset | password-reset/password-reset.controller.ts | resetService | RequestPasswordResetDto | { message: string } |
| POST | /api/auth/reset-password | password-reset/password-reset.controller.ts | resetService | ResetPasswordDto | { message: string } |
| POST | /api/privacy/request-archive | privacy/privacy.controller.ts | privacyService | ArchiveRequestDto | Unknown |
| POST | /api/privacy/delete-account | privacy/privacy.controller.ts | privacyService | DeleteAccountDto | Unknown |
| POST | /api/privacy/cancel-deletion | privacy/privacy.controller.ts | privacyService | None | Unknown |
| POST | /api/proficiency/assess | proficiency/proficiency.controller.ts | proficiencyService | AssessmentResultDto | AssessmentResult |
| POST | /api/proficiency/languages | proficiency/proficiency.controller.ts | proficiencyService | LanguageSelectionDto | { success: boolean } |
| POST | /api/profile-visits/:viewedId | profile-visits/profile-visits.controller.ts | usersService | None | Record<string, unknown> | null |
| GET | /api/profile-visits/my-visitors | profile-visits/profile-visits.controller.ts | usersService | None | ProfileVisitRecord[] |
| POST | /api/pronunciation/feedback | pronunciation/pronunciation.controller.ts | pronunciationService | string | PronunciationFeedbackResponseDto |
| POST | /api/pronunciation/voice-feedback | pronunciation/pronunciation.controller.ts | pronunciationService | string | { success: boolean } |
| GET | /api/quests | quests/quests.controller.ts | questsService | None | Unknown |
| GET | /api/quiz/questions | quiz/quiz.controller.ts | quizService | string | Unknown |
| POST | /api/quiz/results | quiz/quiz.controller.ts | quizService | QuizSubmission | Unknown |
| POST | /api/reading/resources | reading-engine/reading-engine.controller.ts | readingService | CreateReadingResourceDto | ReadingResource |
| GET | /api/reading/resources | reading-engine/reading-engine.controller.ts | readingService | number | ReadingResource[] |
| GET | /api/reading/resources/:id | reading-engine/reading-engine.controller.ts | readingService | None | ReadingResource |
| PUT | /api/reading/resources/:id | reading-engine/reading-engine.controller.ts | readingService | UpdateReadingResourceDto | ReadingResource |
| DELETE | /api/reading/resources/:id | reading-engine/reading-engine.controller.ts | readingService | None | void |
| GET | /api/reading/resources/:id/tokenise | reading-engine/reading-engine.controller.ts | readingService | string | ReadingTokenBreakdown |
| GET | /api/reading/progress | reading-engine/reading-engine.controller.ts | readingService | None | ReadingProgress |
| POST | /api/reading/progress/session | reading-engine/reading-engine.controller.ts | readingService | { resourceId: string; wordsRead: number; durationSeconds: number } | ReadingProgress |
| DELETE | /api/reading/cache/user | reading-engine/reading-engine.controller.ts | readingService | None | void |
| GET | /api/recommendations/for-you | recommendations/recommendations.controller.ts | recommendationsService | None | RecommendedUserDto[] |
| GET | /api/recommendations/daily | recommendations/recommendations.controller.ts | recommendationsService | None | RecommendedUserDto[] |
| POST | /api/resource-library | resource-library/resource-library.controller.ts | resourceService | CreateResourceDto | Unknown |
| GET | /api/resource-library | resource-library/resource-library.controller.ts | resourceService | string | Unknown |
| GET | /api/resource-library/:id | resource-library/resource-library.controller.ts | resourceService | None | Unknown |
| PATCH | /api/resource-library/:id | resource-library/resource-library.controller.ts | resourceService | UpdateResourceDto | Unknown |
| DELETE | /api/resource-library/:id | resource-library/resource-library.controller.ts | resourceService | None | Unknown |
| GET | /api/safety/report-categories | safety/safety.controller.ts | safetyService | None | Unknown |
| POST | /api/safety/report | safety/safety.controller.ts | safetyService | ReportUserDto | { success: boolean; message: string } |
| POST | /api/safety/block | safety/safety.controller.ts | safetyService | BlockUserDto | { success: boolean; blocked_id: string } |
| POST | /api/safety/unblock | safety/safety.controller.ts | safetyService | UnblockUserDto | { success: boolean } |
| GET | /api/safety/blocked-ids | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /api/safety/blocked-users | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /api/safety/blocked-ids/:userId | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /api/safety/blocker-ids/:userId | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /api/safety/is-blocked/:blockedId | safety/safety.controller.ts | safetyService | None | { blocked: boolean } |
| POST | /api/safety/block/:blockedId | safety/safety.controller.ts | safetyService | None | { success: boolean; blocked_id: string } |
| POST | /api/safety/unblock/:blockedId | safety/safety.controller.ts | safetyService | None | { success: boolean } |
| GET | /api/safety/blocked-and-blocker-ids/:userId | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /api/safety/blocked-users-details | safety/safety.controller.ts | safetyService | None | BlockedUserResponseDto[] |
| GET | /api/cart | shopping/cart.controller.ts | cartService | None | Unknown |
| POST | /api/cart/add | shopping/cart.controller.ts | cartService | { itemId: string; quantity?: number } | Unknown |
| POST | /api/cart/remove | shopping/cart.controller.ts | cartService | { itemId: string; quantity?: number } | Unknown |
| POST | /api/cart/checkout | shopping/cart.controller.ts | cartService | None | Unknown |
| GET | /api/shopping/catalog | shopping/shopping.controller.ts | shoppingService | None | Unknown |
| GET | /api/shopping/items/:id | shopping/shopping.controller.ts | shoppingService | None | Unknown |
| GET | /api/shopping/cart | shopping/shopping.controller.ts | cartService | None | Unknown |
| POST | /api/shopping/cart | shopping/shopping.controller.ts | cartService | AddToCartDto | Unknown |
| DELETE | /api/shopping/cart | shopping/shopping.controller.ts | cartService | AddToCartDto | Unknown |
| POST | /api/shopping/cart/checkout | shopping/shopping.controller.ts | cartService | None | Unknown |
| POST | /api/spam-detection/check | spam-detection/spam-detection.controller.ts | spamDetectionService | SpamCheckDto | { isSpam: boolean } |
| GET | /api/stats/me | stats/stats.controller.ts | statsService | None | MyStatsResponse |
| POST | /api/study-buddies/request | study-buddies/study-buddies.controller.ts | sbService | StudyBuddyRequestDto | BuddyRequest |
| GET | /api/study-buddies/requests | study-buddies/study-buddies.controller.ts | sbService | None | BuddyRequest[] |
| POST | /api/study-buddies/requests/:id/accept | study-buddies/study-buddies.controller.ts | sbService | None | BuddyRequest |
| POST | /api/study-buddies/requests/:id/decline | study-buddies/study-buddies.controller.ts | sbService | None | BuddyRequest |
| GET | /api/study-buddies/matches | study-buddies/study-buddies.controller.ts | sbService | None | UserProfile[] |
| POST | /api/study-buddies/follow | study-buddies/study-buddies.controller.ts | sbService | string | { message: string } |
| DELETE | /api/study-buddies/unfollow | study-buddies/study-buddies.controller.ts | sbService | string | { message: string } |
| GET | /api/study-buddies/channel | study-buddies/study-buddies.controller.ts | sbService | string | { channel: string } |
| GET | /api/study-streak/me | study-streak/study-streak.controller.ts | streakService | None | { streak: number } |
| POST | /api/study-streak/checkin | study-streak/study-streak.controller.ts | streakService | None | { streak: number } |
| GET | /api/study-streak/health | study-streak/study-streak.controller.ts | Unknown | None | { ok: boolean } |
| POST | /api/transfer/generate | transfer/transfer.controller.ts | transferService | None | Unknown |
| GET | /api/transfer/consume | transfer/transfer.controller.ts | transferService | string | Unknown |
| POST | /api/transfer/consume | transfer/transfer.controller.ts | transferService | string | Unknown |
| POST | /api/transfer/swap | transfer/transfer.controller.ts | transferService | string | Unknown |
| POST | /api/two-factor/enable | two-factor/two-factor.controller.ts | twoFactorService | None | Unknown |
| POST | /api/two-factor/verify | two-factor/two-factor.controller.ts | twoFactorService | { token: string } | Unknown |
| POST | /api/two-factor/disable | two-factor/two-factor.controller.ts | twoFactorService | { token: string } | Unknown |
| GET | /api/two-factor/status | two-factor/two-factor.controller.ts | twoFactorService | None | Unknown |
| GET | /api/user-statistics/:userId | user-statistics/user-statistics.controller.ts | userStatisticsService | UserStatisticsQueryDto | Unknown |
| POST | /api/generate-device-link | users/device-link.controller.ts | usersService | None | { url: string } |
| DELETE | /api/users/me | users/users.controller.ts | usersService | None | { message: string; scheduled_for_deletion_at: string } |
| DELETE | /api/users/me/permanent | users/users.controller.ts | usersService | None | { message: string } |
| POST | /api/users/me/restore | users/users.controller.ts | usersService | None | { message: string } |
| GET | /api/users/me/export | users/users.controller.ts | usersService | None | Record<string, unknown> |
| GET | /api/users/me/notification-preferences | users/users.controller.ts | usersService | None | {
    custom_tone_url?: string;
    vibration_pattern?: number[];
  } | null |
| GET | /api/users/me | users/users.controller.ts | usersService | None | UserProfile | null |
| GET | /api/users/me/stats | users/users.controller.ts | usersService | None | Partial<UserProfile> |
| GET | /api/users/me/xp | users/users.controller.ts | usersService | None | { totalXp: number } |
| POST | /api/users/me/assess-proficiency | users/users.controller.ts | usersService | number | { level: string } |
| PATCH | /api/users/me | users/users.controller.ts | usersService | UpdateProfileDto | UserProfile | null |
| PATCH | /api/users/me/greeting | users/users.controller.ts | usersService | UpdateGreetingMessageDto | UserProfile | null |
| PATCH | /api/users/me/away | users/users.controller.ts | usersService | UpdateAwayMessageDto | UserProfile | null |
| POST | /api/users/me/cover-photo/presigned-url | users/users.controller.ts | mediaService | { filename: string; contentType: string } | { uploadUrl: string; mediaUrl: string; objectKey: string } |
| PATCH | /api/users/me/cover-photo | users/users.controller.ts | usersService | string | UserProfile | null |
| POST | /api/users/me/avatar/presigned-url | users/users.controller.ts | mediaService | { filename: string; contentType: string } | { uploadUrl: string; mediaUrl: string; objectKey: string } |
| GET | /api/users/me/visitors | users/users.controller.ts | usersService | None | ProfileVisitor[] |
| GET | /api/users/status/:statusId/viewers | users/users.controller.ts | usersService | None | ProfileVisitor[] |
| GET | /api/users/me/status-viewers | users/users.controller.ts | usersService | None | ProfileVisitor[] |
| GET | /api/users/hobbies | users/users.controller.ts | usersService | None | string[] |
| GET | /api/users/interests | users/users.controller.ts | usersService | None | string[] |
| GET | /api/users/search | users/users.controller.ts | usersService | number | undefined |
    { id: string; display_name: string; avatar_url: string | null }[]
   |
| GET | /api/users/me/badges | users/users.controller.ts | usersService | None | { id: string; name: string; description: string }[] |
| GET | /api/users/:id | users/users.controller.ts | usersService | None | UserProfile |
| GET | /api/users/:id/stats | users/users.controller.ts | usersService | None | Partial<UserProfile> |
| GET | /api/users/:id/followers | users/users.controller.ts | usersService | number | undefined | { data: UserProfile[]; total: number } |
| GET | /api/users/:id/following | users/users.controller.ts | usersService | number | undefined | { data: UserProfile[]; total: number } |
| POST | /api/users/:id/follow | users/users.controller.ts | usersService | None | void |
| DELETE | /api/users/:id/follow | users/users.controller.ts | usersService | None | void |
| POST | /api/users/block/:id | users/users.controller.ts | usersService | None | { success: boolean } |
| DELETE | /api/users/block/:id | users/users.controller.ts | usersService | None | { success: boolean } |
| POST | /api/users/report | users/users.controller.ts | usersService | {
      reported_id: string;
      reason_category: string;
      description?: string;
      context_url?: string;
    } | { success: boolean; message: string } |
| GET | /api/users/me/privacy-settings | users/users.controller.ts | usersService | None | {
    privacy_hide_age: boolean;
    privacy_hide_location: boolean;
    privacy_hide_from_search: boolean;
    privacy_hide_gender: boolean;
    privacy_last_seen?: string;
    privacy_profile_photo?: string;
    privacy_about_info?: string;
    privacy_status?: string;
    incognito_visits?: boolean;
    profile_visibility?: 'everyone' | 'vips_only' | 'hidden';
  } |
| GET | /api/users/me/message-filters | users/users.controller.ts | usersService | None | {
    age_min?: number;
    age_max?: number;
    allowed_native_languages?: string[];
    allowed_genders?: string[];
  } |
| PUT | /api/users/me/message-filters | users/users.controller.ts | usersService | {
      age_min?: number;
      age_max?: number;
      allowed_native_languages?: string[];
      allowed_genders?: string[];
    } | void |
| PATCH | /api/users/me/privacy | users/users.controller.ts | usersService | PrivacySettingsDto | UserProfile | null |
| GET | /api/users/me/business | users/users.controller.ts | usersService | None | {
    business_name?: string;
    business_hours?: string;
    website_url?: string;
    catalog?: BusinessCatalogItem[];
  } |
| PATCH | /api/users/me/business | users/users.controller.ts | usersService | UpdateBusinessProfileDto | UserProfile | null |
| PATCH | /api/users/me/dnd | users/users.controller.ts | usersService | DoNotDisturbDto | UserProfile | null |
| PATCH | /api/users/me/status-visibility | users/users.controller.ts | usersService | UpdateStatusVisibilityDto | UserProfile | null |
| POST | /api/users/me/contact-sharing | users/users.controller.ts | usersService | string | { phone_number?: string; email?: string } |
| PATCH | /api/users/me/notification-preferences | users/users.controller.ts | usersService | UpdateNotificationPreferencesDto | UserProfile | null |
| GET | /api/version | version/version.controller.ts | versionService | None | {
    current: string;
    latest: string;
    updateUrl?: string;
    minimumSupported: string;
  } |
| GET | /api/version/minimum | version/version.controller.ts | versionService | None | { minimumSupported: string } |
| POST | /api/video-calls/start | video-calls/video-calls.controller.ts | videoCallsService | None | Unknown |
| POST | /api/video-calls/accept | video-calls/video-calls.controller.ts | videoCallsService | string | Unknown |
| GET | /api/video-calls/health | video-calls/video-calls.controller.ts | degradationService | None | Unknown |
| GET | /api/word-of-the-day | word-of-the-day/word-of-the-day.controller.ts | service | None | Unknown |
| GET | /api/xp | xp/xp.controller.ts | xpService | None | { total: number; level: number } |
| GET | /api/xp/history | xp/xp.controller.ts | xpService | number |
    Array<{
      id: string;
      user_id: string;
      points: number;
      activity: string;
      created_at: string;
    }>
   |
| GET | /api/xp/activities | xp/xp.controller.ts | xpService | None | Record<string, number> |
| GET | /api/chat/quick-replies | chat/quick-replies/quick-replies.controller.ts | quickRepliesService | None | QuickReply[] |
| POST | /api/chat/quick-replies | chat/quick-replies/quick-replies.controller.ts | quickRepliesService | CreateQuickReplyDto | QuickReply |
| GET | /api/user-interests/tags | modules/user-interests/user-interests.controller.ts | interestsService | None | { tags: string[] } |
| POST | /api/user-interests/tags | modules/user-interests/user-interests.controller.ts | interestsService | UpdateInterestsDto | { success: boolean } |
| GET | /api/user-interests/vocabulary | modules/user-interests/user-interests.controller.ts | interestsService | string | { entries: VocabularyEntry[] } |
| POST | /api/stripe/webhook | monetisation/controllers/stripe.controller.ts | stripeService | None | Unknown |
| GET | /api/subscription-plans | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan[] |
| GET | /api/subscription-plans/popular | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan | undefined |
| GET | /api/subscription-plans/free | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan | undefined |
| GET | /api/subscription-plans/paid | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan[] |
| GET | /api/subscription-plans/:id | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan |
| GET | /api/subscription-plans/:id/benefits | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | string[] |
| GET | /api/subscription-plans/showcase | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan[] |
