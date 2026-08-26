# API Contract Mapping

## Missing Backend Routes (Drift)

- **GET** ``${environment.apiUrl}/achievements/full/${params.userId}`` -> `/{param}/achievements/full/{param}` in `achievements/achievements.component.ts` (expects `FullAchievementDto[]`)
- **GET** ``${environment.apiUrl}/interests?language=${params.language}`` -> `/{param}/interests?language={param}` in `interests-select/interests-select.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/interests/select`` -> `/{param}/interests/select` in `interests-select/interests-select.component.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/two-factor/enable`` -> `/{param}/two-factor/enable` in `services/2fa.service.ts` (expects `{ secret: string; qrCodeUrl: string }`)
- **POST** ``${this.apiUrl}/two-factor/verify`` -> `/{param}/two-factor/verify` in `services/2fa.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/two-factor/disable`` -> `/{param}/two-factor/disable` in `services/2fa.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/two-factor/status`` -> `/{param}/two-factor/status` in `services/2fa.service.ts` (expects `{ enabled: boolean }`)
- **GET** ``${this.baseUrl}/users`` -> `/{param}/users` in `services/admin.service.ts` (expects `AdminUserListResult`)
- **GET** ``${this.baseUrl}/users`` -> `/{param}/users` in `services/admin.service.ts` (expects `AdminUserListResult`)
- **PATCH** ``${this.baseUrl}/users/${userId}/vip`` -> `/{param}/users/{param}/vip` in `services/admin.service.ts` (expects `AdminUserSummary`)
- **GET** ``${this.baseUrl}/users/${userId}/login-history`` -> `/{param}/users/{param}/login-history` in `services/admin.service.ts` (expects `LoginHistoryEntry[]`)
- **POST** ``${this.baseUrl}/users/${userId}/ban`` -> `/{param}/users/{param}/ban` in `services/admin.service.ts` (expects `{ message: string }`)
- **POST** ``${this.baseUrl}/users/${userId}/warn`` -> `/{param}/users/{param}/warn` in `services/admin.service.ts` (expects `{ message: string }`)
- **GET** ``${this.baseUrl}/blocks`` -> `/{param}/blocks` in `services/admin.service.ts` (expects `AdminBlocksListResult`)
- **DELETE** ``${this.baseUrl}/blocks/${blockId}`` -> `/{param}/blocks/{param}` in `services/admin.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.baseUrl}/scenarios`` -> `/{param}/scenarios` in `services/ai-conversation.service.ts` (expects `Scenario[]`)
- **POST** ``${this.baseUrl}/message`` -> `/{param}/message` in `services/ai-conversation.service.ts` (expects `{ reply: string }`)
- **POST** ``${this.baseUrl}/presigned-upload`` -> `/{param}/presigned-upload` in `services/audio-intro.service.ts` (expects `PresignedUploadResponse`)
- **PATCH** ``${this.baseUrl}/${userId}`` -> `/{param}/{param}` in `services/audio-intro.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/${userId}`` -> `/{param}/{param}` in `services/audio-intro.service.ts` (expects `AudioIntroResponse`)
- **GET** ``${this.baseUrl}/health`` -> `/{param}/health` in `services/audio-room-degradation.service.ts` (expects `DegradationState`)
- **GET** ``${this.baseUrl}/list`` -> `/{param}/list` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord[]`)
- **GET** ``${this.baseUrl}/by-language`` -> `/{param}/by-language` in `services/audio-rooms.store.ts` (expects `Array<{ language_pair: string; count: number; rooms: AudioRoomRecord[] }>`)
- **POST** ``${this.baseUrl}/create`` -> `/{param}/create` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/private`` -> `/{param}/private` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **GET** ``${this.baseUrl}/private`` -> `/{param}/private` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord[]`)
- **POST** ``${this.baseUrl}/token`` -> `/{param}/token` in `services/audio-rooms.store.ts` (expects `{
          token: string;
          room_id: string;
          room_name: string;
          livekit_url: string;
          is_speaker: boolean;
        }`)
- **POST** ``${this.baseUrl}/raise-hand`` -> `/{param}/raise-hand` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/approve-speaker`` -> `/{param}/approve-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/demote-speaker`` -> `/{param}/demote-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/dismiss-raised-hand`` -> `/{param}/dismiss-raised-hand` in `services/audio-rooms.store.ts` (expects `void`)
- **POST** ``${this.baseUrl}/mute-speaker`` -> `/{param}/mute-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/unmute-speaker`` -> `/{param}/unmute-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/kick-speaker`` -> `/{param}/kick-speaker` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/invite-co-host`` -> `/{param}/invite-co-host` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/remove-co-host`` -> `/{param}/remove-co-host` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.baseUrl}/captions`` -> `/{param}/captions` in `services/audio-rooms.store.ts` (expects `CaptionRecord`)
- **POST** ``${this.baseUrl}/ai-captions`` -> `/{param}/ai-captions` in `services/audio-rooms.store.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${roomId}/tip`` -> `/{param}/{param}/tip` in `services/audio-rooms.store.ts` (expects `{
          tip_id: string;
          amount_coins: number;
          receiver_id: string;
          receiver_new_balance: number;
        }`)
- **POST** ``${this.baseUrl}/archive`` -> `/{param}/archive` in `services/audio-rooms.store.ts` (expects `AudioRoomRecord`)
- **GET** ``${this.baseUrl}/${roomId}/stage`` -> `/{param}/{param}/stage` in `services/audio-rooms.store.ts` (expects `StageInfo`)
- **POST** ``${this.apiUrl}/auth/two-factor/enable`` -> `/{param}/auth/two-factor/enable` in `services/auth.service.ts` (expects `{ secret: string; qrCodeUrl: string }`)
- **POST** ``${this.apiUrl}/auth/two-factor/verify`` -> `/{param}/auth/two-factor/verify` in `services/auth.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/auth/two-factor/disable`` -> `/{param}/auth/two-factor/disable` in `services/auth.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/auth/two-factor/status`` -> `/{param}/auth/two-factor/status` in `services/auth.service.ts` (expects `{ enabled: boolean }`)
- **POST** ``${this.apiUrl}/auth/transfer/generate`` -> `/{param}/auth/transfer/generate` in `services/auth.service.ts` (expects `{ url: string }`)
- **POST** ``${this.apiUrl}/auth/transfer/consume`` -> `/{param}/auth/transfer/consume` in `services/auth.service.ts` (expects `{ swapToken: string }`)
- **POST** ``${this.apiUrl}/auth/transfer/swap`` -> `/{param}/auth/transfer/swap` in `services/auth.service.ts` (expects `{
          access_token: string;
          refresh_token: string;
          user_id: string;
        }`)
- **POST** ``${this.apiUrl}/auth/request-password-reset`` -> `/{param}/auth/request-password-reset` in `services/auth.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/auth/reset-password`` -> `/{param}/auth/reset-password` in `services/auth.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/auth/change-password`` -> `/{param}/auth/change-password` in `services/auth.service.ts` (expects `Unknown`)
- **DELETE** ``${this.apiUrl}/${blockedId}`` -> `/{param}/{param}` in `services/block.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/blocks`` -> `/{param}/blocks` in `services/blocked-users.service.ts` (expects `BlockedUserResponse[]`)
- **DELETE** ``${this.apiUrl}/blocks/${userId}`` -> `/{param}/blocks/{param}` in `services/blocked-users.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/call-logs`` -> `/{param}/call-logs` in `services/call-logs.service.ts` (expects `CallLogRecord[]`)
- **POST** ``${environment.apiUrl}/chat/token`` -> `/{param}/chat/token` in `services/centrifuge.service.ts` (expects `{ token: string }`)
- **GET** ``${this.baseUrl}/labels`` -> `/{param}/labels` in `services/chat.service.ts` (expects `string[]`)
- **POST** ``${this.baseUrl}/labels`` -> `/{param}/labels` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/labels/${encodeURIComponent(label)}`` -> `/{param}/labels/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/labels`` -> `/{param}/rooms/{param}/labels` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/rooms/${roomId}/labels/${encodeURIComponent(label)}`` -> `/{param}/rooms/{param}/labels/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/chat/messages/${messageId}/receipts`` -> `/{param}/chat/messages/{param}/receipts` in `services/chat.service.ts` (expects `MessageReceiptStatus`)
- **GET** ``${this.baseUrl}/rooms/${payload.room_id}/members`` -> `/{param}/rooms/{param}/members` in `services/chat.service.ts` (expects `{ user_id: string }[]`)
- **POST** ``${this.baseUrl}/messages`` -> `/{param}/messages` in `services/chat.service.ts` (expects `ChatMessage`)
- **POST** ``${this.baseUrl}/messages`` -> `/{param}/messages` in `services/chat.service.ts` (expects `ChatMessage`)
- **GET** ``${this.baseUrl}/messages/${roomId}`` -> `/{param}/messages/{param}` in `services/chat.service.ts` (expects `ChatMessage[]`)
- **GET** ``${this.baseUrl}/rooms`` -> `/{param}/rooms` in `services/chat.service.ts` (expects `ChatRoom[]`)
- **POST** ``${this.baseUrl}/messages/status-reply`` -> `/{param}/messages/status-reply` in `services/chat.service.ts` (expects `ChatMessage`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/lock`` -> `/{param}/rooms/{param}/lock` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/unlock`` -> `/{param}/rooms/{param}/unlock` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/locked-rooms`` -> `/{param}/locked-rooms` in `services/chat.service.ts` (expects `string[]`)
- **POST** ``${this.baseUrl}/favourites`` -> `/{param}/favourites` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/search`` -> `/{param}/search` in `services/chat.service.ts` (expects `ChatMessage[]`)
- **GET** ``${this.baseUrl}/favourites`` -> `/{param}/favourites` in `services/chat.service.ts` (expects `FavouriteRecord[]`)
- **DELETE** ``${this.baseUrl}/favourites/${favouriteId}`` -> `/{param}/favourites/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/safety/is-blocked/${userId}`` -> `/{param}/safety/is-blocked/{param}` in `services/chat.service.ts` (expects `{ blocked: boolean }`)
- **POST** ``${this.baseUrl}/messages/${messageId}/correct`` -> `/{param}/messages/{param}/correct` in `services/chat.service.ts` (expects `ChatMessage`)
- **PATCH** ``${this.baseUrl}/messages/${messageId}/fix`` -> `/{param}/messages/{param}/fix` in `services/chat.service.ts` (expects `ChatMessage`)
- **POST** ``${this.baseUrl}/groups`` -> `/{param}/groups` in `services/chat.service.ts` (expects `ChatRoom`)
- **PATCH** ``${this.baseUrl}/groups/${roomId}/rename`` -> `/{param}/groups/{param}/rename` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/groups/${roomId}/members`` -> `/{param}/groups/{param}/members` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/groups/${roomId}/members/${memberId}`` -> `/{param}/groups/{param}/members/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/groups/${roomId}/members`` -> `/{param}/groups/{param}/members` in `services/chat.service.ts` (expects `GroupMember[]`)
- **GET** ``${this.baseUrl}/rooms/${roomId}/members`` -> `/{param}/rooms/{param}/members` in `services/chat.service.ts` (expects `{ user_id: string; display_name?: string; avatar_url?: string | null }[]`)
- **POST** ``${environment.apiUrl}/nlp/translate`` -> `/{param}/nlp/translate` in `services/chat.service.ts` (expects `{ translated_text: string }`)
- **POST** ``${environment.apiUrl}/nlp/transcribe-voice`` -> `/{param}/nlp/transcribe-voice` in `services/chat.service.ts` (expects `{ original_text: string; detected_language: string; confidence: number }`)
- **POST** ``${this.baseUrl}/suggested-replies`` -> `/{param}/suggested-replies` in `services/chat.service.ts` (expects `{ suggestions: string[] }`)
- **POST** ``${this.baseUrl}/conversation-starters`` -> `/{param}/conversation-starters` in `services/chat.service.ts` (expects `{ suggestions: string[] }`)
- **POST** ``${environment.apiUrl}/chat/translate-voiceroom`` -> `/{param}/chat/translate-voiceroom` in `services/chat.service.ts` (expects `{ translated_text: string; detected_language: string }`)
- **GET** ``${this.baseUrl}/rooms/${roomId}/export`` -> `/{param}/rooms/{param}/export` in `services/chat.service.ts` (expects `ChatMessage[]`)
- **POST** ``${this.baseUrl}/rooms/${roomId}/wallpaper`` -> `/{param}/rooms/{param}/wallpaper` in `services/chat.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/rooms/${roomId}/wallpaper`` -> `/{param}/rooms/{param}/wallpaper` in `services/chat.service.ts` (expects `{ wallpaperUrl: string | null }`)
- **POST** ``${this.baseUrl}/typing`` -> `/{param}/typing` in `services/chat.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/messages/${messageId}`` -> `/{param}/messages/{param}` in `services/chat.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/messages/${messageId}/forward`` -> `/{param}/messages/{param}/forward` in `services/chat.service.ts` (expects `Unknown`)
- **PATCH** ``${this.baseUrl}/messages/${messageId}/status`` -> `/{param}/messages/{param}/status` in `services/chat.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/${communityId}`` -> `/{param}/{param}` in `services/communities.service.ts` (expects `Community`)
- **PATCH** ``${this.apiUrl}/${communityId}`` -> `/{param}/{param}` in `services/communities.service.ts` (expects `{ success: boolean }`)
- **DELETE** ``${this.apiUrl}/${communityId}`` -> `/{param}/{param}` in `services/communities.service.ts` (expects `void`)
- **POST** ``${this.apiUrl}/${communityId}/groups`` -> `/{param}/{param}/groups` in `services/communities.service.ts` (expects `{ success: boolean }`)
- **DELETE** ``${this.apiUrl}/${communityId}/groups/${groupId}`` -> `/{param}/{param}/groups/{param}` in `services/communities.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/${communityId}/groups`` -> `/{param}/{param}/groups` in `services/communities.service.ts` (expects `CommunityGroup[]`)
- **GET** ``${this.apiUrl}/${language}`` -> `/{param}/{param}` in `services/cultural-guide.service.ts` (expects `CulturalGuideResponse`)
- **GET** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/deck.service.ts` (expects `Deck`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/deck.service.ts` (expects `Deck`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/deck.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${deckId}/flashcards`` -> `/{param}/{param}/flashcards` in `services/deck.service.ts` (expects `void`)
- **DELETE** ``${this.baseUrl}/${deckId}/flashcards/${flashcardId}`` -> `/{param}/{param}/flashcards/{param}` in `services/deck.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/${deckId}/flashcards`` -> `/{param}/{param}/flashcards` in `services/deck.service.ts` (expects `{ id: string }[]`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `/{param}/analytics/client-error` in `services/discovery-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/partner-of-week`` -> `/{param}/partner-of-week` in `services/discovery.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/partners`` -> `/{param}/partners` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/search-by-location`` -> `/{param}/search-by-location` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/audio-intros`` -> `/{param}/audio-intros` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/recent-native-speakers`` -> `/{param}/recent-native-speakers` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/spotlight`` -> `/{param}/spotlight` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/language-pair`` -> `/{param}/language-pair` in `services/discovery.service.ts` (expects `UserProfile[]`)
- **POST** ``${environment.apiUrl}/nlp/translate-bio`` -> `/{param}/nlp/translate-bio` in `services/discovery.service.ts` (expects `{ translated_text: string }`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `/{param}/analytics/client-error` in `services/economy-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/catalog`` -> `/{param}/catalog` in `services/economy.store.ts` (expects `VirtualGift[]`)
- **GET** ``${this.baseUrl}/balance`` -> `/{param}/balance` in `services/economy.store.ts` (expects `{ coins_balance: number }`)
- **GET** ``${this.safetyUrl}/blocked-ids`` -> `/{param}/blocked-ids` in `services/economy.store.ts` (expects `string[]`)
- **POST** ``${this.baseUrl}/daily-check-in`` -> `/{param}/daily-check-in` in `services/economy.store.ts` (expects `{ claimed: boolean; coins_rewarded: number; new_balance: number }`)
- **GET** ``${this.baseUrl}/packages`` -> `/{param}/packages` in `services/economy.store.ts` (expects `CoinPackage[]`)
- **GET** ``${this.baseUrl}/health`` -> `/{param}/health` in `services/economy.store.ts` (expects `{
          overall: 'healthy' | 'degraded' | 'unavailable';
          degradedFeatures: string[];
        }`)
- **POST** ``${this.baseUrl}/create-checkout-session`` -> `/{param}/create-checkout-session` in `services/economy.store.ts` (expects `{ sessionUrl: string; sessionId: string }`)
- **POST** ``${this.baseUrl}/purchase-coins`` -> `/{param}/purchase-coins` in `services/economy.store.ts` (expects `{ coins: number; newBalance: number }`)
- **POST** ``${this.baseUrl}/send-gift`` -> `/{param}/send-gift` in `services/economy.store.ts` (expects `{ success: boolean; coins_remaining: number; gift: VirtualGift }`)
- **POST** ``${this.monetisationUrl}/create-checkout-session`` -> `/{param}/create-checkout-session` in `services/economy.store.ts` (expects `{ sessionUrl: string; sessionId: string }`)
- **GET** ``${this.monetisationUrl}/analytics`` -> `/{param}/analytics` in `services/economy.store.ts` (expects `DeveloperAnalytics`)
- **GET** ``${this.monetisationUrl}/diagnostics/logs`` -> `/{param}/diagnostics/logs` in `services/economy.store.ts` (expects `DiagnosticLogApiRecord[]`)
- **POST** ``${this.monetisationUrl}/diagnostics/logs`` -> `/{param}/diagnostics/logs` in `services/economy.store.ts` (expects `DiagnosticLogApiRecord`)
- **POST** ``${this.monetisationUrl}/generate-api-key`` -> `/{param}/generate-api-key` in `services/economy.store.ts` (expects `{ api_key: string; tier: string; rate_limit_rpm: number }`)
- **GET** ``${this.baseUrl}/transactions`` -> `/{param}/transactions` in `services/economy.store.ts` (expects `{ transactions: TransactionRecord[] }`)
- **GET** ``${this.baseUrl}/sticker-packs`` -> `/{param}/sticker-packs` in `services/economy.store.ts` (expects `{
          packs: StickerPack[];
          owned_pack_ids: string[];
          user_coins: number;
        }`)
- **POST** ``${this.baseUrl}/unlock-sticker-pack`` -> `/{param}/unlock-sticker-pack` in `services/economy.store.ts` (expects `{
          success: boolean;
          coins_remaining: number;
          pack: StickerPack;
        }`)
- **POST** ``${this.baseUrl}/create`` -> `/{param}/create` in `services/escrow.service.ts` (expects `EscrowCreateResult`)
- **POST** ``${this.baseUrl}/release`` -> `/{param}/release` in `services/escrow.service.ts` (expects `EscrowReleaseResult`)
- **POST** ``${this.baseUrl}/refund`` -> `/{param}/refund` in `services/escrow.service.ts` (expects `EscrowRefundResult`)
- **POST** ``${this.baseUrl}/dispute`` -> `/{param}/dispute` in `services/escrow.service.ts` (expects `EscrowRow`)
- **GET** ``${this.baseUrl}/${escrowId}`` -> `/{param}/{param}` in `services/escrow.service.ts` (expects `EscrowRow`)
- **GET** ``${environment.apiUrl}/events`` -> `/{param}/events` in `services/events.service.ts` (expects `Event[]`)
- **POST** ``${environment.apiUrl}/group-chats`` -> `/{param}/group-chats` in `services/events.service.ts` (expects `{ id: string }`)
- **GET** ``${environment.apiUrl}/group-chats/${chatId}`` -> `/{param}/group-chats/{param}` in `services/events.service.ts` (expects `{ id: string; name: string; description?: string; members: string[] }`)
- **PATCH** ``${environment.apiUrl}/group-chats/${chatId}`` -> `/{param}/group-chats/{param}` in `services/events.service.ts` (expects `void`)
- **DELETE** ``${environment.apiUrl}/group-chats/${chatId}`` -> `/{param}/group-chats/{param}` in `services/events.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/chats/${chatId}/labels`` -> `/{param}/chats/{param}/labels` in `services/events.service.ts` (expects `void`)
- **DELETE** ``${environment.apiUrl}/chats/${chatId}/labels/${label}`` -> `/{param}/chats/{param}/labels/{param}` in `services/events.service.ts` (expects `void`)
- **GET** ``${environment.apiUrl}/events/${eventId}`` -> `/{param}/events/{param}` in `services/events.service.ts` (expects `Event`)
- **POST** ``${environment.apiUrl}/events`` -> `/{param}/events` in `services/events.service.ts` (expects `Event`)
- **POST** ``${environment.apiUrl}/users/me/contact-sharing`` -> `/{param}/users/me/contact-sharing` in `services/events.service.ts` (expects `{ phone_number?: string; email?: string }`)
- **GET** ``${environment.apiUrl}/events/my`` -> `/{param}/events/my` in `services/events.service.ts` (expects `Event[]`)
- **GET** ``${environment.apiUrl}/events/${eventId}/rsvp`` -> `/{param}/events/{param}/rsvp` in `services/events.service.ts` (expects `{ id?: string; event_id: string; user_id: string; status: string } | null`)
- **POST** ``${environment.apiUrl}/events/${eventId}/rsvp`` -> `/{param}/events/{param}/rsvp` in `services/events.service.ts` (expects `{ id: string; event_id: string; user_id: string; status: string }`)
- **DELETE** ``${environment.apiUrl}/events/${eventId}/rsvp`` -> `/{param}/events/{param}/rsvp` in `services/events.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/faqs`` -> `/{param}/faqs` in `services/faq.service.ts` (expects `FAQ[]`)
- **POST** ``${this.baseUrl}/favourites`` -> `/{param}/favourites` in `services/favourite.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/favourites/${favouriteId}`` -> `/{param}/favourites/{param}` in `services/favourite.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/favourites`` -> `/{param}/favourites` in `services/favourite.service.ts` (expects `FavouriteRecord[]`)
- **GET** ``${this.baseUrl}/${momentId}`` -> `/{param}/{param}` in `services/feed.service.ts` (expects `Moment`)
- **DELETE** ``${this.baseUrl}/${momentId}`` -> `/{param}/{param}` in `services/feed.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/${momentId}/like`` -> `/{param}/{param}/like` in `services/feed.service.ts` (expects `Unknown`)
- **DELETE** ``${this.baseUrl}/${momentId}/like`` -> `/{param}/{param}/like` in `services/feed.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/${momentId}/comments`` -> `/{param}/{param}/comments` in `services/feed.service.ts` (expects `unknown[]`)
- **POST** ``${this.baseUrl}/${momentId}/comments`` -> `/{param}/{param}/comments` in `services/feed.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/health`` -> `/{param}/health` in `services/flashcard.service.ts` (expects `SrsHealthStatus`)
- **PATCH** ``${this.baseUrl}/${flashcardId}/srs`` -> `/{param}/{param}/srs` in `services/flashcard.service.ts` (expects `Flashcard`)
- **GET** ``${this.baseUrl}/due`` -> `/{param}/due` in `services/flashcard.service.ts` (expects `Flashcard[]`)
- **PATCH** ``${this.baseUrl}/${item.flashcardId}/srs`` -> `/{param}/{param}/srs` in `services/flashcard.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/${groupId}/restrict-send-messages`` -> `/{param}/{param}/restrict-send-messages` in `services/groups.service.ts` (expects `void`)
- **POST** ``${this.apiUrl}/${groupId}/restrict-edit-info`` -> `/{param}/{param}/restrict-edit-info` in `services/groups.service.ts` (expects `void`)
- **PUT** ``${this.apiUrl}/${groupId}/rename`` -> `/{param}/{param}/rename` in `services/groups.service.ts` (expects `ChatGroup`)
- **GET** ``${this.apiUrl}/mine`` -> `/{param}/mine` in `services/groups.service.ts` (expects `ChatGroup[]`)
- **POST** ``${this.apiUrl}/${groupId}/add-member`` -> `/{param}/{param}/add-member` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/${groupId}/remove-member`` -> `/{param}/{param}/remove-member` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/${roomId}/invite-code`` -> `/{param}/{param}/invite-code` in `services/groups.service.ts` (expects `{ code: string }`)
- **GET** ``${this.apiUrl}/${roomId}/invite-link`` -> `/{param}/{param}/invite-link` in `services/groups.service.ts` (expects `{ code: string; url: string }`)
- **GET** ``${this.apiUrl}/invite-info/${code}`` -> `/{param}/invite-info/{param}` in `services/groups.service.ts` (expects `{ roomId: string; title: string }`)
- **POST** ``${this.apiUrl}/join-by-code`` -> `/{param}/join-by-code` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.apiUrl}/${groupId}/announcement`` -> `/{param}/{param}/announcement` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/${groupId}/announcements`` -> `/{param}/{param}/announcements` in `services/groups.service.ts` (expects `ChatAnnouncement[]`)
- **POST** ``${this.apiUrl}/announcement-group`` -> `/{param}/announcement-group` in `services/groups.service.ts` (expects `ChatGroup`)
- **POST** ``${this.apiUrl}/${groupId}/broadcast`` -> `/{param}/{param}/broadcast` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/discoverable`` -> `/{param}/discoverable` in `services/groups.service.ts` (expects `DiscoverableGroup[]`)
- **POST** ``${this.apiUrl}/${groupId}/join`` -> `/{param}/{param}/join` in `services/groups.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.baseUrl}/articles`` -> `/{param}/articles` in `services/help-centre.service.ts` (expects `HelpResponse`)
- **GET** ``${this.baseUrl}/categories`` -> `/{param}/categories` in `services/help-centre.service.ts` (expects `string[]`)
- **GET** ``${environment.apiUrl}/help/articles?${params}`` -> `/{param}/help/articles?{param}` in `services/help-faq.service.ts` (expects `FAQResponse`)
- **GET** ``${environment.apiUrl}/help/categories`` -> `/{param}/help/categories` in `services/help-faq.service.ts` (expects `string[]`)
- **GET** ``${environment.apiUrl}/help/quick-replies`` -> `/{param}/help/quick-replies` in `services/help-faq.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/articles`` -> `/{param}/articles` in `services/help.service.ts` (expects `HelpResult`)
- **GET** ``${this.baseUrl}/categories`` -> `/{param}/categories` in `services/help.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/my`` -> `/{param}/my` in `services/hobby-tags.service.ts` (expects `UserHobbyTag[]`)
- **POST** ``${this.apiUrl}/my`` -> `/{param}/my` in `services/hobby-tags.service.ts` (expects `UserHobbyTag`)
- **DELETE** ``${this.apiUrl}/my/${hobbyTagId}`` -> `/{param}/my/{param}` in `services/hobby-tags.service.ts` (expects `{ success: boolean }`)
- **PATCH** ``${this.apiUrl}/my/${hobbyTagId}/proficiency`` -> `/{param}/my/{param}/proficiency` in `services/hobby-tags.service.ts` (expects `UserHobbyTag`)
- **GET** ``${this.apiUrl}/vocabulary`` -> `/{param}/vocabulary` in `services/hobby-tags.service.ts` (expects `Array<VocabularyItem>`)
- **POST** ``${environment.apiUrl}/nlp/translate-ui`` -> `/{param}/nlp/translate-ui` in `services/i18n.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/language-islands.service.ts` (expects `LanguageIsland`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/language-islands.service.ts` (expects `LanguageIsland`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/language-islands.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${id}/join`` -> `/{param}/{param}/join` in `services/language-islands.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/${id}/leave`` -> `/{param}/{param}/leave` in `services/language-islands.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/my`` -> `/{param}/my` in `services/language-islands.service.ts` (expects `LanguageIsland[]`)
- **GET** ``${this.baseUrl}/terms`` -> `/{param}/terms` in `services/legal.service.ts` (expects `LegalDocument`)
- **GET** ``${this.baseUrl}/privacy`` -> `/{param}/privacy` in `services/legal.service.ts` (expects `LegalDocument`)
- **GET** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/lesson.service.ts` (expects `Lesson`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/lesson.service.ts` (expects `Lesson`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/lesson.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/link`` -> `/{param}/link` in `services/linked-accounts.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/unlink`` -> `/{param}/unlink` in `services/linked-accounts.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/video-calls/accept`` -> `/{param}/video-calls/accept` in `services/livekit.service.ts` (expects `VideoClassroomTokenResponse`)
- **POST** ``${environment.apiUrl}/video-calls/start`` -> `/{param}/video-calls/start` in `services/livekit.service.ts` (expects `VideoClassroomTokenResponse`)
- **GET** ``${environment.apiUrl}/location/${userId}/current`` -> `/{param}/location/{param}/current` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/location/${userId}/current`` -> `/{param}/location/{param}/current` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/location/${userId}/live/start`` -> `/{param}/location/{param}/live/start` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/location/${userId}/live/update`` -> `/{param}/location/{param}/live/update` in `services/location.service.ts` (expects `Unknown`)
- **DELETE** ``${environment.apiUrl}/location/${userId}/live`` -> `/{param}/location/{param}/live` in `services/location.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/location/${sharerUserId}/live`` -> `/{param}/location/{param}/live` in `services/location.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/media/moments/presigned-url`` -> `/{param}/media/moments/presigned-url` in `services/media-upload.service.ts` (expects `{
        uploadUrl: string;
        mediaUrl: string;
        objectKey: string;
        mediaKind: 'image' | 'video';
      }`)
- **POST** ``${this.baseUrl}/avatar/upload`` -> `/{param}/avatar/upload` in `services/media.service.ts` (expects `AvatarUploadResponse`)
- **POST** ``${this.baseUrl}/voice-note`` -> `/{param}/voice-note` in `services/media.service.ts` (expects `VoiceNoteUploadResponse`)
- **POST** ``${this.baseUrl}/view-once/mark-viewed`` -> `/{param}/view-once/mark-viewed` in `services/media.service.ts` (expects `void`)
- **GET** ``${this.apiUrl}/progress`` -> `/{param}/progress` in `services/milestone.service.ts` (expects `MilestoneProgress`)
- **POST** ``${this.apiUrl}/${id}/complete`` -> `/{param}/{param}/complete` in `services/milestone.service.ts` (expects `Milestone`)
- **DELETE** ``${this.apiUrl}/${id}`` -> `/{param}/{param}` in `services/milestone.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/items`` -> `/{param}/items` in `services/moderation.service.ts` (expects `ModerationItem[]`)
- **POST** ``${this.baseUrl}/approve`` -> `/{param}/approve` in `services/moderation.service.ts` (expects `ModerationActionResponse`)
- **POST** ``${this.baseUrl}/reject`` -> `/{param}/reject` in `services/moderation.service.ts` (expects `ModerationActionResponse`)
- **POST** ``${this.baseUrl}/report`` -> `/{param}/report` in `services/moderation.service.ts` (expects `ModerationActionResponse`)
- **GET** ``${this.baseUrl}/analyse/${userId}`` -> `/{param}/analyse/{param}` in `services/moderation.service.ts` (expects `UserAnalysisResult`)
- **GET** ``${this.baseUrl}/feed`` -> `/{param}/feed` in `services/moments.store.ts` (expects `MomentRecord[]`)
- **POST** ``${this.baseUrl}/${momentId}/like`` -> `/{param}/{param}/like` in `services/moments.store.ts` (expects `{ likes_count: number; is_liked: boolean }`)
- **GET** ``${this.baseUrl}/${momentId}/comments`` -> `/{param}/{param}/comments` in `services/moments.store.ts` (expects `MomentComment[]`)
- **POST** ``${this.baseUrl}/${momentId}/comments`` -> `/{param}/{param}/comments` in `services/moments.store.ts` (expects `MomentComment`)
- **POST** ``${this.baseUrl}/${momentId}/comments/${commentId}/vote`` -> `/{param}/{param}/comments/{param}/vote` in `services/moments.store.ts` (expects `VoteCorrectionResponse`)
- **PATCH** ``${this.baseUrl}/${momentId}/pin`` -> `/{param}/{param}/pin` in `services/moments.store.ts` (expects `MomentRecord`)
- **POST** ``${this.baseUrl}/create-checkout-session`` -> `/{param}/create-checkout-session` in `services/monetisation.service.ts` (expects `CreateCheckoutSessionResponse`)
- **POST** ``${this.baseUrl}/generate-api-key`` -> `/{param}/generate-api-key` in `services/monetisation.service.ts` (expects `GenerateApiKeyResponse`)
- **GET** ``${this.baseUrl}/analytics`` -> `/{param}/analytics` in `services/monetisation.service.ts` (expects `DeveloperAnalyticsResponse`)
- **GET** ``${this.baseUrl}/diagnostics/logs`` -> `/{param}/diagnostics/logs` in `services/monetisation.service.ts` (expects `DiagnosticLog[]`)
- **POST** ``${this.baseUrl}/diagnostics/logs`` -> `/{param}/diagnostics/logs` in `services/monetisation.service.ts` (expects `DiagnosticLog`)
- **POST** ``${this.baseUrl}/validate-apple-receipt`` -> `/{param}/validate-apple-receipt` in `services/monetisation.service.ts` (expects `AppleReceiptValidationResponse`)
- **POST** ``${this.baseUrl}/restore-purchases`` -> `/{param}/restore-purchases` in `services/monetisation.service.ts` (expects `{ received: boolean; status: string }`)
- **GET** ``${this.baseUrl}/coins-balance`` -> `/{param}/coins-balance` in `services/monetisation.service.ts` (expects `{ coins_balance: number }`)
- **POST** ``${environment.apiUrl}/nlp/explain-grammar`` -> `/{param}/nlp/explain-grammar` in `services/nlp.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/nlp/simplify`` -> `/{param}/nlp/simplify` in `services/nlp.service.ts` (expects `Unknown`)
- **GET** ``${this.notificationsUrl}/preferences`` -> `/{param}/preferences` in `services/notification-preferences.service.ts` (expects `LegacyNotificationPreferences`)
- **PUT** ``${this.notificationsUrl}/preferences`` -> `/{param}/preferences` in `services/notification-preferences.service.ts` (expects `{ success: boolean; preferences: LegacyNotificationPreferences }`)
- **PATCH** ``${environment.apiUrl}/users/me/notification-preferences`` -> `/{param}/users/me/notification-preferences` in `services/notification-preferences.service.ts` (expects `void`)
- **GET** ``${environment.apiUrl}/users/me/notification-preferences`` -> `/{param}/users/me/notification-preferences` in `services/notification-preferences.service.ts` (expects `{ custom_tone_url?: string; vibration_pattern?: number[] }`)
- **GET** ``${this.baseUrl}/unread-count`` -> `/{param}/unread-count` in `services/notification.service.ts` (expects `{ unreadCount: number }`)
- **PATCH** ``${this.baseUrl}/${notificationId}/read`` -> `/{param}/{param}/read` in `services/notification.service.ts` (expects `void`)
- **PATCH** ``${this.baseUrl}/read-all`` -> `/{param}/read-all` in `services/notification.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/users/onboarding`` -> `/{param}/users/onboarding` in `services/onboarding.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/proficiency/assess`` -> `/{param}/proficiency/assess` in `services/proficiency.service.ts` (expects `AssessmentResult`)
- **POST** ``${environment.apiUrl}/proficiency/languages`` -> `/{param}/proficiency/languages` in `services/proficiency.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.baseUrl}/my-visitors`` -> `/{param}/my-visitors` in `services/profile-visits.service.ts` (expects `ProfileVisit[]`)
- **POST** ``${this.baseUrl}/${viewedId}`` -> `/{param}/{param}` in `services/profile-visits.service.ts` (expects `void`)
- **POST** ``${this.apiUrl}/voice-feedback`` -> `/{param}/voice-feedback` in `services/pronunciation.service.ts` (expects `{ success: boolean }`)
- **GET** ``${environment.apiUrl}/quests`` -> `/{param}/quests` in `services/quests.store.ts` (expects `Quest[]`)
- **GET** ``/api/audio-rooms${path}`` -> `/audio-rooms{param}` in `services/quick-poll.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/chat/quick-replies`` -> `/{param}/chat/quick-replies` in `services/quick-replies.service.ts` (expects `QuickReply[]`)
- **POST** ``${this.apiUrl}/chat/quick-replies`` -> `/{param}/chat/quick-replies` in `services/quick-replies.service.ts` (expects `QuickReply`)
- **GET** ``/api/quiz/questions?language=${language}`` -> `/quiz/questions?language={param}` in `services/quiz.service.ts` (expects `QuizQuestion[]`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `/{param}/analytics/client-error` in `services/reading-engine-crash-reporting.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `/{param}/analytics/client-error` in `services/reading-engine-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/resource-library.service.ts` (expects `ResourceItem`)
- **PATCH** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/resource-library.service.ts` (expects `ResourceItem`)
- **DELETE** ``${this.baseUrl}/${id}`` -> `/{param}/{param}` in `services/resource-library.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/monetisation/restore-purchases`` -> `/{param}/monetisation/restore-purchases` in `services/restore-purchases.service.ts` (expects `RestorePurchasesApiResponse`)
- **GET** ``${this.apiUrl}/safety/blocked-ids`` -> `/{param}/safety/blocked-ids` in `services/safety.service.ts` (expects `string[]`)
- **POST** ``${this.apiUrl}/safety/report`` -> `/{param}/safety/report` in `services/safety.service.ts` (expects `ReportResponse`)
- **POST** ``${this.apiUrl}/safety/block/${blockedId}`` -> `/{param}/safety/block/{param}` in `services/safety.service.ts` (expects `{ success: boolean; blocked_id: string }`)
- **POST** ``${this.apiUrl}/safety/unblock/${blockedId}`` -> `/{param}/safety/unblock/{param}` in `services/safety.service.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiUrl}/safety/blocked-ids`` -> `/{param}/safety/blocked-ids` in `services/safety.service.ts` (expects `string[]`)
- **POST** ``${this.apiUrl}/safety/silence-unknown-callers`` -> `/{param}/safety/silence-unknown-callers` in `services/safety.service.ts` (expects `void`)
- **GET** ``${this.apiUrl}/safety/silence-unknown-callers/${userId}`` -> `/{param}/safety/silence-unknown-callers/{param}` in `services/safety.service.ts` (expects `{ silenceUnknownCallers: boolean }`)
- **GET** ``${this.apiUrl}/safety/report-categories`` -> `/{param}/safety/report-categories` in `services/safety.service.ts` (expects `ReportCategory[]`)
- **GET** ``${this.apiUrl}/safety/blocked-ids/${userId}`` -> `/{param}/safety/blocked-ids/{param}` in `services/safety.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/safety/blocker-ids/${userId}`` -> `/{param}/safety/blocker-ids/{param}` in `services/safety.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/safety/blocked-and-blocker-ids/${userId}`` -> `/{param}/safety/blocked-and-blocker-ids/{param}` in `services/safety.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/safety/is-blocked/${userId}`` -> `/{param}/safety/is-blocked/{param}` in `services/safety.service.ts` (expects `{ blocked: boolean }`)
- **GET** ``${environment.apiUrl}/favourites`` -> `/{param}/favourites` in `services/saved-content.service.ts` (expects `SavedContent[]`)
- **GET** ``${this.baseUrl}/list`` -> `/{param}/list` in `services/soundboard.service.ts` (expects `Unknown`)
- **POST** ``${this.baseUrl}/play`` -> `/{param}/play` in `services/soundboard.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/create-checkout-session`` -> `/{param}/create-checkout-session` in `services/stripe.service.ts` (expects `CreateCheckoutSessionResponse`)
- **POST** ``${this.apiUrl}/study-buddies/follow`` -> `/{param}/study-buddies/follow` in `services/study-buddies.service.ts` (expects `Unknown`)
- **DELETE** ``${this.apiUrl}/study-buddies/unfollow`` -> `/{param}/study-buddies/unfollow` in `services/study-buddies.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/study-buddies/channel`` -> `/{param}/study-buddies/channel` in `services/study-buddies.service.ts` (expects `{ channel: string }`)
- **POST** ``${this.apiUrl}/study-buddies/request`` -> `/{param}/study-buddies/request` in `services/study-buddy.service.ts` (expects `Unknown`)
- **GET** ``${this.apiUrl}/study-buddies/matches`` -> `/{param}/study-buddies/matches` in `services/study-buddy.service.ts` (expects `Record<string, unknown>[]`)
- **GET** ``${this.apiUrl}/study-buddies/requests`` -> `/{param}/study-buddies/requests` in `services/study-buddy.service.ts` (expects `BuddyRequest[]`)
- **POST** ``${this.apiUrl}/study-buddies/requests/${id}/accept`` -> `/{param}/study-buddies/requests/{param}/accept` in `services/study-buddy.service.ts` (expects `Unknown`)
- **POST** ``${this.apiUrl}/study-buddies/requests/${id}/decline`` -> `/{param}/study-buddies/requests/{param}/decline` in `services/study-buddy.service.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/study-streak/me`` -> `/{param}/study-streak/me` in `services/study-streak.service.ts` (expects `{ streak: number }`)
- **POST** ``${environment.apiUrl}/study-streak/checkin`` -> `/{param}/study-streak/checkin` in `services/study-streak.service.ts` (expects `{ streak: number }`)
- **GET** ``${this.apiUrl}/${id}`` -> `/{param}/{param}` in `services/subscription-plans.service.ts` (expects `SubscriptionPlan`)
- **GET** ``${this.apiUrl}/${planId}/benefits`` -> `/{param}/{param}/benefits` in `services/subscription-plans.service.ts` (expects `string[]`)
- **GET** ``${this.apiUrl}/showcase`` -> `/{param}/showcase` in `services/subscription-plans.service.ts` (expects `SubscriptionPlan[]`)
- **GET** ``${this.baseUrl}/subscription`` -> `/{param}/subscription` in `services/subscription.service.ts` (expects `SubscriptionDetails`)
- **POST** ``${this.baseUrl}/subscription/cancel`` -> `/{param}/subscription/cancel` in `services/subscription.service.ts` (expects `CancelSubscriptionResponse`)
- **POST** ``${this.baseUrl}/subscription/resume`` -> `/{param}/subscription/resume` in `services/subscription.service.ts` (expects `ResumeSubscriptionResponse`)
- **GET** ``${this.baseUrl}/subscription/invoices`` -> `/{param}/subscription/invoices` in `services/subscription.service.ts` (expects `SubscriptionInvoice[]`)
- **POST** ``${this.baseUrl}/subscription/billing-portal`` -> `/{param}/subscription/billing-portal` in `services/subscription.service.ts` (expects `BillingPortalSessionResponse`)
- **POST** ``${this.baseUrl}/avatar/upload`` -> `/{param}/avatar/upload` in `services/upload.service.ts` (expects `UploadResult`)
- **GET** ``${this.baseUrl}/tags`` -> `/{param}/tags` in `services/user-interests.service.ts` (expects `{ tags: string[] }`)
- **POST** ``${this.baseUrl}/tags`` -> `/{param}/tags` in `services/user-interests.service.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/vocabulary`` -> `/{param}/vocabulary` in `services/user-interests.service.ts` (expects `{ entries: VocabularyEntry[] }`)
- **GET** ``${this.baseUrl}/me`` -> `/{param}/me` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.baseUrl}/${userId}`` -> `/{param}/{param}` in `services/user.service.ts` (expects `UserProfile`)
- **POST** ``${this.baseUrl}/${userId}/follow`` -> `/{param}/{param}/follow` in `services/user.service.ts` (expects `void`)
- **DELETE** ``${this.baseUrl}/${userId}/follow`` -> `/{param}/{param}/follow` in `services/user.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/${userId}/followers`` -> `/{param}/{param}/followers` in `services/user.service.ts` (expects `{ data: UserProfile[]; total: number }`)
- **GET** ``${this.baseUrl}/${userId}/following`` -> `/{param}/{param}/following` in `services/user.service.ts` (expects `{ data: UserProfile[]; total: number }`)
- **POST** ``${this.baseUrl}/${userId}/like`` -> `/{param}/{param}/like` in `services/user.service.ts` (expects `void`)
- **PATCH** ``${this.baseUrl}/me`` -> `/{param}/me` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.visitsUrl}/my-visitors`` -> `/{param}/my-visitors` in `services/user.service.ts` (expects `VisitorLog[]`)
- **GET** ``${this.baseUrl}/me/visitors`` -> `/{param}/me/visitors` in `services/user.service.ts` (expects `ProfileVisitor[]`)
- **POST** ``${this.visitsUrl}/${viewedUserId}`` -> `/{param}/{param}` in `services/user.service.ts` (expects `Unknown`)
- **POST** ``${this.mediaUrl}/presigned-url`` -> `/{param}/presigned-url` in `services/user.service.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **POST** ``${this.baseUrl}/me/cover-photo/presigned-url`` -> `/{param}/me/cover-photo/presigned-url` in `services/user.service.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **POST** ``${this.baseUrl}/me/avatar/presigned-url`` -> `/{param}/me/avatar/presigned-url` in `services/user.service.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **PATCH** ``${this.baseUrl}/me/cover-photo`` -> `/{param}/me/cover-photo` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.baseUrl}/me/export`` -> `/{param}/me/export` in `services/user.service.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/corrector-score/rate`` -> `/{param}/corrector-score/rate` in `services/user.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/me/linked-accounts`` -> `/{param}/me/linked-accounts` in `services/user.service.ts` (expects `LinkedAccount[]`)
- **GET** ``${this.baseUrl}/me/privacy-settings`` -> `/{param}/me/privacy-settings` in `services/user.service.ts` (expects `{
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
- **POST** ``${this.baseUrl}/me/linked-accounts/link`` -> `/{param}/me/linked-accounts/link` in `services/user.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/me/linked-accounts/unlink`` -> `/{param}/me/linked-accounts/unlink` in `services/user.service.ts` (expects `void`)
- **GET** ``${this.baseUrl}/me/stats`` -> `/{param}/me/stats` in `services/user.service.ts` (expects `Partial<UserProfile>`)
- **GET** ``${this.baseUrl}/hobbies`` -> `/{param}/hobbies` in `services/user.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/interests`` -> `/{param}/interests` in `services/user.service.ts` (expects `string[]`)
- **GET** ``${this.baseUrl}/search`` -> `/{param}/search` in `services/user.service.ts` (expects `{ id: string; display_name: string; avatar_url: string | null }[]`)
- **POST** ``${this.baseUrl}/query-language-pairs`` -> `/{param}/query-language-pairs` in `services/user.service.ts` (expects `UserProfile[]`)
- **GET** ``${this.baseUrl}/me/badges`` -> `/{param}/me/badges` in `services/user.service.ts` (expects `Badge[]`)
- **POST** ``${this.baseUrl}/me/assess-proficiency`` -> `/{param}/me/assess-proficiency` in `services/user.service.ts` (expects `{ level: string }`)
- **GET** ``${this.baseUrl}/stats/me`` -> `/{param}/stats/me` in `services/user.service.ts` (expects `{
          translations_count: number;
          corrections_count: number;
          moments_count: number;
        }`)
- **GET** ``${this.baseUrl}/me/xp`` -> `/{param}/me/xp` in `services/user.service.ts` (expects `{ totalXp: number }`)
- **PATCH** ``${this.baseUrl}/me/privacy`` -> `/{param}/me/privacy` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${this.baseUrl}/me/business`` -> `/{param}/me/business` in `services/user.service.ts` (expects `{
        business_name?: string;
        business_hours?: string;
        website_url?: string;
        catalog?: BusinessCatalogItem[];
      }`)
- **PATCH** ``${this.baseUrl}/me/business`` -> `/{param}/me/business` in `services/user.service.ts` (expects `UserProfile`)
- **POST** ``${environment.apiUrl}/safety/block`` -> `/{param}/safety/block` in `services/user.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/safety/unblock`` -> `/{param}/safety/unblock` in `services/user.service.ts` (expects `void`)
- **POST** ``${environment.apiUrl}/safety/report`` -> `/{param}/safety/report` in `services/user.service.ts` (expects `void`)
- **POST** ``${this.baseUrl}/fcm/subscribe`` -> `/{param}/fcm/subscribe` in `services/user.service.ts` (expects `{ success: boolean }`)
- **POST** ``${this.baseUrl}/fcm/unsubscribe`` -> `/{param}/fcm/unsubscribe` in `services/user.service.ts` (expects `{ success: boolean }`)
- **DELETE** ``${this.baseUrl}/me`` -> `/{param}/me` in `services/user.service.ts` (expects `{ message: string; scheduled_for_deletion_at: string }`)
- **POST** ``${this.baseUrl}/me/restore`` -> `/{param}/me/restore` in `services/user.service.ts` (expects `{ message: string }`)
- **GET** ``${this.baseUrl}/me/message-filters`` -> `/{param}/me/message-filters` in `services/user.service.ts` (expects `{
          age_min?: number;
          age_max?: number;
          allowed_genders?: string[];
          allowed_native_languages?: string[];
        }`)
- **PUT** ``${this.baseUrl}/me/message-filters`` -> `/{param}/me/message-filters` in `services/user.service.ts` (expects `void`)
- **PATCH** ``${this.baseUrl}/me/dnd`` -> `/{param}/me/dnd` in `services/user.service.ts` (expects `UserProfile`)
- **GET** ``${environment.apiUrl}/version`` -> `/{param}/version` in `services/version.service.ts` (expects `VersionInfo`)
- **POST** ``${environment.apiUrl}/video-calls/start`` -> `/{param}/video-calls/start` in `services/video-call.service.ts` (expects `{ token: string; roomName: string }`)
- **POST** ``${environment.apiUrl}/analytics/client-error`` -> `/{param}/analytics/client-error` in `services/video-classroom-error-handler.service.ts` (expects `Unknown`)
- **GET** ``${this.flashcardsUrl}/due`` -> `/{param}/due` in `services/vocabulary.store.ts` (expects `Flashcard[]`)
- **PATCH** ``${this.flashcardsUrl}/${flashcardId}/srs`` -> `/{param}/{param}/srs` in `services/vocabulary.store.ts` (expects `Flashcard`)
- **PATCH** ``${this.flashcardsUrl}/${item.flashcardId}/srs`` -> `/{param}/{param}/srs` in `services/vocabulary.store.ts` (expects `Flashcard`)
- **POST** ``${this.nlpUrl}/translate`` -> `/{param}/translate` in `services/vocabulary.store.ts` (expects `TranslationResult`)
- **POST** ``${this.nlpUrl}/grammar-check`` -> `/{param}/grammar-check` in `services/vocabulary.store.ts` (expects `GrammarCheckResult`)
- **POST** ``${this.nlpUrl}/pronunciation-score`` -> `/{param}/pronunciation-score` in `services/vocabulary.store.ts` (expects `PronunciationScoreResult`)
- **GET** ``${environment.apiUrl}/shopping/cart`` -> `/{param}/shopping/cart` in `components/cart/cart.component.ts` (expects `CartItem[]`)
- **DELETE** ``${environment.apiUrl}/shopping/cart`` -> `/{param}/shopping/cart` in `components/cart/cart.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/shopping/cart/checkout`` -> `/{param}/shopping/cart/checkout` in `components/cart/cart.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/nlp/transcribe-audio`` -> `/{param}/nlp/transcribe-audio` in `components/chat-message/chat-message.component.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/list`` -> `/{param}/list` in `components/classrooms-marketplace/classrooms-marketplace.ts` (expects `AudioRoomRecord[]`)
- **POST** ``${environment.apiUrl}/media/cover/presigned-url`` -> `/{param}/media/cover/presigned-url` in `components/cover-photo-uploader/cover-photo-uploader.component.ts` (expects `{ uploadUrl: string; mediaUrl: string; objectKey: string }`)
- **POST** ``${environment.apiUrl}/media/cover/confirm`` -> `/{param}/media/cover/confirm` in `components/cover-photo-uploader/cover-photo-uploader.component.ts` (expects `{ coverUrl: string }`)
- **GET** ``${environment.apiUrl}/daily-tip`` -> `/{param}/daily-tip` in `components/daily-learning-tip/daily-learning-tip.component.ts` (expects `Unknown`)
- **POST** ``${environment.apiUrl}/transfer/consume`` -> `/{param}/transfer/consume` in `components/device-transfer/device-transfer.component.ts` (expects `{ swapToken: string }`)
- **POST** ``${environment.apiUrl}/transfer/swap`` -> `/{param}/transfer/swap` in `components/device-transfer/device-transfer.component.ts` (expects `{ access_token: string; refresh_token: string; user_id: string }`)
- **GET** ``${this.apiUrl}/interests?language=${lang}`` -> `/{param}/interests?language={param}` in `components/groups-discovery/groups-discovery.component.ts` (expects `InterestTopic[]`)
- **GET** ``${this.apiUrl}/groups/discoverable`` -> `/{param}/groups/discoverable` in `components/groups-discovery/groups-discovery.component.ts` (expects `DiscoverableGroup[]`)
- **POST** ``${this.apiUrl}/groups/${groupId}/join`` -> `/{param}/groups/{param}/join` in `components/groups-discovery/groups-discovery.component.ts` (expects `unknown`)
- **GET** ``${environment.apiUrl}/audio-rooms/list?${queryParams.toString()}`` -> `/{param}/audio-rooms/list?{param}` in `components/language-parties/language-parties.component.ts` (expects `LanguageParty[]`)
- **POST** ``${environment.apiUrl}/audio-rooms/language-parties`` -> `/{param}/audio-rooms/language-parties` in `components/language-parties/language-parties.component.ts` (expects `AudioRoomRecord`)
- **GET** ``${environment.apiUrl}/audio-rooms/${party.id}`` -> `/{param}/audio-rooms/{param}` in `components/language-parties/language-parties.component.ts` (expects `AudioRoomRecord`)
- **POST** ``${this.apiUrl}/moments/${questionId}/answer`` -> `/{param}/moments/{param}/answer` in `components/language-questions/language-questions.component.ts` (expects `{ correct: boolean }`)
- **GET** ``${environment.apiUrl}/leaderboard/top-correctors?limit=20`` -> `/{param}/leaderboard/top-correctors?limit=20` in `components/leaderboard/leaderboard.component.ts` (expects `Corrector[]`)
- **POST** ``${environment.apiUrl}/nlp/translate`` -> `/{param}/nlp/translate` in `components/moment-translate/moment-translate.component.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/stats/me`` -> `/{param}/stats/me` in `components/my-stats/my-stats.component.ts` (expects `Unknown`)
- **GET** ``${environment.apiUrl}/shopping/catalog`` -> `/{param}/shopping/catalog` in `components/shop/shop.component.ts` (expects `CatalogItem[]`)
- **POST** ``${environment.apiUrl}/shopping/cart`` -> `/{param}/shopping/cart` in `components/shop/shop.component.ts` (expects `{ success: boolean }`)
- **POST** ``${environment.apiUrl}/monetisation/create-checkout-session`` -> `/{param}/monetisation/create-checkout-session` in `components/subscription-plans/subscription-plans.component.ts` (expects `{ sessionUrl: string; sessionId: string }`)
- **GET** ``${environment.apiUrl}/word-of-the-day`` -> `/{param}/word-of-the-day` in `components/word-of-the-day/word-of-the-day.component.ts` (expects `Unknown`)
- **GET** ``${this.baseUrl}/scenarios`` -> `/{param}/scenarios` in `pages/chat/ai-conversation.service.ts` (expects `Scenario[]`)
- **POST** ``${this.baseUrl}/message`` -> `/{param}/message` in `pages/chat/ai-conversation.service.ts` (expects `AiMessageReply`)
- **POST** ``${apiUrl}/groups/join-by-code`` -> `/{param}/groups/join-by-code` in `pages/join-group/join-group.component.ts` (expects `{ success: boolean }`)
- **GET** ``${this.apiBase}/chat/rooms`` -> `/{param}/chat/rooms` in `pages/settings/backup-restore.component.ts` (expects `unknown`)
- **GET** ``${environment.apiUrl}/audio-rooms/${roomId}`` -> `/{param}/audio-rooms/{param}` in `pages/voiceroom-preview/voiceroom-preview.component.ts` (expects `RoomPreview`)

## Unused Backend Routes

- **GET** `/` in `app.controller.ts` (function: `getHello`)
- **GET** `/health` in `app.controller.ts` (function: `getHealth`)
- **GET** `/achievements` in `achievements/achievements.controller.ts` (function: `listAchievements`)
- **GET** `/achievements/user/:userId` in `achievements/achievements.controller.ts` (function: `getUserAchievements`)
- **GET** `/achievements/full/:userId` in `achievements/achievements.controller.ts` (function: `getFullAchievements`)
- **GET** `/achievements/my` in `achievements/achievements.controller.ts` (function: `getMyAchievements`)
- **POST** `/achievements/evaluate` in `achievements/achievements.controller.ts` (function: `evaluateForCurrentUser`)
- **POST** `/achievements/evaluate/:userId` in `achievements/achievements.controller.ts` (function: `evaluateForUser`)
- **GET** `/admin/v1/logs` in `admin/admin-operational-events-v1.controller.ts` (function: `list`)
- **GET** `/admin/v1/roles/assignments` in `admin/admin-roles-v1.controller.ts` (function: `listAssignments`)
- **GET** `/admin/v1/me` in `admin/admin-v1.controller.ts` (function: `getMe`)
- **GET** `/admin/v1/roles` in `admin/admin-v1.controller.ts` (function: `listRoles`)
- **GET** `/admin/v1/system/health` in `admin/admin-v1.controller.ts` (function: `getSystemHealth`)
- **GET** `/admin/v1/audit` in `admin/admin-v1.controller.ts` (function: `listAudit`)
- **GET** `/admin/v1/moderation/reports` in `admin/admin-v1.controller.ts` (function: `listModerationReports`)
- **GET** `/admin/v1/users` in `admin/admin-v1.controller.ts` (function: `listUsers`)
- **GET** `/admin/v1/users/:id/login-history` in `admin/admin-v1.controller.ts` (function: `getUserLoginHistory`)
- **GET** `/admin/v1/users/:id` in `admin/admin-v1.controller.ts` (function: `getUser`)
- **GET** `/admin/users` in `admin/admin.controller.ts` (function: `listUsers`)
- **PATCH** `/admin/users/:id/vip` in `admin/admin.controller.ts` (function: `setVipStatus`)
- **GET** `/admin/users/:id/login-history` in `admin/admin.controller.ts` (function: `getLoginHistory`)
- **POST** `/admin/users/:id/ban` in `admin/admin.controller.ts` (function: `banUser`)
- **POST** `/admin/users/:id/warn` in `admin/admin.controller.ts` (function: `warnUser`)
- **GET** `/admin/blocks` in `admin/admin.controller.ts` (function: `listAllBlocks`)
- **GET** `/admin/reports` in `admin/admin.controller.ts` (function: `listReports`)
- **DELETE** `/admin/blocks/:blockId` in `admin/admin.controller.ts` (function: `removeBlock`)
- **GET** `/ai-conversation/scenarios` in `ai-conversation/ai-conversation.controller.ts` (function: `getScenarios`)
- **POST** `/ai-conversation/message` in `ai-conversation/ai-conversation.controller.ts` (function: `handleMessage`)
- **POST** `/analytics/client-error` in `analytics/analytics.controller.ts` (function: `logClientError`)
- **GET** `/assessments/questions` in `assessments/assessments.controller.ts` (function: `getQuestions`)
- **GET** `/audio-intro/:userId` in `audio-intro/audio-intro.controller.ts` (function: `getAudioIntro`)
- **PATCH** `/audio-intro/:userId` in `audio-intro/audio-intro.controller.ts` (function: `updateAudioIntro`)
- **POST** `/audio-intro/presigned-upload` in `audio-intro/audio-intro.controller.ts` (function: `getUploadUrl`)
- **GET** `/audio-rooms/health` in `audio-rooms/audio-rooms-health.controller.ts` (function: `getHealth`)
- **GET** `/audio-rooms/preview/:id` in `audio-rooms/audio-rooms-preview.controller.ts` (function: `getRoomPreview`)
- **POST** `/audio-rooms/create` in `audio-rooms/audio-rooms.controller.ts` (function: `createRoom`)
- **POST** `/audio-rooms/archive-recording` in `audio-rooms/audio-rooms.controller.ts` (function: `archiveRecording`)
- **POST** `/audio-rooms/token` in `audio-rooms/audio-rooms.controller.ts` (function: `generateToken`)
- **GET** `/audio-rooms/list` in `audio-rooms/audio-rooms.controller.ts` (function: `listActiveRooms`)
- **GET** `/audio-rooms/by-language` in `audio-rooms/audio-rooms.controller.ts` (function: `listActiveRoomsByLanguage`)
- **GET** `/audio-rooms/topics` in `audio-rooms/audio-rooms.controller.ts` (function: `getDistinctTopics`)
- **GET** `/audio-rooms/levels` in `audio-rooms/audio-rooms.controller.ts` (function: `getDistinctLevels`)
- **GET** `/audio-rooms/private` in `audio-rooms/audio-rooms.controller.ts` (function: `getPrivateRooms`)
- **GET** `/audio-rooms/call-logs` in `audio-rooms/audio-rooms.controller.ts` (function: `getCallLogs`)
- **GET** `/audio-rooms/exclusive-emojis` in `audio-rooms/audio-rooms.controller.ts` (function: `getExclusiveEmojis`)
- **GET** `/audio-rooms/:id` in `audio-rooms/audio-rooms.controller.ts` (function: `getRoom`)
- **GET** `/audio-rooms/:id/stage` in `audio-rooms/audio-rooms.controller.ts` (function: `getStage`)
- **POST** `/audio-rooms/:id/stage/reorder` in `audio-rooms/audio-rooms.controller.ts` (function: `reorderSpeakers`)
- **POST** `/audio-rooms/:id/stage/clear` in `audio-rooms/audio-rooms.controller.ts` (function: `clearStage`)
- **POST** `/audio-rooms/language-parties` in `audio-rooms/audio-rooms.controller.ts` (function: `createLanguageParty`)
- **POST** `/audio-rooms/private` in `audio-rooms/audio-rooms.controller.ts` (function: `createPrivateParty`)
- **POST** `/audio-rooms/raise-hand` in `audio-rooms/audio-rooms.controller.ts` (function: `raiseHand`)
- **POST** `/audio-rooms/approve-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `approveSpeaker`)
- **POST** `/audio-rooms/mute-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `muteSpeaker`)
- **POST** `/audio-rooms/kick-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `kickSpeaker`)
- **POST** `/audio-rooms/demote-speaker` in `audio-rooms/audio-rooms.controller.ts` (function: `demoteSpeaker`)
- **POST** `/audio-rooms/dismiss-raised-hand` in `audio-rooms/audio-rooms.controller.ts` (function: `dismissRaisedHand`)
- **POST** `/audio-rooms/invite-co-host` in `audio-rooms/audio-rooms.controller.ts` (function: `inviteCoHost`)
- **POST** `/audio-rooms/remove-co-host` in `audio-rooms/audio-rooms.controller.ts` (function: `removeCoHost`)
- **POST** `/audio-rooms/captions` in `audio-rooms/audio-rooms.controller.ts` (function: `sendCaption`)
- **POST** `/audio-rooms/ai-captions` in `audio-rooms/audio-rooms.controller.ts` (function: `broadcastAICaption`)
- **POST** `/audio-rooms/archive` in `audio-rooms/audio-rooms.controller.ts` (function: `archiveRoom`)
- **GET** `/audio-rooms/:id/transcript` in `audio-rooms/audio-rooms.controller.ts` (function: `getTranscript`)
- **POST** `/audio-rooms/:roomId/polls` in `audio-rooms/audio-rooms.controller.ts` (function: `createPoll`)
- **POST** `/audio-rooms/polls/vote` in `audio-rooms/audio-rooms.controller.ts` (function: `submitVote`)
- **GET** `/audio-rooms/:roomId/polls/:pollId` in `audio-rooms/audio-rooms.controller.ts` (function: `getPollResults`)
- **GET** `/audio-rooms/soundboard/list` in `audio-rooms/audio-rooms.controller.ts` (function: `listSoundboardSounds`)
- **POST** `/audio-rooms/soundboard/play` in `audio-rooms/audio-rooms.controller.ts` (function: `playSound`)
- **POST** `/audio-rooms/:roomId/reactions` in `audio-rooms/audio-rooms.controller.ts` (function: `sendReaction`)
- **POST** `/audio-rooms/:roomId/tip` in `audio-rooms/audio-rooms.controller.ts` (function: `tipHost`)
- **POST** `/auth/change-password` in `auth/auth.controller.ts` (function: `changePassword`)
- **POST** `/auth/two-factor/enable` in `auth/auth.controller.ts` (function: `enableTwoFactor`)
- **POST** `/auth/two-factor/verify` in `auth/auth.controller.ts` (function: `verifyTwoFactor`)
- **POST** `/auth/two-factor/disable` in `auth/auth.controller.ts` (function: `disableTwoFactor`)
- **GET** `/auth/two-factor/status` in `auth/auth.controller.ts` (function: `twoFactorStatus`)
- **POST** `/auth/transfer/generate` in `auth/auth.controller.ts` (function: `generateTransferLink`)
- **POST** `/auth/transfer/consume` in `auth/auth.controller.ts` (function: `consumeTransferLink`)
- **POST** `/auth/transfer/swap` in `auth/auth.controller.ts` (function: `swapTransferLink`)
- **GET** `/blocks` in `blocks/blocks.controller.ts` (function: `getBlockedUsers`)
- **POST** `/blocks` in `blocks/blocks.controller.ts` (function: `blockUser`)
- **DELETE** `/blocks/:blockedId` in `blocks/blocks.controller.ts` (function: `unblockUser`)
- **POST** `/calls/initiate` in `calls/calls.controller.ts` (function: `initiateCall`)
- **POST** `/calls/group` in `calls/calls.controller.ts` (function: `createGroupCall`)
- **GET** `/calls/active` in `calls/calls.controller.ts` (function: `getActiveCalls`)
- **GET** `/calls/active/:room_name` in `calls/calls.controller.ts` (function: `getActiveCall`)
- **GET** `/calls/waiting` in `calls/calls.controller.ts` (function: `getWaitingCalls`)
- **PUT** `/calls/switch` in `calls/calls.controller.ts` (function: `switchCall`)
- **PUT** `/calls/:room_name/accept-waiting` in `calls/calls.controller.ts` (function: `acceptWaitingCall`)
- **PUT** `/calls/:room_name/hold` in `calls/calls.controller.ts` (function: `holdCall`)
- **PUT** `/calls/:room_name/resume` in `calls/calls.controller.ts` (function: `resumeCall`)
- **PUT** `/calls/:room_name/leave` in `calls/calls.controller.ts` (function: `leaveCall`)
- **GET** `/chat/settings` in `chat/chat-settings.controller.ts` (function: `getSettings`)
- **PUT** `/chat/settings` in `chat/chat-settings.controller.ts` (function: `updateSettings`)
- **POST** `/chat/token` in `chat/chat.controller.ts` (function: `getConnectionToken`)
- **POST** `/chat/messages` in `chat/chat.controller.ts` (function: `sendMessage`)
- **POST** `/chat/contacts/share` in `chat/chat.controller.ts` (function: `shareContact`)
- **GET** `/chat/rooms` in `chat/chat.controller.ts` (function: `getRooms`)
- **GET** `/chat/messages/:roomId` in `chat/chat.controller.ts` (function: `getMessages`)
- **POST** `/chat/favourites` in `chat/chat.controller.ts` (function: `addFavourite`)
- **GET** `/chat/favourites` in `chat/chat.controller.ts` (function: `getFavourites`)
- **DELETE** `/chat/favourites/:id` in `chat/chat.controller.ts` (function: `deleteFavourite`)
- **POST** `/chat/llm-proxy` in `chat/chat.controller.ts` (function: `chatLlmProxy`)
- **POST** `/chat/ai-partner` in `chat/chat.controller.ts` (function: `generateAiPartnerReply`)
- **POST** `/chat/suggested-replies` in `chat/chat.controller.ts` (function: `getSuggestedReplies`)
- **POST** `/chat/conversation-starters` in `chat/chat.controller.ts` (function: `getConversationStarters`)
- **POST** `/chat/translate-voiceroom` in `chat/chat.controller.ts` (function: `translateVoiceroomText`)
- **POST** `/chat/translate-real-time` in `chat/chat.controller.ts` (function: `translateRealTime`)
- **POST** `/chat/messages/status-reply` in `chat/chat.controller.ts` (function: `replyToStatusUpdate`)
- **POST** `/chat/messages/:messageId/correct` in `chat/chat.controller.ts` (function: `correctMessage`)
- **PATCH** `/chat/messages/:messageId/fix` in `chat/chat.controller.ts` (function: `fixMessage`)
- **PATCH** `/chat/messages/:messageId/status` in `chat/chat.controller.ts` (function: `updateMessageStatus`)
- **POST** `/chat/messages/:messageId/view` in `chat/chat.controller.ts` (function: `viewMessageMedia`)
- **DELETE** `/chat/messages/:messageId` in `chat/chat.controller.ts` (function: `deleteMessage`)
- **GET** `/chat/rooms/:roomId/members` in `chat/chat.controller.ts` (function: `getRoomMembers`)
- **POST** `/chat/rooms/:roomId/lock` in `chat/chat.controller.ts` (function: `lockChat`)
- **POST** `/chat/rooms/:roomId/unlock` in `chat/chat.controller.ts` (function: `unlockChat`)
- **GET** `/chat/locked-rooms` in `chat/chat.controller.ts` (function: `getLockedRooms`)
- **POST** `/chat/labels` in `chat/chat.controller.ts` (function: `addLabel`)
- **DELETE** `/chat/labels` in `chat/chat.controller.ts` (function: `removeLabel`)
- **GET** `/chat/labels` in `chat/chat.controller.ts` (function: `getUserLabels`)
- **GET** `/chat/labels/:label/rooms` in `chat/chat.controller.ts` (function: `getRoomsByLabel`)
- **GET** `/chat/rooms/:roomId/export` in `chat/chat.controller.ts` (function: `exportChatHistory`)
- **GET** `/chat/rooms/:roomId/greeting` in `chat/chat.controller.ts` (function: `getRoomGreeting`)
- **POST** `/chat/rooms/:roomId/wallpaper` in `chat/chat.controller.ts` (function: `setWallpaper`)
- **GET** `/chat/rooms/:roomId/wallpaper` in `chat/chat.controller.ts` (function: `getWallpaper`)
- **GET** `/chat-backup/export/:channelId` in `chat-backup/chat-backup.controller.ts` (function: `exportBackup`)
- **POST** `/chat-backup/import/:channelId` in `chat-backup/chat-backup.controller.ts` (function: `importBackup`)
- **POST** `/communities` in `communities/communities.controller.ts` (function: `create`)
- **GET** `/communities/:communityId` in `communities/communities.controller.ts` (function: `find`)
- **GET** `/communities` in `communities/communities.controller.ts` (function: `listMine`)
- **PATCH** `/communities/:communityId` in `communities/communities.controller.ts` (function: `update`)
- **DELETE** `/communities/:communityId` in `communities/communities.controller.ts` (function: `remove`)
- **POST** `/communities/:communityId/groups` in `communities/communities.controller.ts` (function: `addGroup`)
- **DELETE** `/communities/:communityId/groups/:groupId` in `communities/communities.controller.ts` (function: `removeGroup`)
- **GET** `/communities/:communityId/groups` in `communities/communities.controller.ts` (function: `getGroups`)
- **POST** `/corrector-score/rate` in `corrector-score/corrector-score.controller.ts` (function: `rateUser`)
- **GET** `/corrector-score/:userId` in `corrector-score/corrector-score.controller.ts` (function: `getScore`)
- **GET** `/cultural-guides/:language` in `cultural/cultural.controller.ts` (function: `getGuide`)
- **POST** `/cultural-insights/tags` in `cultural-insights/cultural-insights.controller.ts` (function: `createTag`)
- **GET** `/cultural-insights/tags/:momentId` in `cultural-insights/cultural-insights.controller.ts` (function: `getTagsForMoment`)
- **GET** `/cultural-insights/moments` in `cultural-insights/cultural-insights.controller.ts` (function: `searchByTags`)
- **GET** `/curated-content/articles` in `curated-content/curated-content.controller.ts` (function: `getArticles`)
- **GET** `/curated-content/articles/:id` in `curated-content/curated-content.controller.ts` (function: `getArticleById`)
- **POST** `/curated-content/articles` in `curated-content/curated-content.controller.ts` (function: `createArticle`)
- **GET** `/curated-content/dialogues` in `curated-content/curated-content.controller.ts` (function: `getDialogues`)
- **GET** `/curated-content/dialogues/:id` in `curated-content/curated-content.controller.ts` (function: `getDialogueById`)
- **POST** `/curated-content/dialogues` in `curated-content/curated-content.controller.ts` (function: `createDialogue`)
- **GET** `/daily-tip` in `daily-tip/daily-tip.controller.ts` (function: `getTodayTip`)
- **POST** `/decks` in `decks/decks.controller.ts` (function: `createDeck`)
- **GET** `/decks` in `decks/decks.controller.ts` (function: `getDecks`)
- **GET** `/decks/:id` in `decks/decks.controller.ts` (function: `getDeck`)
- **PATCH** `/decks/:id` in `decks/decks.controller.ts` (function: `updateDeck`)
- **DELETE** `/decks/:id` in `decks/decks.controller.ts` (function: `deleteDeck`)
- **POST** `/decks/:id/flashcards` in `decks/decks.controller.ts` (function: `addFlashcard`)
- **DELETE** `/decks/:id/flashcards/:flashcardId` in `decks/decks.controller.ts` (function: `removeFlashcard`)
- **GET** `/decks/:id/flashcards` in `decks/decks.controller.ts` (function: `getDeckFlashcards`)
- **GET** `/discovery/partners` in `discovery/discovery.controller.ts` (function: `findPartners`)
- **GET** `/discovery/partner-of-week` in `discovery/discovery.controller.ts` (function: `getPartnerOfWeek`)
- **GET** `/discovery/audio-intros` in `discovery/discovery.controller.ts` (function: `getAudioIntros`)
- **GET** `/discovery/recent-native-speakers` in `discovery/discovery.controller.ts` (function: `getRecentNativeSpeakers`)
- **GET** `/discovery/spotlight` in `discovery/discovery.controller.ts` (function: `getSpotlight`)
- **GET** `/discovery/language-pair` in `discovery/discovery.controller.ts` (function: `findByLanguagePair`)
- **GET** `/discovery/search-by-location` in `discovery/discovery.controller.ts` (function: `searchByLocation`)
- **GET** `/discovery/degradation-status` in `discovery/discovery.controller.ts` (function: `getDegradationStatus`)
- **GET** `/discovery/partners-with-degradation` in `discovery/discovery.controller.ts` (function: `findPartnersWithDegradation`)
- **GET** `/economy/catalog` in `economy/economy.controller.ts` (function: `getCatalog`)
- **GET** `/economy/packages` in `economy/economy.controller.ts` (function: `getPackages`)
- **GET** `/economy/balance` in `economy/economy.controller.ts` (function: `getBalance`)
- **POST** `/economy/daily-check-in` in `economy/economy.controller.ts` (function: `claimDailyCheckIn`)
- **POST** `/economy/create-checkout-session` in `economy/economy.controller.ts` (function: `createCheckoutSession`)
- **POST** `/economy/purchase-coins` in `economy/economy.controller.ts` (function: `purchaseCoins`)
- **POST** `/economy/send-gift` in `economy/economy.controller.ts` (function: `sendGift`)
- **GET** `/economy/transactions` in `economy/economy.controller.ts` (function: `getTransactions`)
- **GET** `/economy/sticker-packs` in `economy/economy.controller.ts` (function: `getStickerPacks`)
- **POST** `/economy/unlock-sticker-pack` in `economy/economy.controller.ts` (function: `unlockStickerPack`)
- **GET** `/economy/health` in `economy/economy.controller.ts` (function: `getHealth`)
- **POST** `/escrow/hold` in `escrow/escrow.controller.ts` (function: `holdCoins`)
- **POST** `/escrow/release` in `escrow/escrow.controller.ts` (function: `releaseCoins`)
- **POST** `/escrow/refund` in `escrow/escrow.controller.ts` (function: `refundCoins`)
- **POST** `/escrow/cancel` in `escrow/escrow.controller.ts` (function: `cancelEscrow`)
- **POST** `/escrow/dispute` in `escrow/escrow.controller.ts` (function: `disputeEscrow`)
- **GET** `/escrow/transactions` in `escrow/escrow.controller.ts` (function: `listTransactions`)
- **GET** `/escrow/transactions/:id` in `escrow/escrow.controller.ts` (function: `getTransaction`)
- **GET** `/escrow/circuit-breaker/status` in `escrow/escrow.controller.ts` (function: `getCircuitBreakerStatus`)
- **POST** `/escrow/circuit-breaker/reset` in `escrow/escrow.controller.ts` (function: `resetCircuitBreaker`)
- **GET** `/escrow/crash-reports` in `escrow/escrow.controller.ts` (function: `listCrashReports`)
- **POST** `/escrow/crash-reports/acknowledge` in `escrow/escrow.controller.ts` (function: `acknowledgeCrashReport`)
- **POST** `/escrow/crash-reports/resolve` in `escrow/escrow.controller.ts` (function: `resolveCrashReport`)
- **POST** `/events` in `events/events.controller.ts` (function: `create`)
- **GET** `/events` in `events/events.controller.ts` (function: `list`)
- **GET** `/events/categories` in `events/events.controller.ts` (function: `getCategories`)
- **GET** `/events/my` in `events/events.controller.ts` (function: `getMyEvents`)
- **GET** `/events/:id` in `events/events.controller.ts` (function: `getById`)
- **GET** `/events/:id/rsvp` in `events/events.controller.ts` (function: `getMyRsvp`)
- **POST** `/events/:id/rsvp` in `events/events.controller.ts` (function: `rsvp`)
- **DELETE** `/events/:id/rsvp` in `events/events.controller.ts` (function: `removeRsvp`)
- **POST** `/favourites` in `favourites/favourites.controller.ts` (function: `addFavourite`)
- **DELETE** `/favourites/:id` in `favourites/favourites.controller.ts` (function: `removeFavourite`)
- **GET** `/favourites/user/:userId` in `favourites/favourites.controller.ts` (function: `getUserFavourites`)
- **GET** `/flashcards/health` in `flashcards/flashcards.controller.ts` (function: `getHealth`)
- **POST** `/flashcards` in `flashcards/flashcards.controller.ts` (function: `createFlashcard`)
- **PATCH** `/flashcards/:id/srs` in `flashcards/flashcards.controller.ts` (function: `updateSrs`)
- **GET** `/flashcards` in `flashcards/flashcards.controller.ts` (function: `getFlashcards`)
- **GET** `/flashcards/due` in `flashcards/flashcards.controller.ts` (function: `getDueReviews`)
- **GET** `/flashcards/suggest` in `flashcards/suggest-flashcards.controller.ts` (function: `suggest`)
- **POST** `/groups` in `groups/groups.controller.ts` (function: `create`)
- **GET** `/groups` in `groups/groups.controller.ts` (function: `getGroups`)
- **GET** `/groups/discoverable` in `groups/groups.controller.ts` (function: `getDiscoverableGroups`)
- **GET** `/groups/:groupId/members` in `groups/groups.controller.ts` (function: `getMembers`)
- **GET** `/groups/:groupId/settings` in `groups/groups.controller.ts` (function: `getSettings`)
- **GET** `/groups/:groupId/announcements` in `groups/groups.controller.ts` (function: `getAnnouncements`)
- **GET** `/groups/mine` in `groups/groups.controller.ts` (function: `getMyAdminGroups`)
- **GET** `/groups/:groupId` in `groups/groups.controller.ts` (function: `getGroupInfo`)
- **POST** `/groups/:groupId/add-member` in `groups/groups.controller.ts` (function: `addMember`)
- **POST** `/groups/:groupId/remove-member` in `groups/groups.controller.ts` (function: `removeMember`)
- **POST** `/groups/:groupId/settings` in `groups/groups.controller.ts` (function: `updateSettings`)
- **POST** `/groups/:groupId/restrict-send-messages` in `groups/groups.controller.ts` (function: `restrictSendMessages`)
- **POST** `/groups/:groupId/restrict-edit-info` in `groups/groups.controller.ts` (function: `restrictEditInfo`)
- **POST** `/groups/:groupId/rename` in `groups/groups.controller.ts` (function: `renameGroup`)
- **POST** `/groups/:groupId/announcement` in `groups/groups.controller.ts` (function: `sendAnnouncement`)
- **POST** `/groups/:groupId/join` in `groups/groups.controller.ts` (function: `joinGroup`)
- **GET** `/groups/:groupId/resources` in `groups/groups.controller.ts` (function: `getGroupResources`)
- **DELETE** `/groups/:groupId/resources/:resourceId` in `groups/groups.controller.ts` (function: `deleteGroupResource`)
- **GET** `/help/articles` in `help/help.controller.ts` (function: `getArticles`)
- **GET** `/help/categories` in `help/help.controller.ts` (function: `getCategories`)
- **GET** `/help/quick-replies` in `help/help.controller.ts` (function: `getQuickReplies`)
- **GET** `/hobby-tags` in `hobby-tags/hobby-tags.controller.ts` (function: `getAllTags`)
- **POST** `/hobby-tags` in `hobby-tags/hobby-tags.controller.ts` (function: `createGlobalTag`)
- **GET** `/hobby-tags/my` in `hobby-tags/hobby-tags.controller.ts` (function: `getMyTags`)
- **POST** `/hobby-tags/my` in `hobby-tags/hobby-tags.controller.ts` (function: `addTag`)
- **DELETE** `/hobby-tags/my/:hobbyTagId` in `hobby-tags/hobby-tags.controller.ts` (function: `removeTag`)
- **PATCH** `/hobby-tags/my/:hobbyTagId` in `hobby-tags/hobby-tags.controller.ts` (function: `updateProficiency`)
- **GET** `/hobby-tags/vocabulary` in `hobby-tags/hobby-tags.controller.ts` (function: `getVocabulary`)
- **GET** `/host-dashboard/:roomId/stats` in `host-dashboard/host-dashboard.controller.ts` (function: `getStats`)
- **GET** `/interests` in `interests/interests.controller.ts` (function: `listInterests`)
- **POST** `/interests/select` in `interests/interests.controller.ts` (function: `selectInterests`)
- **POST** `/language-challenges` in `language-challenges/language-challenges.controller.ts` (function: `create`)
- **GET** `/language-challenges` in `language-challenges/language-challenges.controller.ts` (function: `list`)
- **POST** `/language-challenges/:id/join` in `language-challenges/language-challenges.controller.ts` (function: `join`)
- **POST** `/language-challenges/:id/daily-checkin` in `language-challenges/language-challenges.controller.ts` (function: `dailyCheckin`)
- **POST** `/language-challenges/:id/claim` in `language-challenges/language-challenges.controller.ts` (function: `claim`)
- **GET** `/language-islands` in `language-islands/language-islands.controller.ts` (function: `list`)
- **GET** `/language-islands/my` in `language-islands/language-islands.controller.ts` (function: `getMyIslands`)
- **GET** `/language-islands/:id` in `language-islands/language-islands.controller.ts` (function: `getById`)
- **POST** `/language-islands` in `language-islands/language-islands.controller.ts` (function: `create`)
- **PATCH** `/language-islands/:id` in `language-islands/language-islands.controller.ts` (function: `update`)
- **DELETE** `/language-islands/:id` in `language-islands/language-islands.controller.ts` (function: `remove`)
- **POST** `/language-islands/:id/join` in `language-islands/language-islands.controller.ts` (function: `join`)
- **POST** `/language-islands/:id/leave` in `language-islands/language-islands.controller.ts` (function: `leave`)
- **GET** `/leaderboard/top-correctors` in `leaderboard/leaderboard.controller.ts` (function: `getTopCorrectors`)
- **GET** `/legal/terms` in `legal/legal.controller.ts` (function: `getTerms`)
- **GET** `/legal/privacy` in `legal/legal.controller.ts` (function: `getPrivacy`)
- **GET** `/admin/lessons` in `lessons/lessons.controller.ts` (function: `list`)
- **GET** `/admin/lessons/:id` in `lessons/lessons.controller.ts` (function: `get`)
- **POST** `/admin/lessons` in `lessons/lessons.controller.ts` (function: `create`)
- **PATCH** `/admin/lessons/:id` in `lessons/lessons.controller.ts` (function: `update`)
- **DELETE** `/admin/lessons/:id` in `lessons/lessons.controller.ts` (function: `remove`)
- **GET** `/link-preview` in `link-preview/link-preview.controller.ts` (function: `getPreview`)
- **GET** `/users/me/linked-accounts` in `linked-accounts/linked-accounts.controller.ts` (function: `getLinkedAccounts`)
- **POST** `/users/me/linked-accounts/link` in `linked-accounts/linked-accounts.controller.ts` (function: `linkAccount`)
- **POST** `/users/me/linked-accounts/unlink` in `linked-accounts/linked-accounts.controller.ts` (function: `unlinkAccount`)
- **POST** `/livekit/token` in `livekit/livekit.controller.ts` (function: `getToken`)
- **POST** `/location/:userId/current` in `location/location.controller.ts` (function: `setCurrentLocation`)
- **GET** `/location/:userId/current` in `location/location.controller.ts` (function: `getCurrentLocation`)
- **POST** `/location/:userId/live/start` in `location/location.controller.ts` (function: `startLiveShare`)
- **POST** `/location/:userId/live/update` in `location/location.controller.ts` (function: `updateLiveLocation`)
- **DELETE** `/location/:userId/live` in `location/location.controller.ts` (function: `stopLiveShare`)
- **GET** `/location/:userId/live` in `location/location.controller.ts` (function: `getLiveLocation`)
- **POST** `/media/cover/presigned-url` in `media/media.controller.ts` (function: `getCoverPresignedUrl`)
- **POST** `/media/voice-note` in `media/media.controller.ts` (function: `uploadVoiceNote`)
- **POST** `/media/cover/confirm` in `media/media.controller.ts` (function: `confirmCoverUpload`)
- **POST** `/media/cover/upload` in `media/media.controller.ts` (function: `uploadCoverImage`)
- **POST** `/media/avatar/upload` in `media/media.controller.ts` (function: `uploadAvatarImage`)
- **POST** `/media/view-once/mark-viewed` in `media/media.controller.ts` (function: `markMediaAsViewed`)
- **GET** `/metrics` in `metrics/metrics.controller.ts` (function: `getMetrics`)
- **POST** `/milestones` in `milestones/milestones.controller.ts` (function: `create`)
- **GET** `/milestones` in `milestones/milestones.controller.ts` (function: `findAll`)
- **GET** `/milestones/progress` in `milestones/milestones.controller.ts` (function: `getProgress`)
- **GET** `/milestones/:id` in `milestones/milestones.controller.ts` (function: `findOne`)
- **POST** `/milestones/:id/complete` in `milestones/milestones.controller.ts` (function: `markCompleted`)
- **DELETE** `/milestones/:id` in `milestones/milestones.controller.ts` (function: `remove`)
- **GET** `/moderation/items` in `moderation/moderation.controller.ts` (function: `getItems`)
- **POST** `/moderation/report` in `moderation/moderation.controller.ts` (function: `reportUser`)
- **POST** `/moderation/approve` in `moderation/moderation.controller.ts` (function: `approve`)
- **POST** `/moderation/reject` in `moderation/moderation.controller.ts` (function: `reject`)
- **GET** `/moderation/analyse/:userId` in `moderation/moderation.controller.ts` (function: `analyseUser`)
- **POST** `/moments` in `moments/moments.controller.ts` (function: `createMoment`)
- **GET** `/moments/feed` in `moments/moments.controller.ts` (function: `getFeed`)
- **GET** `/moments/lifetime-counts` in `moments/moments.controller.ts` (function: `getLifetimeCounts`)
- **GET** `/moments/stories` in `moments/moments.controller.ts` (function: `getActiveStories`)
- **POST** `/moments/upload-voice` in `moments/moments.controller.ts` (function: `uploadVoice`)
- **POST** `/moments/upload-media` in `moments/moments.controller.ts` (function: `uploadMedia`)
- **POST** `/moments/stories` in `moments/moments.controller.ts` (function: `createStory`)
- **POST** `/moments/language-questions` in `moments/moments.controller.ts` (function: `createLanguageQuestion`)
- **POST** `/moments/:id/answer` in `moments/moments.controller.ts` (function: `answerLanguageQuestion`)
- **GET** `/moments/questions` in `moments/moments.controller.ts` (function: `getQuestions`)
- **POST** `/moments/:id/like` in `moments/moments.controller.ts` (function: `likeMoment`)
- **POST** `/moments/:id/comments` in `moments/moments.controller.ts` (function: `addComment`)
- **POST** `/moments/:id/comments/:commentId/vote` in `moments/moments.controller.ts` (function: `voteOnCorrection`)
- **GET** `/moments/:id/comments` in `moments/moments.controller.ts` (function: `getComments`)
- **PATCH** `/moments/:id/edit-text` in `moments/moments.controller.ts` (function: `editMomentText`)
- **PATCH** `/moments/:id/pin` in `moments/moments.controller.ts` (function: `pinMoment`)
- **POST** `/monetisation/webhooks/apple` in `monetisation/apple-notification.controller.ts` (function: `handleNotification`)
- **POST** `/monetisation/webhooks/google` in `monetisation/google-play-notification.controller.ts` (function: `handleNotification`)
- **POST** `/monetisation/webhooks/stripe` in `monetisation/monetisation.controller.ts` (function: `handleStripeWebhook`)
- **POST** `/monetisation/webhooks/apple` in `monetisation/monetisation.controller.ts` (function: `handleAppleWebhook`)
- **POST** `/monetisation/webhooks/google` in `monetisation/monetisation.controller.ts` (function: `handleGoogleWebhook`)
- **POST** `/monetisation/generate-api-key` in `monetisation/monetisation.controller.ts` (function: `generateApiKey`)
- **GET** `/monetisation/analytics` in `monetisation/monetisation.controller.ts` (function: `getAnalytics`)
- **GET** `/monetisation/diagnostics/logs` in `monetisation/monetisation.controller.ts` (function: `getDiagnosticLogs`)
- **POST** `/monetisation/diagnostics/logs` in `monetisation/monetisation.controller.ts` (function: `createDiagnosticLog`)
- **POST** `/monetisation/validate-apple-receipt` in `monetisation/monetisation.controller.ts` (function: `validateAppleReceipt`)
- **POST** `/monetisation/create-checkout-session` in `monetisation/monetisation.controller.ts` (function: `createCheckoutSession`)
- **POST** `/monetisation/restore-purchases` in `monetisation/monetisation.controller.ts` (function: `restorePurchases`)
- **GET** `/monetisation/coins-balance` in `monetisation/monetisation.controller.ts` (function: `getCoinsBalance`)
- **GET** `/monetisation/subscription` in `monetisation/monetisation.controller.ts` (function: `getSubscription`)
- **POST** `/monetisation/subscription/cancel` in `monetisation/monetisation.controller.ts` (function: `cancelSubscription`)
- **POST** `/monetisation/subscription/resume` in `monetisation/monetisation.controller.ts` (function: `resumeSubscription`)
- **GET** `/monetisation/subscription/invoices` in `monetisation/monetisation.controller.ts` (function: `getInvoices`)
- **POST** `/monetisation/subscription/billing-portal` in `monetisation/monetisation.controller.ts` (function: `createBillingPortalSession`)
- **POST** `/nlp/detect-language` in `nlp/nlp.controller.ts` (function: `detectLanguage`)
- **POST** `/nlp/translate` in `nlp/nlp.controller.ts` (function: `translate`)
- **POST** `/nlp/translate-ui` in `nlp/nlp.controller.ts` (function: `translateUi`)
- **POST** `/nlp/grammar-check` in `nlp/nlp.controller.ts` (function: `grammarCheck`)
- **POST** `/nlp/explain-grammar` in `nlp/nlp.controller.ts` (function: `explainGrammar`)
- **POST** `/nlp/pronunciation-score` in `nlp/nlp.controller.ts` (function: `pronunciationScore`)
- **POST** `/nlp/simplify` in `nlp/nlp.controller.ts` (function: `simplify`)
- **POST** `/nlp/translate-and-correct` in `nlp/nlp.controller.ts` (function: `translateAndCorrect`)
- **POST** `/nlp/translate-bio` in `nlp/nlp.controller.ts` (function: `translateBio`)
- **POST** `/nlp/transcribe-audio` in `nlp/nlp.controller.ts` (function: `transcribeAudio`)
- **GET** `/notification-preferences` in `notification-preferences/notification-preferences.controller.ts` (function: `getPreferences`)
- **PUT** `/notification-preferences` in `notification-preferences/notification-preferences.controller.ts` (function: `updatePreferences`)
- **POST** `/notification-preferences/reset` in `notification-preferences/notification-preferences.controller.ts` (function: `resetToDefaults`)
- **GET** `/notification-preferences` in `notifications/notification-preferences.controller.ts` (function: `getPreferences`)
- **PUT** `/notification-preferences` in `notifications/notification-preferences.controller.ts` (function: `updatePreferences`)
- **POST** `/notification-preferences/reset` in `notifications/notification-preferences.controller.ts` (function: `resetPreferences`)
- **PATCH** `/notification-preferences/:category/:channel` in `notifications/notification-preferences.controller.ts` (function: `toggleCategoryChannel`)
- **GET** `/notifications` in `notifications/notifications.controller.ts` (function: `getNotifications`)
- **GET** `/notifications/unread-count` in `notifications/notifications.controller.ts` (function: `getUnreadCount`)
- **GET** `/notifications/preferences` in `notifications/notifications.controller.ts` (function: `getPreferences`)
- **PUT** `/notifications/preferences` in `notifications/notifications.controller.ts` (function: `updatePreferences`)
- **PATCH** `/notifications/read-all` in `notifications/notifications.controller.ts` (function: `markAllAsRead`)
- **PATCH** `/notifications/:id/read` in `notifications/notifications.controller.ts` (function: `markAsRead`)
- **POST** `/auth/request-password-reset` in `password-reset/password-reset.controller.ts` (function: `requestPasswordReset`)
- **POST** `/auth/reset-password` in `password-reset/password-reset.controller.ts` (function: `resetPassword`)
- **POST** `/proficiency/assess` in `proficiency/proficiency.controller.ts` (function: `assess`)
- **POST** `/proficiency/languages` in `proficiency/proficiency.controller.ts` (function: `setLanguages`)
- **POST** `/profile-visits/:viewedId` in `profile-visits/profile-visits.controller.ts` (function: `recordVisit`)
- **GET** `/profile-visits/my-visitors` in `profile-visits/profile-visits.controller.ts` (function: `getMyVisitors`)
- **POST** `/pronunciation/feedback` in `pronunciation/pronunciation.controller.ts` (function: `getFeedback`)
- **POST** `/pronunciation/voice-feedback` in `pronunciation/pronunciation.controller.ts` (function: `submitVoiceFeedback`)
- **GET** `/quests` in `quests/quests.controller.ts` (function: `getQuests`)
- **GET** `/quiz/questions` in `quiz/quiz.controller.ts` (function: `getQuestions`)
- **POST** `/reading/resources` in `reading-engine/reading-engine.controller.ts` (function: `createResource`)
- **GET** `/reading/resources` in `reading-engine/reading-engine.controller.ts` (function: `listResources`)
- **GET** `/reading/resources/:id` in `reading-engine/reading-engine.controller.ts` (function: `getResource`)
- **PUT** `/reading/resources/:id` in `reading-engine/reading-engine.controller.ts` (function: `updateResource`)
- **DELETE** `/reading/resources/:id` in `reading-engine/reading-engine.controller.ts` (function: `deleteResource`)
- **GET** `/reading/resources/:id/tokenise` in `reading-engine/reading-engine.controller.ts` (function: `tokenise`)
- **GET** `/reading/progress` in `reading-engine/reading-engine.controller.ts` (function: `getProgress`)
- **POST** `/reading/progress/session` in `reading-engine/reading-engine.controller.ts` (function: `recordSession`)
- **DELETE** `/reading/cache/user` in `reading-engine/reading-engine.controller.ts` (function: `clearUserCache`)
- **GET** `/recommendations/for-you` in `recommendations/recommendations.controller.ts` (function: `getForYou`)
- **GET** `/recommendations/daily` in `recommendations/recommendations.controller.ts` (function: `getDaily`)
- **POST** `/resource-library` in `resource-library/resource-library.controller.ts` (function: `create`)
- **GET** `/resource-library` in `resource-library/resource-library.controller.ts` (function: `findAll`)
- **GET** `/resource-library/:id` in `resource-library/resource-library.controller.ts` (function: `findOne`)
- **PATCH** `/resource-library/:id` in `resource-library/resource-library.controller.ts` (function: `update`)
- **DELETE** `/resource-library/:id` in `resource-library/resource-library.controller.ts` (function: `remove`)
- **GET** `/safety/report-categories` in `safety/safety.controller.ts` (function: `getReportCategories`)
- **POST** `/safety/block` in `safety/safety.controller.ts` (function: `blockUser`)
- **POST** `/safety/unblock` in `safety/safety.controller.ts` (function: `unblockUser`)
- **GET** `/safety/blocked-ids` in `safety/safety.controller.ts` (function: `getBlockedIds`)
- **GET** `/safety/blocked-users` in `safety/safety.controller.ts` (function: `getBlockedUsers`)
- **GET** `/safety/blocked-ids/:userId` in `safety/safety.controller.ts` (function: `getBlockedUserIds`)
- **GET** `/safety/blocker-ids/:userId` in `safety/safety.controller.ts` (function: `getBlockerUserIds`)
- **GET** `/safety/is-blocked/:blockedId` in `safety/safety.controller.ts` (function: `isBlocked`)
- **POST** `/safety/block/:blockedId` in `safety/safety.controller.ts` (function: `blockUserByParam`)
- **POST** `/safety/unblock/:blockedId` in `safety/safety.controller.ts` (function: `unblockUserByParam`)
- **GET** `/safety/blocked-and-blocker-ids/:userId` in `safety/safety.controller.ts` (function: `getBlockedAndBlockerIds`)
- **GET** `/safety/blocked-users-details` in `safety/safety.controller.ts` (function: `getBlockedUserDetails`)
- **GET** `/cart` in `shopping/cart.controller.ts` (function: `getCart`)
- **POST** `/cart/add` in `shopping/cart.controller.ts` (function: `addItem`)
- **POST** `/cart/remove` in `shopping/cart.controller.ts` (function: `removeItem`)
- **POST** `/cart/checkout` in `shopping/cart.controller.ts` (function: `checkout`)
- **GET** `/shopping/catalog` in `shopping/shopping.controller.ts` (function: `getCatalog`)
- **GET** `/shopping/items/:id` in `shopping/shopping.controller.ts` (function: `getItem`)
- **GET** `/shopping/cart` in `shopping/shopping.controller.ts` (function: `getCart`)
- **POST** `/shopping/cart` in `shopping/shopping.controller.ts` (function: `addToCart`)
- **DELETE** `/shopping/cart` in `shopping/shopping.controller.ts` (function: `removeFromCart`)
- **POST** `/shopping/cart/checkout` in `shopping/shopping.controller.ts` (function: `checkout`)
- **POST** `/spam-detection/check` in `spam-detection/spam-detection.controller.ts` (function: `check`)
- **GET** `/stats/me` in `stats/stats.controller.ts` (function: `getMyStats`)
- **POST** `/study-buddies/request` in `study-buddies/study-buddies.controller.ts` (function: `requestBuddy`)
- **GET** `/study-buddies/requests` in `study-buddies/study-buddies.controller.ts` (function: `getIncomingRequests`)
- **POST** `/study-buddies/requests/:id/accept` in `study-buddies/study-buddies.controller.ts` (function: `acceptRequest`)
- **POST** `/study-buddies/requests/:id/decline` in `study-buddies/study-buddies.controller.ts` (function: `declineRequest`)
- **GET** `/study-buddies/matches` in `study-buddies/study-buddies.controller.ts` (function: `getMatches`)
- **POST** `/study-buddies/follow` in `study-buddies/study-buddies.controller.ts` (function: `followUser`)
- **DELETE** `/study-buddies/unfollow` in `study-buddies/study-buddies.controller.ts` (function: `unfollowUser`)
- **GET** `/study-buddies/channel` in `study-buddies/study-buddies.controller.ts` (function: `getChannel`)
- **GET** `/study-streak/me` in `study-streak/study-streak.controller.ts` (function: `getMyStreak`)
- **POST** `/study-streak/checkin` in `study-streak/study-streak.controller.ts` (function: `checkin`)
- **GET** `/study-streak/health` in `study-streak/study-streak.controller.ts` (function: `health`)
- **POST** `/transfer/generate` in `transfer/transfer.controller.ts` (function: `generate`)
- **GET** `/transfer/consume` in `transfer/transfer.controller.ts` (function: `consume`)
- **POST** `/transfer/consume` in `transfer/transfer.controller.ts` (function: `consumePost`)
- **POST** `/transfer/swap` in `transfer/transfer.controller.ts` (function: `swap`)
- **POST** `/two-factor/enable` in `two-factor/two-factor.controller.ts` (function: `enable`)
- **POST** `/two-factor/verify` in `two-factor/two-factor.controller.ts` (function: `verify`)
- **POST** `/two-factor/disable` in `two-factor/two-factor.controller.ts` (function: `disable`)
- **GET** `/two-factor/status` in `two-factor/two-factor.controller.ts` (function: `status`)
- **GET** `/user-statistics/:userId` in `user-statistics/user-statistics.controller.ts` (function: `getStatistics`)
- **POST** `/generate-device-link` in `users/device-link.controller.ts` (function: `generate`)
- **DELETE** `/users/me` in `users/users.controller.ts` (function: `deleteMyAccount`)
- **DELETE** `/users/me/permanent` in `users/users.controller.ts` (function: `permanentlyDeleteMyAccount`)
- **POST** `/users/me/restore` in `users/users.controller.ts` (function: `restoreMyAccount`)
- **GET** `/users/me/export` in `users/users.controller.ts` (function: `exportMyData`)
- **GET** `/users/me/notification-preferences` in `users/users.controller.ts` (function: `getMyNotificationPreferences`)
- **GET** `/users/me` in `users/users.controller.ts` (function: `getMyProfile`)
- **GET** `/users/me/stats` in `users/users.controller.ts` (function: `getMyStats`)
- **GET** `/users/me/xp` in `users/users.controller.ts` (function: `getMyXp`)
- **POST** `/users/me/assess-proficiency` in `users/users.controller.ts` (function: `assessProficiency`)
- **PATCH** `/users/me` in `users/users.controller.ts` (function: `updateMyProfile`)
- **PATCH** `/users/me/greeting` in `users/users.controller.ts` (function: `updateGreetingMessage`)
- **PATCH** `/users/me/away` in `users/users.controller.ts` (function: `updateAwayMessage`)
- **POST** `/users/me/cover-photo/presigned-url` in `users/users.controller.ts` (function: `getCoverPhotoPresignedUrl`)
- **PATCH** `/users/me/cover-photo` in `users/users.controller.ts` (function: `updateCoverPhoto`)
- **POST** `/users/me/avatar/presigned-url` in `users/users.controller.ts` (function: `getAvatarPresignedUrl`)
- **GET** `/users/me/visitors` in `users/users.controller.ts` (function: `getMyVisitors`)
- **GET** `/users/status/:statusId/viewers` in `users/users.controller.ts` (function: `getStatusViewers`)
- **GET** `/users/me/status-viewers` in `users/users.controller.ts` (function: `getMyStatusViewers`)
- **GET** `/users/hobbies` in `users/users.controller.ts` (function: `getAvailableHobbies`)
- **GET** `/users/interests` in `users/users.controller.ts` (function: `getAvailableInterests`)
- **GET** `/users/search` in `users/users.controller.ts` (function: `searchUsers`)
- **GET** `/users/me/badges` in `users/users.controller.ts` (function: `getMyBadges`)
- **GET** `/users/:id` in `users/users.controller.ts` (function: `getUserProfile`)
- **GET** `/users/:id/stats` in `users/users.controller.ts` (function: `getUserStats`)
- **GET** `/users/:id/followers` in `users/users.controller.ts` (function: `getFollowers`)
- **GET** `/users/:id/following` in `users/users.controller.ts` (function: `getFollowing`)
- **POST** `/users/:id/follow` in `users/users.controller.ts` (function: `followUser`)
- **DELETE** `/users/:id/follow` in `users/users.controller.ts` (function: `unfollowUser`)
- **POST** `/users/block/:id` in `users/users.controller.ts` (function: `blockUser`)
- **DELETE** `/users/block/:id` in `users/users.controller.ts` (function: `unblockUser`)
- **POST** `/users/report` in `users/users.controller.ts` (function: `reportUser`)
- **GET** `/users/me/privacy-settings` in `users/users.controller.ts` (function: `getMyPrivacySettings`)
- **GET** `/users/me/message-filters` in `users/users.controller.ts` (function: `getMyMessageFilters`)
- **PUT** `/users/me/message-filters` in `users/users.controller.ts` (function: `setMyMessageFilters`)
- **PATCH** `/users/me/privacy` in `users/users.controller.ts` (function: `updatePrivacySettings`)
- **GET** `/users/me/business` in `users/users.controller.ts` (function: `getMyBusinessProfile`)
- **PATCH** `/users/me/business` in `users/users.controller.ts` (function: `updateMyBusinessProfile`)
- **PATCH** `/users/me/dnd` in `users/users.controller.ts` (function: `setDoNotDisturb`)
- **PATCH** `/users/me/status-visibility` in `users/users.controller.ts` (function: `updateStatusVisibility`)
- **POST** `/users/me/contact-sharing` in `users/users.controller.ts` (function: `shareContact`)
- **PATCH** `/users/me/notification-preferences` in `users/users.controller.ts` (function: `updateNotificationPreferences`)
- **GET** `/version` in `version/version.controller.ts` (function: `getVersion`)
- **GET** `/version/minimum` in `version/version.controller.ts` (function: `getMinimumSupportedVersion`)
- **POST** `/video-calls/start` in `video-calls/video-calls.controller.ts` (function: `startCall`)
- **POST** `/video-calls/accept` in `video-calls/video-calls.controller.ts` (function: `acceptCall`)
- **GET** `/video-calls/health` in `video-calls/video-calls.controller.ts` (function: `health`)
- **GET** `/word-of-the-day` in `word-of-the-day/word-of-the-day.controller.ts` (function: `findOne`)
- **GET** `/xp` in `xp/xp.controller.ts` (function: `getXp`)
- **GET** `/xp/history` in `xp/xp.controller.ts` (function: `getXpHistory`)
- **GET** `/xp/activities` in `xp/xp.controller.ts` (function: `getActivityPoints`)
- **GET** `/chat/quick-replies` in `chat/quick-replies/quick-replies.controller.ts` (function: `getQuickReplies`)
- **POST** `/chat/quick-replies` in `chat/quick-replies/quick-replies.controller.ts` (function: `createQuickReply`)
- **GET** `/user-interests/tags` in `modules/user-interests/user-interests.controller.ts` (function: `getUserInterests`)
- **POST** `/user-interests/tags` in `modules/user-interests/user-interests.controller.ts` (function: `updateUserInterests`)
- **GET** `/user-interests/vocabulary` in `modules/user-interests/user-interests.controller.ts` (function: `getVocabulary`)
- **POST** `/stripe/webhook` in `monetisation/controllers/stripe.controller.ts` (function: `handleWebhook`)
- **GET** `/subscription-plans` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getAllPlans`)
- **GET** `/subscription-plans/popular` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getPopularPlan`)
- **GET** `/subscription-plans/free` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getFreePlan`)
- **GET** `/subscription-plans/paid` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getPaidPlans`)
- **GET** `/subscription-plans/:id` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getPlanById`)
- **GET** `/subscription-plans/:id/benefits` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getHighlightedBenefits`)
- **GET** `/subscription-plans/showcase` in `monetisation/controllers/subscription-plans.controller.ts` (function: `getShowcasePlans`)

## Backend API Map

| Method | Path | Controller | Service | Req DTO | Res Model |
|---|---|---|---|---|---|
| GET | / | app.controller.ts | appService | None | string |
| GET | /health | app.controller.ts | Unknown | None | { status: string } |
| GET | /achievements | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /achievements/user/:userId | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /achievements/full/:userId | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /achievements/my | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| POST | /achievements/evaluate | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| POST | /achievements/evaluate/:userId | achievements/achievements.controller.ts | achievementsService | None | Unknown |
| GET | /admin/v1/logs | admin/admin-operational-events-v1.controller.ts | events | AdminOperationalEventsQueryDto | AdminOperationalEventsResult |
| GET | /admin/v1/roles/assignments | admin/admin-roles-v1.controller.ts | assignments | AdminRoleAssignmentsQueryDto | AdminRoleAssignmentsListResult |
| GET | /admin/v1/me | admin/admin-v1.controller.ts | authorization | None | Unknown |
| GET | /admin/v1/roles | admin/admin-v1.controller.ts | roleInventory | None | AdminRoleInventoryEntry[] |
| GET | /admin/v1/system/health | admin/admin-v1.controller.ts | systemHealth | None | AdminSystemHealthSnapshot |
| GET | /admin/v1/audit | admin/admin-v1.controller.ts | auditQuery | AdminAuditQueryDto | AdminAuditListResult |
| GET | /admin/v1/moderation/reports | admin/admin-v1.controller.ts | moderationQuery | AdminReportsQueryDto | AdminReportsListResult |
| GET | /admin/v1/users | admin/admin-v1.controller.ts | adminService | AdminUserQueryDto | AdminUserListResult |
| GET | /admin/v1/users/:id/login-history | admin/admin-v1.controller.ts | loginHistoryQuery | None | LoginHistoryEntry[] |
| GET | /admin/v1/users/:id | admin/admin-v1.controller.ts | userDetailService | None | AdminUserSummary |
| GET | /admin/users | admin/admin.controller.ts | adminService | AdminUserQueryDto | AdminUserListResult |
| PATCH | /admin/users/:id/vip | admin/admin.controller.ts | adminService | ToggleVipDto | AdminUserSummary |
| GET | /admin/users/:id/login-history | admin/admin.controller.ts | adminService | None | LoginHistoryEntry[] |
| POST | /admin/users/:id/ban | admin/admin.controller.ts | adminService | None | { message: string } |
| POST | /admin/users/:id/warn | admin/admin.controller.ts | adminService | None | { message: string } |
| GET | /admin/blocks | admin/admin.controller.ts | adminService | string | AdminBlocksListResult |
| GET | /admin/reports | admin/admin.controller.ts | adminService | string | AdminReportsListResult |
| DELETE | /admin/blocks/:blockId | admin/admin.controller.ts | adminService | None | { success: boolean } |
| GET | /ai-conversation/scenarios | ai-conversation/ai-conversation.controller.ts | aiConversationService | None | Unknown |
| POST | /ai-conversation/message | ai-conversation/ai-conversation.controller.ts | aiConversationService | {
      message: string;
      scenarioId?: string;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    } | { reply: string } |
| POST | /analytics/client-error | analytics/analytics.controller.ts | analyticsService | ClientErrorDto | { status: string } |
| GET | /assessments/questions | assessments/assessments.controller.ts | assessmentsService | string | Unknown |
| GET | /audio-intro/:userId | audio-intro/audio-intro.controller.ts | audioIntroService | None | Unknown |
| PATCH | /audio-intro/:userId | audio-intro/audio-intro.controller.ts | audioIntroService | UpdateAudioIntroDto | Unknown |
| POST | /audio-intro/presigned-upload | audio-intro/audio-intro.controller.ts | audioIntroService | { filename: string; contentType: string } | Unknown |
| GET | /audio-rooms/health | audio-rooms/audio-rooms-health.controller.ts | healthService | None | DegradationState |
| GET | /audio-rooms/preview/:id | audio-rooms/audio-rooms-preview.controller.ts | audioRoomsService | None | RoomPreviewDto |
| POST | /audio-rooms/create | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreateAudioRoomDto | AudioRoomRecord | null |
| POST | /audio-rooms/archive-recording | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ArchiveRecordingDto | AudioRoomRecord | null |
| POST | /audio-rooms/token | audio-rooms/audio-rooms.controller.ts | audioRoomsService | AudioRoomTokenDto | RoomTokenResponse | null |
| GET | /audio-rooms/list | audio-rooms/audio-rooms.controller.ts | audioRoomsService | string | AudioRoomRecord[] |
| GET | /audio-rooms/by-language | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None |
    Array<{
      language_pair: string;
      count: number;
      rooms: AudioRoomRecord[];
    }>
   |
| GET | /audio-rooms/topics | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | string[] |
| GET | /audio-rooms/levels | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | string[] |
| GET | /audio-rooms/private | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | AudioRoomRecord[] |
| GET | /audio-rooms/call-logs | audio-rooms/audio-rooms.controller.ts | audioRoomsService | GetCallLogsQueryDto | CallLogRecord[] |
| GET | /audio-rooms/exclusive-emojis | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | {
    emojiId: string;
    name: string;
    animationUrl: string;
  }[] |
| GET | /audio-rooms/:id | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | AudioRoomRecord |
| GET | /audio-rooms/:id/stage | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | StageInfo |
| POST | /audio-rooms/:id/stage/reorder | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ReorderStageDto | AudioRoomRecord | null |
| POST | /audio-rooms/:id/stage/clear | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | AudioRoomRecord | null |
| POST | /audio-rooms/language-parties | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreateLanguagePartyDto | AudioRoomRecord | null |
| POST | /audio-rooms/private | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreatePrivatePartyDto | AudioRoomRecord | null |
| POST | /audio-rooms/raise-hand | audio-rooms/audio-rooms.controller.ts | audioRoomsService | RaiseHandDto | AudioRoomRecord | null |
| POST | /audio-rooms/approve-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ApproveSpeakerDto | AudioRoomRecord | null |
| POST | /audio-rooms/mute-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DemoteSpeakerDto | AudioRoomRecord | null |
| POST | /audio-rooms/kick-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DemoteSpeakerDto | AudioRoomRecord | null |
| POST | /audio-rooms/demote-speaker | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DemoteSpeakerDto | AudioRoomRecord | null |
| POST | /audio-rooms/dismiss-raised-hand | audio-rooms/audio-rooms.controller.ts | audioRoomsService | DismissRaisedHandDto | void |
| POST | /audio-rooms/invite-co-host | audio-rooms/audio-rooms.controller.ts | audioRoomsService | InviteCoHostDto | AudioRoomRecord | null |
| POST | /audio-rooms/remove-co-host | audio-rooms/audio-rooms.controller.ts | audioRoomsService | RemoveCoHostDto | AudioRoomRecord | null |
| POST | /audio-rooms/captions | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SendCaptionDto | CaptionRecord | null |
| POST | /audio-rooms/ai-captions | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SendCaptionDto | void |
| POST | /audio-rooms/archive | audio-rooms/audio-rooms.controller.ts | audioRoomsService | ArchiveRoomDto | AudioRoomRecord | null |
| POST | /audio-rooms/:roomId/notes | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreateVoiceRoomNoteDto | VoiceRoomNote | null |
| GET | /audio-rooms/:roomId/notes | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | VoiceRoomNote[] |
| DELETE | /audio-rooms/:roomId/notes/:noteId | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | void |
| GET | /audio-rooms/:id/transcript | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | {
    recording_url: string | null;
    transcript_text: string | null;
    session_summary: string | null;
    vocabulary: string[];
  } |
| POST | /audio-rooms/:roomId/polls | audio-rooms/audio-rooms.controller.ts | audioRoomsService | CreatePollDto | { poll_id: string } | null |
| POST | /audio-rooms/polls/vote | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SubmitVoteDto | void |
| GET | /audio-rooms/:roomId/polls/:pollId | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | {
    question: string;
    options: string[];
    votes: number[];
    totalVotes: number;
  } |
| GET | /audio-rooms/soundboard/list | audio-rooms/audio-rooms.controller.ts | audioRoomsService | None | { sounds: SoundboardSound[] } |
| POST | /audio-rooms/soundboard/play | audio-rooms/audio-rooms.controller.ts | audioRoomsService | PlaySoundDto | { success: boolean; soundUrl: string | null } | null |
| POST | /audio-rooms/:roomId/reactions | audio-rooms/audio-rooms.controller.ts | audioRoomsService | SendReactionDto | { emojiId: string; animationUrl: string } | null |
| POST | /audio-rooms/:roomId/tip | audio-rooms/audio-rooms.controller.ts | audioRoomsService | TipHostDto | {
    tip_id: string;
    amount_coins: number;
    receiver_id: string;
    receiver_new_balance: number;
  } | null |
| POST | /auth/change-password | auth/auth.controller.ts | authService | ChangePasswordDto | Unknown |
| POST | /auth/two-factor/enable | auth/auth.controller.ts | authService | None | { secret: string; qrCodeUrl: string } |
| POST | /auth/two-factor/verify | auth/auth.controller.ts | authService | string | { success: boolean } |
| POST | /auth/two-factor/disable | auth/auth.controller.ts | authService | string | { success: boolean } |
| GET | /auth/two-factor/status | auth/auth.controller.ts | authService | None | { enabled: boolean } |
| POST | /auth/transfer/generate | auth/auth.controller.ts | transferService | None | { url: string } |
| POST | /auth/transfer/consume | auth/auth.controller.ts | transferService | string | { swapToken: string } |
| POST | /auth/transfer/swap | auth/auth.controller.ts | transferService | string | {
    access_token: string;
    refresh_token: string;
    user_id: string;
  } |
| GET | /blocks | blocks/blocks.controller.ts | blocksService | None | Unknown |
| POST | /blocks | blocks/blocks.controller.ts | blocksService | { blocked_id: string } | Unknown |
| DELETE | /blocks/:blockedId | blocks/blocks.controller.ts | blocksService | None | Unknown |
| POST | /calls/initiate | calls/calls.controller.ts | callsService | InitiateCallDto | Unknown |
| POST | /calls/group | calls/calls.controller.ts | callsService | CreateGroupCallDto | Unknown |
| GET | /calls/active | calls/calls.controller.ts | callsService | None | Unknown |
| GET | /calls/active/:room_name | calls/calls.controller.ts | callsService | None | Unknown |
| GET | /calls/waiting | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /calls/switch | calls/calls.controller.ts | callsService | SwitchCallDto | Unknown |
| PUT | /calls/:room_name/accept-waiting | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /calls/:room_name/hold | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /calls/:room_name/resume | calls/calls.controller.ts | callsService | None | Unknown |
| PUT | /calls/:room_name/leave | calls/calls.controller.ts | callsService | None | Unknown |
| GET | /chat/settings | chat/chat-settings.controller.ts | settingsService | None | ChatSettingsDto |
| PUT | /chat/settings | chat/chat-settings.controller.ts | settingsService | ChatSettingsDto | ChatSettingsDto |
| POST | /chat/token | chat/chat.controller.ts | centrifugoService | None | { token: string } | null |
| POST | /chat/messages | chat/chat.controller.ts | chatService | SendMessageDto | ChatMessage | null |
| POST | /chat/contacts/share | chat/chat.controller.ts | chatService | ShareContactDto | ChatMessage | null |
| GET | /chat/rooms | chat/chat.controller.ts | chatService | None | ChatRoomRecord[] |
| GET | /chat/messages/:roomId | chat/chat.controller.ts | chatService | string | ChatMessage[] |
| POST | /chat/favourites | chat/chat.controller.ts | chatService | AddFavouriteDto | { success: boolean } | null |
| GET | /chat/favourites | chat/chat.controller.ts | chatService | None | FavouriteRecord[] |
| DELETE | /chat/favourites/:id | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| POST | /chat/llm-proxy | chat/chat.controller.ts | chatService | LlmProxyDto | { response: string } | null |
| POST | /chat/ai-partner | chat/chat.controller.ts | chatService | AiGenerateReplyDto | { response: string } | null |
| POST | /chat/suggested-replies | chat/chat.controller.ts | chatService | SuggestedRepliesRequestDto | { suggestions: string[] } | null |
| POST | /chat/conversation-starters | chat/chat.controller.ts | conversationStarterService | ConversationStarterDto | { suggestions: string[] } | null |
| POST | /chat/translate-voiceroom | chat/chat.controller.ts | translationService | { text: string; target_language: string } | { translated_text: string; detected_language: string } | null |
| POST | /chat/translate-real-time | chat/chat.controller.ts | translationService | { text: string; target_language: string } | {
    translated_text: string;
    original_text: string;
    target_language: string;
    detected_language: string;
  } | null |
| POST | /chat/messages/status-reply | chat/chat.controller.ts | chatService | ReplyToStatusUpdateDto | ChatMessage | null |
| POST | /chat/messages/:messageId/correct | chat/chat.controller.ts | chatService | { correctedText: string; explanation?: string } | ChatMessage | null |
| PATCH | /chat/messages/:messageId/fix | chat/chat.controller.ts | chatService | FixMessageDto | ChatMessage | null |
| PATCH | /chat/messages/:messageId/status | chat/chat.controller.ts | chatService | UpdateMessageStatusDto | { success: boolean } | null |
| POST | /chat/messages/:messageId/view | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| DELETE | /chat/messages/:messageId | chat/chat.controller.ts | chatService | DeleteMessageDto | { success: boolean } | null |
| GET | /chat/rooms/:roomId/members | chat/chat.controller.ts | chatService | None |
    { user_id: string; display_name?: string; avatar_url?: string | null }[]
   |
| POST | /chat/rooms/:roomId/lock | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| POST | /chat/rooms/:roomId/unlock | chat/chat.controller.ts | chatService | None | { success: boolean } | null |
| GET | /chat/locked-rooms | chat/chat.controller.ts | chatService | None | string[] |
| POST | /chat/labels | chat/chat.controller.ts | chatService | AddLabelDto | { success: boolean } | null |
| DELETE | /chat/labels | chat/chat.controller.ts | chatService | RemoveLabelDto | { success: boolean } | null |
| GET | /chat/labels | chat/chat.controller.ts | chatService | None | string[] |
| GET | /chat/labels/:label/rooms | chat/chat.controller.ts | chatService | None | ChatRoomRecord[] |
| GET | /chat/rooms/:roomId/export | chat/chat.controller.ts | chatService | None | ChatMessage[] |
| GET | /chat/rooms/:roomId/greeting | chat/chat.controller.ts | chatService | None | { greetingMessage?: string; awayMessage?: string } |
| POST | /chat/rooms/:roomId/wallpaper | chat/chat.controller.ts | chatService | SetWallpaperDto | { success: boolean } | null |
| GET | /chat/rooms/:roomId/wallpaper | chat/chat.controller.ts | chatService | None | { wallpaperUrl: string | null } | null |
| GET | /chat-backup/export/:channelId | chat-backup/chat-backup.controller.ts | backupService | None | void |
| POST | /chat-backup/import/:channelId | chat-backup/chat-backup.controller.ts | backupService | Record<string, unknown>[] | { importedCount: number } |
| POST | /communities | communities/communities.controller.ts | communitiesService | CreateCommunityDto | Unknown |
| GET | /communities/:communityId | communities/communities.controller.ts | communitiesService | None | Unknown |
| GET | /communities | communities/communities.controller.ts | communitiesService | None | Unknown |
| PATCH | /communities/:communityId | communities/communities.controller.ts | communitiesService | UpdateCommunityDto | Unknown |
| DELETE | /communities/:communityId | communities/communities.controller.ts | communitiesService | None | Unknown |
| POST | /communities/:communityId/groups | communities/communities.controller.ts | communitiesService | AddGroupDto | Unknown |
| DELETE | /communities/:communityId/groups/:groupId | communities/communities.controller.ts | communitiesService | None | Unknown |
| GET | /communities/:communityId/groups | communities/communities.controller.ts | communitiesService | None | Unknown |
| POST | /corrector-score/rate | corrector-score/corrector-score.controller.ts | correctorScoreService | RateCorrectorDto | { message: string } |
| GET | /corrector-score/:userId | corrector-score/corrector-score.controller.ts | correctorScoreService | None | Unknown |
| GET | /cultural-guides/:language | cultural/cultural.controller.ts | culturalService | None | Unknown |
| POST | /cultural-insights/tags | cultural-insights/cultural-insights.controller.ts | service | CreateCulturalTagDto | Unknown |
| GET | /cultural-insights/tags/:momentId | cultural-insights/cultural-insights.controller.ts | service | None | Unknown |
| GET | /cultural-insights/moments | cultural-insights/cultural-insights.controller.ts | service | CulturalTagFilterDto | Unknown |
| GET | /curated-content/articles | curated-content/curated-content.controller.ts | service | string | Unknown |
| GET | /curated-content/articles/:id | curated-content/curated-content.controller.ts | service | None | Unknown |
| POST | /curated-content/articles | curated-content/curated-content.controller.ts | service | CreateArticleDto | Unknown |
| GET | /curated-content/dialogues | curated-content/curated-content.controller.ts | service | string | Unknown |
| GET | /curated-content/dialogues/:id | curated-content/curated-content.controller.ts | service | None | Unknown |
| POST | /curated-content/dialogues | curated-content/curated-content.controller.ts | service | CreateDialogueDto | Unknown |
| GET | /daily-tip | daily-tip/daily-tip.controller.ts | dailyTipService | None | { tip: string } |
| POST | /decks | decks/decks.controller.ts | decksService | CreateDeckDto | Deck | null |
| GET | /decks | decks/decks.controller.ts | decksService | None | Deck[] |
| GET | /decks/:id | decks/decks.controller.ts | decksService | None | Deck | null |
| PATCH | /decks/:id | decks/decks.controller.ts | decksService | UpdateDeckDto | Deck | null |
| DELETE | /decks/:id | decks/decks.controller.ts | decksService | None | { success: boolean } |
| POST | /decks/:id/flashcards | decks/decks.controller.ts | decksService | AddFlashcardToDeckDto | { success: boolean } |
| DELETE | /decks/:id/flashcards/:flashcardId | decks/decks.controller.ts | decksService | None | { success: boolean } |
| GET | /decks/:id/flashcards | decks/decks.controller.ts | decksService | string | { id: string }[] |
| GET | /discovery/partners | discovery/discovery.controller.ts | usersService | SearchQueryDto | UserProfile[] |
| GET | /discovery/partner-of-week | discovery/discovery.controller.ts | discoveryService | None | string[] |
| GET | /discovery/audio-intros | discovery/discovery.controller.ts | usersService | SearchQueryDto | UserProfile[] |
| GET | /discovery/recent-native-speakers | discovery/discovery.controller.ts | discoveryService | None | UserProfile[] |
| GET | /discovery/spotlight | discovery/discovery.controller.ts | discoveryService | None | UserProfile[] |
| GET | /discovery/language-pair | discovery/discovery.controller.ts | discoveryService | LanguagePairQueryDto | UserProfile[] |
| GET | /discovery/search-by-location | discovery/discovery.controller.ts | discoveryService | string | UserProfile[] |
| GET | /discovery/degradation-status | discovery/discovery.controller.ts | degradationService | None | {
    breakers: Record<string, unknown>;
    events: unknown[];
  } |
| GET | /discovery/partners-with-degradation | discovery/discovery.controller.ts | usersService | SearchQueryDto | DiscoveryResult |
| GET | /economy/catalog | economy/economy.controller.ts | economyService | None | Unknown |
| GET | /economy/packages | economy/economy.controller.ts | economyService | None | Unknown |
| GET | /economy/balance | economy/economy.controller.ts | economyService | None | Unknown |
| POST | /economy/daily-check-in | economy/economy.controller.ts | economyService | None | Unknown |
| POST | /economy/create-checkout-session | economy/economy.controller.ts | economyService | CreateCoinCheckoutSessionDto | Unknown |
| POST | /economy/purchase-coins | economy/economy.controller.ts | economyService | PurchaseCoinsDto | Unknown |
| POST | /economy/send-gift | economy/economy.controller.ts | economyService | SendGiftDto | Unknown |
| GET | /economy/transactions | economy/economy.controller.ts | economyService | None | Unknown |
| GET | /economy/sticker-packs | economy/economy.controller.ts | economyService | None | Unknown |
| POST | /economy/unlock-sticker-pack | economy/economy.controller.ts | economyService | UnlockStickerPackDto | Unknown |
| GET | /economy/health | economy/economy.controller.ts | healthService | None | Unknown |
| POST | /escrow/hold | escrow/escrow.controller.ts | escrowService | CreateEscrowHoldDto | Unknown |
| POST | /escrow/release | escrow/escrow.controller.ts | escrowService | ReleaseEscrowDto | Unknown |
| POST | /escrow/refund | escrow/escrow.controller.ts | escrowService | RefundEscrowDto | Unknown |
| POST | /escrow/cancel | escrow/escrow.controller.ts | escrowService | CancelEscrowDto | Unknown |
| POST | /escrow/dispute | escrow/escrow.controller.ts | escrowService | DisputeEscrowDto | Unknown |
| GET | /escrow/transactions | escrow/escrow.controller.ts | escrowService | string | EscrowTransactionResponse[] |
| GET | /escrow/transactions/:id | escrow/escrow.controller.ts | escrowService | None | EscrowTransactionResponse |
| GET | /escrow/circuit-breaker/status | escrow/escrow.controller.ts | escrowService | None | CircuitBreakerStatusResponse |
| POST | /escrow/circuit-breaker/reset | escrow/escrow.controller.ts | escrowService | None | { reset: boolean } |
| GET | /escrow/crash-reports | escrow/escrow.controller.ts | crashReportService | None | Unknown |
| POST | /escrow/crash-reports/acknowledge | escrow/escrow.controller.ts | crashReportService | AcknowledgeCrashReportDto | { acknowledged: boolean } |
| POST | /escrow/crash-reports/resolve | escrow/escrow.controller.ts | crashReportService | AcknowledgeCrashReportDto | { resolved: boolean } |
| POST | /events | events/events.controller.ts | eventsService | CreateEventDto | Unknown |
| GET | /events | events/events.controller.ts | eventsService | EventsQueryDto | Unknown |
| GET | /events/categories | events/events.controller.ts | eventsService | None | Unknown |
| GET | /events/my | events/events.controller.ts | eventsService | string | Unknown |
| GET | /events/:id | events/events.controller.ts | eventsService | None | Unknown |
| GET | /events/:id/rsvp | events/events.controller.ts | eventsService | None | Unknown |
| POST | /events/:id/rsvp | events/events.controller.ts | eventsService | RsvpDto | Unknown |
| DELETE | /events/:id/rsvp | events/events.controller.ts | eventsService | None | Unknown |
| POST | /favourites | favourites/favourites.controller.ts | favouritesService | { message_id: string; note_text?: string } | unknown |
| DELETE | /favourites/:id | favourites/favourites.controller.ts | favouritesService | None | Unknown |
| GET | /favourites/user/:userId | favourites/favourites.controller.ts | favouritesService | None | Unknown |
| GET | /flashcards/health | flashcards/flashcards.controller.ts | flashcardsService | None | SrsHealthStatus |
| POST | /flashcards | flashcards/flashcards.controller.ts | flashcardsService | CreateFlashcardDto | Flashcard | null |
| PATCH | /flashcards/:id/srs | flashcards/flashcards.controller.ts | flashcardsService | UpdateSrsDto | Flashcard | null |
| GET | /flashcards | flashcards/flashcards.controller.ts | flashcardsService | QueryFlashcardsDto | Flashcard[] |
| GET | /flashcards/due | flashcards/flashcards.controller.ts | flashcardsService | QueryDueReviewsDto | Flashcard[] |
| GET | /flashcards/suggest | flashcards/suggest-flashcards.controller.ts | suggestService | SuggestFlashcardsDto | Unknown |
| POST | /groups | groups/groups.controller.ts | groupsService | CreateGroupDto | Unknown |
| GET | /groups | groups/groups.controller.ts | groupsService | string | Unknown |
| GET | /groups/discoverable | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /groups/:groupId/members | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /groups/:groupId/settings | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /groups/:groupId/announcements | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /groups/mine | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /groups/:groupId | groups/groups.controller.ts | groupsService | None | Unknown |
| POST | /groups/:groupId/add-member | groups/groups.controller.ts | groupsService | AddMemberDto | Unknown |
| POST | /groups/:groupId/remove-member | groups/groups.controller.ts | groupsService | RemoveMemberDto | Unknown |
| POST | /groups/:groupId/settings | groups/groups.controller.ts | groupsService | UpdateGroupSettingsDto | Unknown |
| POST | /groups/:groupId/restrict-send-messages | groups/groups.controller.ts | groupsService | { canSendMessages: boolean } | Unknown |
| POST | /groups/:groupId/restrict-edit-info | groups/groups.controller.ts | groupsService | { canEditInfo: boolean } | Unknown |
| POST | /groups/:groupId/rename | groups/groups.controller.ts | groupsService | RenameGroupDto | Unknown |
| POST | /groups/:groupId/announcement | groups/groups.controller.ts | groupsService | SendAnnouncementDto | { success: boolean } |
| POST | /groups/:groupId/join | groups/groups.controller.ts | groupsService | None | Unknown |
| GET | /groups/:groupId/resources | groups/groups.controller.ts | groupsService | None | Unknown |
| DELETE | /groups/:groupId/resources/:resourceId | groups/groups.controller.ts | groupsService | None | void |
| GET | /help/articles | help/help.controller.ts | helpService | HelpQueryDto | Unknown |
| GET | /help/categories | help/help.controller.ts | helpService | None | Unknown |
| GET | /help/quick-replies | help/help.controller.ts | helpService | None | string[] |
| GET | /hobby-tags | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | None | Unknown |
| POST | /hobby-tags | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | { name: string; category: string; icon?: string } | any |
| GET | /hobby-tags/my | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | None | unknown |
| POST | /hobby-tags/my | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | { hobby_tag_id: string; proficiency_level?: number } | unknown |
| DELETE | /hobby-tags/my/:hobbyTagId | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | None | { message: string } |
| PATCH | /hobby-tags/my/:hobbyTagId | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | { proficiency_level: number } | unknown |
| GET | /hobby-tags/vocabulary | hobby-tags/hobby-tags.controller.ts | hobbyTagsService | string | VocabularyResultItem[] |
| GET | /host-dashboard/:roomId/stats | host-dashboard/host-dashboard.controller.ts | service | None | HostDashboardStatsDto |
| GET | /interests | interests/interests.controller.ts | interestsService | string | Unknown |
| POST | /interests/select | interests/interests.controller.ts | interestsService | string[] | Unknown |
| POST | /language-challenges | language-challenges/language-challenges.controller.ts | challengesService | CreateChallengeDto | Unknown |
| GET | /language-challenges | language-challenges/language-challenges.controller.ts | challengesService | None | Unknown |
| POST | /language-challenges/:id/join | language-challenges/language-challenges.controller.ts | challengesService | JoinChallengeDto | Unknown |
| POST | /language-challenges/:id/daily-checkin | language-challenges/language-challenges.controller.ts | challengesService | None | Unknown |
| POST | /language-challenges/:id/claim | language-challenges/language-challenges.controller.ts | challengesService | ClaimPrizeDto | Unknown |
| GET | /language-islands | language-islands/language-islands.controller.ts | languageIslandsService | QueryLanguageIslandsDto | Unknown |
| GET | /language-islands/my | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| GET | /language-islands/:id | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| POST | /language-islands | language-islands/language-islands.controller.ts | languageIslandsService | CreateLanguageIslandDto | Unknown |
| PATCH | /language-islands/:id | language-islands/language-islands.controller.ts | languageIslandsService | UpdateLanguageIslandDto | Unknown |
| DELETE | /language-islands/:id | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| POST | /language-islands/:id/join | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| POST | /language-islands/:id/leave | language-islands/language-islands.controller.ts | languageIslandsService | None | Unknown |
| GET | /leaderboard/top-correctors | leaderboard/leaderboard.controller.ts | leaderboardService | string | Corrector[] |
| GET | /legal/terms | legal/legal.controller.ts | legalService | None | Unknown |
| GET | /legal/privacy | legal/legal.controller.ts | legalService | None | Unknown |
| GET | /admin/lessons | lessons/lessons.controller.ts | lessonsService | None | Unknown |
| GET | /admin/lessons/:id | lessons/lessons.controller.ts | lessonsService | None | Unknown |
| POST | /admin/lessons | lessons/lessons.controller.ts | lessonsService | CreateLessonDto | Unknown |
| PATCH | /admin/lessons/:id | lessons/lessons.controller.ts | lessonsService | UpdateLessonDto | Unknown |
| DELETE | /admin/lessons/:id | lessons/lessons.controller.ts | lessonsService | None | Unknown |
| GET | /link-preview | link-preview/link-preview.controller.ts | linkPreviewService | string | LinkPreview | null |
| GET | /users/me/linked-accounts | linked-accounts/linked-accounts.controller.ts | linkedAccountsService | None | Unknown |
| POST | /users/me/linked-accounts/link | linked-accounts/linked-accounts.controller.ts | linkedAccountsService | { provider: string; name?: string } | Unknown |
| POST | /users/me/linked-accounts/unlink | linked-accounts/linked-accounts.controller.ts | linkedAccountsService | { provider: string } | Unknown |
| POST | /livekit/token | livekit/livekit.controller.ts | livekitService | LivekitTokenDto | Unknown |
| POST | /location/:userId/current | location/location.controller.ts | locationService | number | { success: boolean } |
| GET | /location/:userId/current | location/location.controller.ts | locationService | None | { latitude: number; longitude: number } | null |
| POST | /location/:userId/live/start | location/location.controller.ts | locationService | string | { shareId: string; channel: string } |
| POST | /location/:userId/live/update | location/location.controller.ts | locationService | number | { success: boolean } |
| DELETE | /location/:userId/live | location/location.controller.ts | locationService | None | { success: boolean } |
| GET | /location/:userId/live | location/location.controller.ts | locationService | None | {
    sharer_user_id: string;
    latitude: number;
    longitude: number;
    updated_at: string;
  } |
| POST | /media/cover/presigned-url | media/media.controller.ts | mediaService | PresignedUrlDto | { uploadUrl: string; mediaUrl: string; objectKey: string } |
| POST | /media/voice-note | media/media.controller.ts | mediaService | None | { url: string } |
| POST | /media/cover/confirm | media/media.controller.ts | mediaService | string | { coverUrl: string } |
| POST | /media/cover/upload | media/media.controller.ts | mediaService | None | { coverUrl: string } |
| POST | /media/avatar/upload | media/media.controller.ts | mediaService | None | { avatarUrl: string } |
| POST | /media/view-once/mark-viewed | media/media.controller.ts | mediaService | string | { success: boolean } |
| GET | /metrics | metrics/metrics.controller.ts | metricsService | None | void |
| POST | /milestones | milestones/milestones.controller.ts | milestonesService | CreateMilestoneDto | Milestone |
| GET | /milestones | milestones/milestones.controller.ts | milestonesService | None | Milestone[] |
| GET | /milestones/progress | milestones/milestones.controller.ts | milestonesService | None | MilestoneProgress |
| GET | /milestones/:id | milestones/milestones.controller.ts | milestonesService | None | Milestone |
| POST | /milestones/:id/complete | milestones/milestones.controller.ts | milestonesService | None | Milestone |
| DELETE | /milestones/:id | milestones/milestones.controller.ts | milestonesService | None | void |
| GET | /moderation/items | moderation/moderation.controller.ts | moderationService | string | ModerationItem[] |
| POST | /moderation/report | moderation/moderation.controller.ts | moderationService | ReportUserDto | Unknown |
| POST | /moderation/approve | moderation/moderation.controller.ts | moderationService | ModerationActionDto | Unknown |
| POST | /moderation/reject | moderation/moderation.controller.ts | moderationService | ModerationActionDto | Unknown |
| GET | /moderation/analyse/:userId | moderation/moderation.controller.ts | moderationService | None | Unknown |
| POST | /moments | moments/moments.controller.ts | momentsService | CreateMomentDto | MomentRecord | null |
| GET | /moments/feed | moments/moments.controller.ts | momentsService | string | MomentRecord[] |
| GET | /moments/lifetime-counts | moments/moments.controller.ts | momentsService | None | {
    translations: number;
    corrections: number;
    moments: number;
  } | null |
| GET | /moments/stories | moments/moments.controller.ts | momentsService | None | MomentRecord[] |
| POST | /moments/upload-voice | moments/moments.controller.ts | momentsService | string | { uploadUrl: string; publicUrl: string } | null |
| POST | /moments/upload-media | moments/moments.controller.ts | momentsService | string | { uploadUrl: string; publicUrl: string } |
| POST | /moments/stories | moments/moments.controller.ts | momentsService | CreateStoryDto | StoryResponse | null |
| POST | /moments/language-questions | moments/moments.controller.ts | momentsService | CreateLanguageQuestionDto | MomentRecord | null |
| POST | /moments/:id/answer | moments/moments.controller.ts | momentsService | AnswerLanguageQuestionDto | { correct: boolean; correctAnswer: string } | null |
| GET | /moments/questions | moments/moments.controller.ts | momentsService | string | MomentRecord[] |
| POST | /moments/:id/like | moments/moments.controller.ts | momentsService | None | { likes_count: number; is_liked: boolean } | null |
| GET | /moments/:id/likes | moments/moments.controller.ts | momentsService | None | MomentLikeUser[] |
| POST | /moments/:id/comments | moments/moments.controller.ts | momentsService | CreateCommentDto | MomentComment | null |
| POST | /moments/:id/comments/:commentId/vote | moments/moments.controller.ts | momentsService | VoteCorrectionDto | {
    commentId: string;
    vote: string;
    upVotes: number;
    downVotes: number;
    userVote: string | null;
  } | null |
| GET | /moments/:id/comments | moments/moments.controller.ts | momentsService | None | MomentComment[] |
| PATCH | /moments/:id/edit-text | moments/moments.controller.ts | momentsService | EditTextDto | MomentRecord | null |
| PATCH | /moments/:id/pin | moments/moments.controller.ts | usersService | None | MomentRecord | null |
| POST | /monetisation/webhooks/apple | monetisation/apple-notification.controller.ts | logger | unknown | Unknown |
| POST | /monetisation/webhooks/google | monetisation/google-play-notification.controller.ts | logger | unknown | Unknown |
| POST | /monetisation/webhooks/stripe | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /monetisation/webhooks/apple | monetisation/monetisation.controller.ts | monetisationService | AppleNotificationDto | Unknown |
| POST | /monetisation/webhooks/google | monetisation/monetisation.controller.ts | monetisationService | GoogleNotificationDto | Unknown |
| POST | /monetisation/generate-api-key | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /monetisation/analytics | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /monetisation/diagnostics/logs | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /monetisation/diagnostics/logs | monetisation/monetisation.controller.ts | monetisationService | CreateDiagnosticLogDto | Unknown |
| POST | /monetisation/validate-apple-receipt | monetisation/monetisation.controller.ts | appleReceiptValidatorService | AppleReceiptValidationDto | Unknown |
| POST | /monetisation/create-checkout-session | monetisation/monetisation.controller.ts | monetisationService | CreateCheckoutSessionDto | Unknown |
| POST | /monetisation/restore-purchases | monetisation/monetisation.controller.ts | monetisationService | { platform?: string; receipt_data?: string } | Unknown |
| GET | /monetisation/coins-balance | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /monetisation/subscription | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /monetisation/subscription/cancel | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /monetisation/subscription/resume | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| GET | /monetisation/subscription/invoices | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /monetisation/subscription/billing-portal | monetisation/monetisation.controller.ts | monetisationService | None | Unknown |
| POST | /nlp/detect-language | nlp/nlp.controller.ts | nlpService | { text?: string } | {
    language: string;
    confidence: number;
  } |
| POST | /nlp/translate | nlp/nlp.controller.ts | usersService | TranslateDto | TranslationResult | null |
| POST | /nlp/translate-ui | nlp/nlp.controller.ts | nlpService | TranslateUiDto | TranslateUiResult |
| POST | /nlp/grammar-check | nlp/nlp.controller.ts | usersService | GrammarCheckDto | GrammarCheckResult | null |
| POST | /nlp/explain-grammar | nlp/nlp.controller.ts | usersService | ExplainGrammarDto | {
    original: string;
    corrected: string;
    explanation: string;
  } | null |
| POST | /nlp/pronunciation-score | nlp/nlp.controller.ts | usersService | PronunciationScoreDto | PronunciationScoreResult | null |
| POST | /nlp/simplify | nlp/nlp.controller.ts | usersService | SimplifyDto | { original: string; simplified: string } | null |
| POST | /nlp/translate-and-correct | nlp/nlp.controller.ts | usersService | TranslateDto | Unknown |
| POST | /nlp/translate-bio | nlp/nlp.controller.ts | usersService | TranslateBioDto | {
    original_text: string;
    translated_text: string;
    detected_language: string;
  } | null |
| POST | /nlp/transcribe-audio | nlp/nlp.controller.ts | nlpService | TranscribeAudioDto | { transcription: string; language: string } |
| GET | /notification-preferences | notification-preferences/notification-preferences.controller.ts | service | None | Unknown |
| PUT | /notification-preferences | notification-preferences/notification-preferences.controller.ts | service | UpdateNotificationPreferencesDto | Unknown |
| POST | /notification-preferences/reset | notification-preferences/notification-preferences.controller.ts | service | None | Unknown |
| GET | /notification-preferences | notifications/notification-preferences.controller.ts | preferencesService | None | NotificationPreferences |
| PUT | /notification-preferences | notifications/notification-preferences.controller.ts | preferencesService | NotificationPreferencesDto | NotificationPreferences |
| POST | /notification-preferences/reset | notifications/notification-preferences.controller.ts | preferencesService | None | NotificationPreferences |
| PATCH | /notification-preferences/:category/:channel | notifications/notification-preferences.controller.ts | preferencesService | boolean | NotificationPreferences |
| GET | /notifications | notifications/notifications.controller.ts | notificationsService | string | NotificationDto[] |
| GET | /notifications/unread-count | notifications/notifications.controller.ts | notificationsService | None | { unreadCount: number } |
| GET | /notifications/preferences | notifications/notifications.controller.ts | notificationsService | None | Unknown |
| PUT | /notifications/preferences | notifications/notifications.controller.ts | notificationsService | UpdateNotificationPreferencesDto | { success: boolean; preferences: unknown } |
| PATCH | /notifications/read-all | notifications/notifications.controller.ts | notificationsService | None | { success: boolean } |
| PATCH | /notifications/:id/read | notifications/notifications.controller.ts | notificationsService | None | { success: boolean } |
| POST | /auth/request-password-reset | password-reset/password-reset.controller.ts | resetService | RequestPasswordResetDto | { message: string } |
| POST | /auth/reset-password | password-reset/password-reset.controller.ts | resetService | ResetPasswordDto | { message: string } |
| POST | /privacy/request-archive | privacy/privacy.controller.ts | privacyService | ArchiveRequestDto | Unknown |
| POST | /privacy/delete-account | privacy/privacy.controller.ts | privacyService | DeleteAccountDto | Unknown |
| POST | /privacy/cancel-deletion | privacy/privacy.controller.ts | privacyService | None | Unknown |
| POST | /proficiency/assess | proficiency/proficiency.controller.ts | proficiencyService | AssessmentResultDto | AssessmentResult |
| POST | /proficiency/languages | proficiency/proficiency.controller.ts | proficiencyService | LanguageSelectionDto | { success: boolean } |
| POST | /profile-visits/:viewedId | profile-visits/profile-visits.controller.ts | usersService | None | Record<string, unknown> | null |
| GET | /profile-visits/my-visitors | profile-visits/profile-visits.controller.ts | usersService | None | ProfileVisitRecord[] |
| POST | /pronunciation/feedback | pronunciation/pronunciation.controller.ts | pronunciationService | string | PronunciationFeedbackResponseDto |
| POST | /pronunciation/voice-feedback | pronunciation/pronunciation.controller.ts | pronunciationService | string | { success: boolean } |
| GET | /quests | quests/quests.controller.ts | questsService | None | Unknown |
| GET | /quiz/questions | quiz/quiz.controller.ts | quizService | string | Unknown |
| POST | /quiz/results | quiz/quiz.controller.ts | quizService | QuizSubmission | Unknown |
| POST | /reading/resources | reading-engine/reading-engine.controller.ts | readingService | CreateReadingResourceDto | ReadingResource |
| GET | /reading/resources | reading-engine/reading-engine.controller.ts | readingService | number | ReadingResource[] |
| GET | /reading/resources/:id | reading-engine/reading-engine.controller.ts | readingService | None | ReadingResource |
| PUT | /reading/resources/:id | reading-engine/reading-engine.controller.ts | readingService | UpdateReadingResourceDto | ReadingResource |
| DELETE | /reading/resources/:id | reading-engine/reading-engine.controller.ts | readingService | None | void |
| GET | /reading/resources/:id/tokenise | reading-engine/reading-engine.controller.ts | readingService | string | ReadingTokenBreakdown |
| GET | /reading/progress | reading-engine/reading-engine.controller.ts | readingService | None | ReadingProgress |
| POST | /reading/progress/session | reading-engine/reading-engine.controller.ts | readingService | { resourceId: string; wordsRead: number; durationSeconds: number } | ReadingProgress |
| DELETE | /reading/cache/user | reading-engine/reading-engine.controller.ts | readingService | None | void |
| GET | /recommendations/for-you | recommendations/recommendations.controller.ts | recommendationsService | None | RecommendedUserDto[] |
| GET | /recommendations/daily | recommendations/recommendations.controller.ts | recommendationsService | None | RecommendedUserDto[] |
| POST | /resource-library | resource-library/resource-library.controller.ts | resourceService | CreateResourceDto | Unknown |
| GET | /resource-library | resource-library/resource-library.controller.ts | resourceService | string | Unknown |
| GET | /resource-library/:id | resource-library/resource-library.controller.ts | resourceService | None | Unknown |
| PATCH | /resource-library/:id | resource-library/resource-library.controller.ts | resourceService | UpdateResourceDto | Unknown |
| DELETE | /resource-library/:id | resource-library/resource-library.controller.ts | resourceService | None | Unknown |
| GET | /safety/report-categories | safety/safety.controller.ts | safetyService | None | Unknown |
| POST | /safety/report | safety/safety.controller.ts | safetyService | ReportUserDto | { success: boolean; message: string } |
| POST | /safety/block | safety/safety.controller.ts | safetyService | BlockUserDto | { success: boolean; blocked_id: string } |
| POST | /safety/unblock | safety/safety.controller.ts | safetyService | UnblockUserDto | { success: boolean } |
| GET | /safety/blocked-ids | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /safety/blocked-users | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /safety/blocked-ids/:userId | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /safety/blocker-ids/:userId | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /safety/is-blocked/:blockedId | safety/safety.controller.ts | safetyService | None | { blocked: boolean } |
| POST | /safety/block/:blockedId | safety/safety.controller.ts | safetyService | None | { success: boolean; blocked_id: string } |
| POST | /safety/unblock/:blockedId | safety/safety.controller.ts | safetyService | None | { success: boolean } |
| GET | /safety/blocked-and-blocker-ids/:userId | safety/safety.controller.ts | safetyService | None | string[] |
| GET | /safety/blocked-users-details | safety/safety.controller.ts | safetyService | None | BlockedUserResponseDto[] |
| GET | /cart | shopping/cart.controller.ts | cartService | None | Unknown |
| POST | /cart/add | shopping/cart.controller.ts | cartService | { itemId: string; quantity?: number } | Unknown |
| POST | /cart/remove | shopping/cart.controller.ts | cartService | { itemId: string; quantity?: number } | Unknown |
| POST | /cart/checkout | shopping/cart.controller.ts | cartService | None | Unknown |
| GET | /shopping/catalog | shopping/shopping.controller.ts | shoppingService | None | Unknown |
| GET | /shopping/items/:id | shopping/shopping.controller.ts | shoppingService | None | Unknown |
| GET | /shopping/cart | shopping/shopping.controller.ts | cartService | None | Unknown |
| POST | /shopping/cart | shopping/shopping.controller.ts | cartService | AddToCartDto | Unknown |
| DELETE | /shopping/cart | shopping/shopping.controller.ts | cartService | AddToCartDto | Unknown |
| POST | /shopping/cart/checkout | shopping/shopping.controller.ts | cartService | None | Unknown |
| POST | /spam-detection/check | spam-detection/spam-detection.controller.ts | spamDetectionService | SpamCheckDto | { isSpam: boolean } |
| GET | /stats/me | stats/stats.controller.ts | statsService | None | MyStatsResponse |
| POST | /study-buddies/request | study-buddies/study-buddies.controller.ts | sbService | StudyBuddyRequestDto | BuddyRequest |
| GET | /study-buddies/requests | study-buddies/study-buddies.controller.ts | sbService | None | BuddyRequest[] |
| POST | /study-buddies/requests/:id/accept | study-buddies/study-buddies.controller.ts | sbService | None | BuddyRequest |
| POST | /study-buddies/requests/:id/decline | study-buddies/study-buddies.controller.ts | sbService | None | BuddyRequest |
| GET | /study-buddies/matches | study-buddies/study-buddies.controller.ts | sbService | None | UserProfile[] |
| POST | /study-buddies/follow | study-buddies/study-buddies.controller.ts | sbService | string | { message: string } |
| DELETE | /study-buddies/unfollow | study-buddies/study-buddies.controller.ts | sbService | string | { message: string } |
| GET | /study-buddies/channel | study-buddies/study-buddies.controller.ts | sbService | string | { channel: string } |
| GET | /study-streak/me | study-streak/study-streak.controller.ts | streakService | None | { streak: number } |
| POST | /study-streak/checkin | study-streak/study-streak.controller.ts | streakService | None | { streak: number } |
| GET | /study-streak/health | study-streak/study-streak.controller.ts | Unknown | None | { ok: boolean } |
| POST | /transfer/generate | transfer/transfer.controller.ts | transferService | None | Unknown |
| GET | /transfer/consume | transfer/transfer.controller.ts | transferService | string | Unknown |
| POST | /transfer/consume | transfer/transfer.controller.ts | transferService | string | Unknown |
| POST | /transfer/swap | transfer/transfer.controller.ts | transferService | string | Unknown |
| POST | /two-factor/enable | two-factor/two-factor.controller.ts | twoFactorService | None | Unknown |
| POST | /two-factor/verify | two-factor/two-factor.controller.ts | twoFactorService | { token: string } | Unknown |
| POST | /two-factor/disable | two-factor/two-factor.controller.ts | twoFactorService | { token: string } | Unknown |
| GET | /two-factor/status | two-factor/two-factor.controller.ts | twoFactorService | None | Unknown |
| GET | /user-statistics/:userId | user-statistics/user-statistics.controller.ts | userStatisticsService | UserStatisticsQueryDto | Unknown |
| POST | /generate-device-link | users/device-link.controller.ts | usersService | None | { url: string } |
| DELETE | /users/me | users/users.controller.ts | usersService | None | { message: string; scheduled_for_deletion_at: string } |
| DELETE | /users/me/permanent | users/users.controller.ts | usersService | None | { message: string } |
| POST | /users/me/restore | users/users.controller.ts | usersService | None | { message: string } |
| GET | /users/me/export | users/users.controller.ts | usersService | None | Record<string, unknown> |
| GET | /users/me/notification-preferences | users/users.controller.ts | usersService | None | {
    custom_tone_url?: string;
    vibration_pattern?: number[];
  } | null |
| GET | /users/me | users/users.controller.ts | usersService | None | UserProfile | null |
| GET | /users/me/stats | users/users.controller.ts | usersService | None | Partial<UserProfile> |
| GET | /users/me/xp | users/users.controller.ts | usersService | None | { totalXp: number } |
| POST | /users/me/assess-proficiency | users/users.controller.ts | usersService | number | { level: string } |
| PATCH | /users/me | users/users.controller.ts | usersService | UpdateProfileDto | UserProfile | null |
| PATCH | /users/me/greeting | users/users.controller.ts | usersService | UpdateGreetingMessageDto | UserProfile | null |
| PATCH | /users/me/away | users/users.controller.ts | usersService | UpdateAwayMessageDto | UserProfile | null |
| POST | /users/me/cover-photo/presigned-url | users/users.controller.ts | mediaService | { filename: string; contentType: string } | { uploadUrl: string; mediaUrl: string; objectKey: string } |
| PATCH | /users/me/cover-photo | users/users.controller.ts | usersService | string | UserProfile | null |
| POST | /users/me/avatar/presigned-url | users/users.controller.ts | mediaService | { filename: string; contentType: string } | { uploadUrl: string; mediaUrl: string; objectKey: string } |
| GET | /users/me/visitors | users/users.controller.ts | usersService | None | ProfileVisitor[] |
| GET | /users/status/:statusId/viewers | users/users.controller.ts | usersService | None | ProfileVisitor[] |
| GET | /users/me/status-viewers | users/users.controller.ts | usersService | None | ProfileVisitor[] |
| GET | /users/hobbies | users/users.controller.ts | usersService | None | string[] |
| GET | /users/interests | users/users.controller.ts | usersService | None | string[] |
| GET | /users/search | users/users.controller.ts | usersService | number | undefined |
    { id: string; display_name: string; avatar_url: string | null }[]
   |
| GET | /users/me/badges | users/users.controller.ts | usersService | None | { id: string; name: string; description: string }[] |
| GET | /users/:id | users/users.controller.ts | usersService | None | UserProfile |
| GET | /users/:id/stats | users/users.controller.ts | usersService | None | Partial<UserProfile> |
| GET | /users/:id/followers | users/users.controller.ts | usersService | number | undefined | { data: UserProfile[]; total: number } |
| GET | /users/:id/following | users/users.controller.ts | usersService | number | undefined | { data: UserProfile[]; total: number } |
| POST | /users/:id/follow | users/users.controller.ts | usersService | None | void |
| DELETE | /users/:id/follow | users/users.controller.ts | usersService | None | void |
| POST | /users/block/:id | users/users.controller.ts | usersService | None | { success: boolean } |
| DELETE | /users/block/:id | users/users.controller.ts | usersService | None | { success: boolean } |
| POST | /users/report | users/users.controller.ts | usersService | {
      reported_id: string;
      reason_category: string;
      description?: string;
      context_url?: string;
    } | { success: boolean; message: string } |
| GET | /users/me/privacy-settings | users/users.controller.ts | usersService | None | {
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
| GET | /users/me/message-filters | users/users.controller.ts | usersService | None | {
    age_min?: number;
    age_max?: number;
    allowed_native_languages?: string[];
    allowed_genders?: string[];
  } |
| PUT | /users/me/message-filters | users/users.controller.ts | usersService | {
      age_min?: number;
      age_max?: number;
      allowed_native_languages?: string[];
      allowed_genders?: string[];
    } | void |
| PATCH | /users/me/privacy | users/users.controller.ts | usersService | PrivacySettingsDto | UserProfile | null |
| GET | /users/me/business | users/users.controller.ts | usersService | None | {
    business_name?: string;
    business_hours?: string;
    website_url?: string;
    catalog?: BusinessCatalogItem[];
  } |
| PATCH | /users/me/business | users/users.controller.ts | usersService | UpdateBusinessProfileDto | UserProfile | null |
| PATCH | /users/me/dnd | users/users.controller.ts | usersService | DoNotDisturbDto | UserProfile | null |
| PATCH | /users/me/status-visibility | users/users.controller.ts | usersService | UpdateStatusVisibilityDto | UserProfile | null |
| POST | /users/me/contact-sharing | users/users.controller.ts | usersService | string | { phone_number?: string; email?: string } |
| PATCH | /users/me/notification-preferences | users/users.controller.ts | usersService | UpdateNotificationPreferencesDto | UserProfile | null |
| GET | /version | version/version.controller.ts | versionService | None | {
    current: string;
    latest: string;
    updateUrl?: string;
    minimumSupported: string;
  } |
| GET | /version/minimum | version/version.controller.ts | versionService | None | { minimumSupported: string } |
| POST | /video-calls/start | video-calls/video-calls.controller.ts | videoCallsService | None | Unknown |
| POST | /video-calls/accept | video-calls/video-calls.controller.ts | videoCallsService | string | Unknown |
| GET | /video-calls/health | video-calls/video-calls.controller.ts | degradationService | None | Unknown |
| GET | /word-of-the-day | word-of-the-day/word-of-the-day.controller.ts | service | None | Unknown |
| GET | /xp | xp/xp.controller.ts | xpService | None | { total: number; level: number } |
| GET | /xp/history | xp/xp.controller.ts | xpService | number |
    Array<{
      id: string;
      user_id: string;
      points: number;
      activity: string;
      created_at: string;
    }>
   |
| GET | /xp/activities | xp/xp.controller.ts | xpService | None | Record<string, number> |
| GET | /chat/quick-replies | chat/quick-replies/quick-replies.controller.ts | quickRepliesService | None | QuickReply[] |
| POST | /chat/quick-replies | chat/quick-replies/quick-replies.controller.ts | quickRepliesService | CreateQuickReplyDto | QuickReply |
| GET | /user-interests/tags | modules/user-interests/user-interests.controller.ts | interestsService | None | { tags: string[] } |
| POST | /user-interests/tags | modules/user-interests/user-interests.controller.ts | interestsService | UpdateInterestsDto | { success: boolean } |
| GET | /user-interests/vocabulary | modules/user-interests/user-interests.controller.ts | interestsService | string | { entries: VocabularyEntry[] } |
| POST | /stripe/webhook | monetisation/controllers/stripe.controller.ts | stripeService | None | Unknown |
| GET | /subscription-plans | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan[] |
| GET | /subscription-plans/popular | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan | undefined |
| GET | /subscription-plans/free | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan | undefined |
| GET | /subscription-plans/paid | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan[] |
| GET | /subscription-plans/:id | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan |
| GET | /subscription-plans/:id/benefits | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | string[] |
| GET | /subscription-plans/showcase | monetisation/controllers/subscription-plans.controller.ts | subscriptionPlansService | None | SubscriptionPlan[] |
