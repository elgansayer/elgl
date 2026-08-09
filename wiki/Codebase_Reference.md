# Codebase Reference

This document contains an exhaustive list of files and methods in the codebase.

## Backend (NestJS)
### `backend/src/app.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/app.config.ts`
- *(No methods found or interface/type definition)*

### `backend/src/mock-data.ts`
- *(No methods found or interface/type definition)*

### `backend/src/main.ts`
- *(No methods found or interface/type definition)*

### `backend/src/app.service.ts`
- Methods: `getHello`

### `backend/src/app.controller.ts`
- Methods: `getHello`, `getHealth`

### `backend/src/spam-detection/spam-detection.service.ts`
- Methods: `isSpam`, `addRecord`, `trigramSet`, `jaccard`, `getTrigramSize`

### `backend/src/spam-detection/spam-detection.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/spam-detection/spam-detection.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/spam-detection/dto/spam-check.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/analytics/analytics.service.ts`
- Methods: `recordClientError`

### `backend/src/analytics/analytics.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/analytics/analytics.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/analytics/dto/client-error.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-challenges/language-challenges.service.ts`
- Methods: `createChallenge`, `listChallenges`, `joinChallenge`, `dailyCheckin`, `claimPrize`

### `backend/src/language-challenges/language-challenges.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-challenges/language-challenges.controller.ts`
- Methods: `list`

### `backend/src/language-challenges/dto/claim-prize.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-challenges/dto/join-challenge.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-challenges/dto/create-challenge.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/interests/interests.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/interests/interests.service.ts`
- Methods: `findAll`, `setUserInterests`, `generateFlashcards`

### `backend/src/interests/interests.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/escrow.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/circuit-breaker.service.ts`
- Methods: `getBreaker`, `isAvailable`, `recordSuccess`, `recordFailure`, `getState`, `reset`, `getAllStates`

### `backend/src/escrow/escrow.service.ts`
- Methods: `getBackoffDelay`, `toResponse`, `holdCoins`, `releaseCoins`, `refundCoins`, `cancelEscrow`, `disputeEscrow`, `getTransaction`, `listTransactions`, `invalidateEscrowCaches`, `processDegradedQueue`, `processStaleEscrows`, `getCircuitBreakerStatus`, `resetCircuitBreaker`

### `backend/src/escrow/escrow-exception.filter.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/cache.interceptor.ts`
- Methods: `intercept`

### `backend/src/escrow/escrow-queue.worker.ts`
- Methods: `onModuleInit`, `onModuleDestroy`, `start`, `stop`

### `backend/src/escrow/crash-report.service.ts`
- Methods: `reportCrash`, `listUnresolved`, `acknowledgeReport`, `resolveReport`

### `backend/src/escrow/escrow.controller.ts`
- Methods: `getCircuitBreakerStatus`, `resetCircuitBreaker`, `listCrashReports`

### `backend/src/escrow/sanitise-escrow.helper.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/interfaces/crash-report.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/interfaces/escrow-transaction.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/interfaces/escrow.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/escrow/dto/escrow.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cultural-insights/cultural-insights.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cultural-insights/cultural-insights.service.ts`
- Methods: `createTag`, `getTagsForMoment`, `searchMomentsByTags`

### `backend/src/cultural-insights/cultural-insights.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cultural-insights/dto/cultural-tag-filter.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cultural-insights/dto/create-cultural-tag.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/link-preview/link-preview.service.ts`
- Methods: `getPreview`, `validateUrl`, `getMetaTag`, `sanitizeMetaContent`

### `backend/src/link-preview/link-preview.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/link-preview/link-preview.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/link-preview/interfaces/link-preview.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/help/help-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/help/help.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/help/help.service.ts`
- Methods: `findAll`, `getCategories`, `getQuickReplies`

### `backend/src/help/help.controller.ts`
- Methods: `getCategories`, `getQuickReplies`

### `backend/src/help/interfaces/faq.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/help/dto/help-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/modules/user-interests/user-interests.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/modules/user-interests/user-interests.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/modules/user-interests/user-interests.service.ts`
- Methods: `getUserInterests`, `updateUserInterests`, `getVocabularyForInterests`

### `backend/src/modules/user-interests/dto/update-interests.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/apple-notification.service.ts`
- Methods: `handleNotification`, `isSubscriptionActiveEvent`, `isSubscriptionExpiredEvent`, `verifyJwsPayload`, `verifySignature`, `decodeTransactionInfo`, `mapProductIdToTier`

### `backend/src/monetisation/apple-notification.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/google-play-notification.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/monetisation.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/monetisation.service.ts`
- Methods: `updateVipStatusFromWebhook`, `getPriceIdForPlan`, `createCheckoutSession`, `handleStripeWebhook`, `handleAppleNotification`, `handleGoogleNotification`, `generateApiKey`, `getDeveloperAnalytics`, `getDiagnosticLogs`, `createDiagnosticLog`, `restorePurchases`, `deductCoins`, `getCoinsBalance`, `addCoins`, `inferTierFromPriceId`, `getSubscriptionDetails`, `cancelSubscription`, `resumeSubscription`, `createBillingPortalSession`

### `backend/src/monetisation/google-play-notification.service.ts`
- Methods: `handleNotification`, `isPurchaseCurrentlyEntitled`, `mapSubscriptionIdToTier`

### `backend/src/monetisation/monetisation.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/apple-receipt-validator.service.ts`
- Methods: `validateReceipt`

### `backend/src/monetisation/decorators/require-vip.decorator.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/services/stripe.service.ts`
- Methods: `createCheckoutSession`, `getTierForPlan`, `handleSubscriptionCreated`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`, `handleInvoicePaymentSucceeded`, `handleInvoicePaymentFailed`

### `backend/src/monetisation/services/subscription-plans.service.ts`
- Methods: `getAllPlans`, `getPlanById`, `getHighlightedBenefits`, `getPopularPlan`, `getNonFreePlans`, `getFreePlan`, `getShowcasePlans`, `getTierByProductId`

### `backend/src/monetisation/interfaces/subscription-plan.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/guards/vip.guard.ts`
- Methods: `canActivate`

### `backend/src/monetisation/dto/google-notification.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/dto/monetisation.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/dto/create-subscription.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/dto/apple-notification.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/monetisation/controllers/subscription-plans.controller.ts`
- Methods: `getAllPlans`, `getPopularPlan`, `getFreePlan`, `getPaidPlans`, `getShowcasePlans`

### `backend/src/monetisation/controllers/stripe.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/communities.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/groups.service.ts`
- Methods: `isAdmin`, `addMember`, `removeMember`, `renameGroup`, `createGroup`, `updateSettings`, `restrictSendMessages`, `restrictEditInfo`, `getGroupMembers`, `getSettings`, `sendAnnouncement`, `getAnnouncements`, `getMyAdminGroups`, `getGroupInfo`, `getGroupsByInterest`, `setCommunityId`, `getGroupsByCommunity`, `joinGroup`, `getGroupResources`, `deleteGroupResource`, `createCommunity`, `getMyCommunities`, `getCommunity`, `updateCommunity`, `deleteCommunity`, `addGroupToCommunity`, `removeGroupFromCommunity`

### `backend/src/groups/groups.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/groups.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/update-group-settings.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/update-community.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/create-community.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/send-announcement.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/remove-member.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/create-group.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/rename-group.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/add-member.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/groups/dto/add-group-to-community.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/common/http-retry.helper.ts`
- Methods: `while`

### `backend/src/common/cache.interceptor.ts`
- Methods: `intercept`

### `backend/src/common/retry.ts`
- *(No methods found or interface/type definition)*

### `backend/src/common/logger/logger.module.ts`
- Methods: `level`, `req`, `res`

### `backend/src/common/retry/retry.service.ts`
- Methods: `isRetryableError`, `calculateDelay`, `extractRetryAfter`, `sleep`

### `backend/src/common/retry/retry.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/common/retry/exponential-backoff.ts`
- *(No methods found or interface/type definition)*

### `backend/src/common/pipes/sanitise-html.pipe.ts`
- Methods: `transform`, `isPlainObject`, `sanitiseValue`

### `backend/src/types/node-nlp.d.ts`
- Methods: `guess`

### `backend/src/stats/stats.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/stats/stats.service.ts`
- Methods: `getStats`

### `backend/src/stats/stats.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/ai-conversation/ai-conversation.controller.ts`
- Methods: `getScenarios`

### `backend/src/ai-conversation/ai-conversation.service.ts`
- Methods: `checkDailyAiRateLimit`, `generateReply`, `getDefaultSystemPrompt`, `getFallbackReply`

### `backend/src/ai-conversation/ai-conversation.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/safety/safety.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/safety/safety-cache-invalidation.service.ts`
- Methods: `getRedis`, `invalidateTrustAndSafetyCaches`, `invalidateUserPairCaches`, `invalidateUserCaches`

### `backend/src/safety/safety.service.ts`
- Methods: `getCategories`, `reportUser`, `blockUser`, `unblockUser`, `isBlocked`, `getBlockedUserIds`, `getBlockerUserIds`, `getBlockedAndBlockerIds`, `getBlockedUserDetails`

### `backend/src/safety/safety.controller.ts`
- Methods: `getReportCategories`

### `backend/src/safety/dto/safety.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/safety/dto/blocked-user.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/host-dashboard/host-dashboard.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/host-dashboard/host-dashboard.service.ts`
- Methods: `getStats`

### `backend/src/host-dashboard/host-dashboard.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/host-dashboard/dto/host-dashboard.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/assessments/assessments.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/assessments/assessments.service.ts`
- Methods: `getQuestions`, `getFallbackQuestions`

### `backend/src/assessments/assessments.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/email/email.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/email/email.service.ts`
- Methods: `sendPasswordResetEmail`

### `backend/src/legal/legal.service.ts`
- Methods: `getTermsOfService`, `getPrivacyPolicy`

### `backend/src/legal/legal.controller.ts`
- Methods: `getTerms`, `getPrivacy`

### `backend/src/legal/legal.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/legal/dto/legal-document.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/achievements/achievements.service.ts`
- Methods: `onModuleInit`, `awardAchievement`, `hasAchievement`, `listAchievements`, `getUserAchievements`, `getFullAchievements`, `evaluateAchievements`, `handleEvaluationEvent`, `handleMessageSent`

### `backend/src/achievements/achievements.controller.ts`
- Methods: `listAchievements`

### `backend/src/achievements/achievements.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/achievements/dto/user-achievement.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/achievements/dto/full-achievement.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/achievements/dto/achievement.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/recommendations/recommendations.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/recommendations/matchmaking-exception.filter.ts`
- *(No methods found or interface/type definition)*

### `backend/src/recommendations/recommendations.service.ts`
- Methods: `calculateDailyRecommendations`, `getDailyRecommendations`, `getRecommendations`, `getRecommendationsWithFallback`, `recommendationsFromMock`, `purgeRecommendationsCache`

### `backend/src/recommendations/matchmaking-crash-report.service.ts`
- Methods: `reportCrash`, `listUnresolved`, `acknowledgeReport`, `resolveReport`, `getStats`

### `backend/src/recommendations/sanitise-recommendations.helper.ts`
- *(No methods found or interface/type definition)*

### `backend/src/recommendations/recommendations.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/recommendations/recommendations-rate-limiter.guard.ts`
- Methods: `canActivate`

### `backend/src/recommendations/dto/recommendations-response.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/location/location.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/location/location.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/location/location.service.ts`
- Methods: `setCurrentLocation`, `getCurrentLocation`, `startLiveShare`, `updateLiveLocation`, `stopLiveShare`, `getLiveLocationForViewer`

### `backend/src/economy/apple-notification.d.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/apple-notification.service.ts`
- Methods: `handleNotification`, `verifyAndDecodeJWS`, `extractTransactionInfo`, `handleSubscribed`, `handleRenewalStatusChange`, `handleRenewalPreferenceChange`, `handleFailedRenewal`, `handleExpired`, `handleRefund`, `handleRevoke`, `handlePriceIncrease`, `handleRefundDeclined`, `handleConsumptionRequest`, `handleRenewalExtension`, `updateSubscriptionStatus`, `updateAutoRenewStatus`, `updateRenewalProduct`, `notifyUserAboutFailedRenewal`, `revokeCoinsForRefund`, `revokeSubscriptionBenefits`, `notifyUserAboutPriceIncrease`, `provideConsumptionData`, `extendSubscription`

### `backend/src/economy/coin-economy-health.service.ts`
- Methods: `markFeatureDegraded`, `clearFeatureDegradation`, `isFeatureDegraded`, `getDegradedFeatures`, `getHealthSnapshot`, `getCachedSnapshot`

### `backend/src/economy/economy-rate-limiter.guard.ts`
- Methods: `canActivate`

### `backend/src/economy/economy.service.ts`
- Methods: `getCatalog`, `getDefaultGiftCatalog`, `getPackages`, `createCheckoutSession`, `getBalance`, `claimDailyCheckIn`, `verifyPurchaseReceipt`, `purchaseCoins`, `parseAndroidReceiptToken`, `extractStripeSessionId`, `getCoinPackageByProductId`, `sendGift`, `unlockStickerPack`, `getStickerPacks`, `getTransactionHistory`, `invalidateUserEconomyCaches`, `getDefaultStickerPacks`

### `backend/src/economy/sanitise-economy.helper.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/cache.interceptor.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/google-play-notification.service.ts`
- Methods: `handleNotification`, `updateSubscriptionStatus`, `updateSubscriptionPrice`, `updateSubscriptionDeferredDate`, `revokeSubscriptionBenefits`

### `backend/src/economy/economy.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/economy-exception.filter.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/economy.controller.ts`
- Methods: `getCatalog`, `getPackages`, `getHealth`

### `backend/src/economy/interfaces/subscription.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/dto/subscription.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/economy/dto/economy.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/authenticated-request.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/auth.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/auth.service.ts`
- Methods: `changePassword`, `enableTwoFactor`, `verifyTwoFactor`, `disableTwoFactor`, `checkTwoFactorStatus`

### `backend/src/auth/supabase-auth.guard.ts`
- Methods: `canActivate`, `extractTokenFromHeader`

### `backend/src/auth/current-user.decorator.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/auth.controller.ts`
- Methods: `getUserIdFromReq`

### `backend/src/auth/decorators/current-user.decorator.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/guards/supabase-auth.guard.ts`
- Methods: `canActivate`

### `backend/src/auth/dto/change-password.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/dto/forgot-password.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/auth/dto/reset-password.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/profile-visits/profile-visits.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/profile-visits/profile-visits.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/profile-visits/profile-visits.service.ts`
- Methods: `recordVisit`, `getVisitors`, `getVisitCount`, `deleteVisit`

### `backend/src/cultural/cultural.service.ts`
- Methods: `getGuideForLanguage`

### `backend/src/cultural/cultural.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cultural/cultural.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/privacy/data-scrubbing.service.ts`
- Methods: `scrubIpAddress`, `scrubLoginHistory`, `scrubReceiptToken`, `scrubCoinPurchaseRecords`, `scrubGiftTransactionRecords`, `scrubEconomyRecord`, `scrubEscrowRecord`, `scrubDisplayName`, `scrubAvatarUrl`, `scrubUserProfileForAdmin`, `scrubRecommendationRecords`, `scrubCrashReport`, `scrubCrashReportRecords`, `scrubReadingResourceForAdmin`, `scrubReadingResourceRecords`, `scrubReadingProgressForAdmin`, `scrubReadingProgressRecords`, `scrubTranslationCacheForAdmin`, `scrubTranslationCacheRecords`

### `backend/src/privacy/data-retention.service.ts`
- Methods: `purgeLoginHistory`, `purgeOldReports`, `purgeInactiveReadingProgress`, `finaliseAccountDeletions`

### `backend/src/privacy/privacy.service.ts`
- Methods: `requestArchive`, `deleteAccount`, `cancelDeletion`

### `backend/src/privacy/privacy.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/privacy/privacy.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/privacy/dto/delete-account.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/privacy/dto/archive-request.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat-backup/chat-backup.service.ts`
- Methods: `exportChannelBackup`, `importChannelBackup`

### `backend/src/chat-backup/chat-backup.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat-backup/chat-backup.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/notification-preferences.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/notifications.service.ts`
- Methods: `getPreferences`, `updatePreferences`, `sendPushNotification`, `createNotification`, `getNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `getMockNotifications`

### `backend/src/notifications/notifications.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/notification-preferences.service.ts`
- Methods: `getPreferences`, `updatePreferences`, `resetToDefaults`, `shouldSendNotification`, `createDefaultPreferences`, `mergePreferences`, `mapDbToPreferences`, `mapPreferencesToDb`

### `backend/src/notifications/notifications.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/interfaces/notification-preferences.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/interfaces/notification.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/dto/notification.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/dto/update-notification-preferences.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/dto/notification-preferences.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notifications/listeners/profile-view-notification.listener.ts`
- Methods: `handleProfileVisit`

### `backend/src/notifications/listeners/like-notification.listener.ts`
- Methods: `handleLike`

### `backend/src/notifications/listeners/chat-notification.listener.ts`
- Methods: `handleChatMessage`

### `backend/src/notifications/listeners/comment-notification.listener.ts`
- Methods: `handleCommentMoment`

### `backend/src/notifications/listeners/chat-mention-notification.listener.ts`
- Methods: `handleChatMention`

### `backend/src/notifications/listeners/comment-mention-notification.listener.ts`
- Methods: `handleCommentMention`

### `backend/src/notifications/listeners/follow-notification.listener.ts`
- Methods: `handleFollow`

### `backend/src/notifications/listeners/system-notification.listener.ts`
- Methods: `handleSystemAlert`

### `backend/src/notifications/events/notification.events.ts`
- *(No methods found or interface/type definition)*

### `backend/src/admin/admin.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/admin/admin.service.ts`
- Methods: `getRedis`, `listUsers`, `setVipStatus`, `getLoginHistory`, `banUser`, `warnUser`, `listAllBlocks`, `listReports`, `removeBlock`

### `backend/src/admin/admin.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/admin/interfaces/admin-user.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/admin/guards/admin.guard.ts`
- Methods: `canActivate`

### `backend/src/admin/dto/admin-user-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/admin/dto/toggle-vip.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/version/version.service.ts`
- Methods: `onModuleInit`, `getVersion`, `getMinimumSupportedVersion`

### `backend/src/version/version.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/version/version.controller.ts`
- Methods: `getVersion`, `getMinimumSupportedVersion`

### `backend/src/xp/xp.controller.ts`
- Methods: `userIdFromReq`, `getActivityPoints`

### `backend/src/xp/xp.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/xp/xp.service.ts`
- Methods: `awardXpForActivity`, `getTotalXp`, `getXpTotal`, `getXpHistory`, `getActivityPoints`, `getPointsForActivity`, `awardXp`, `getLevel`

### `backend/src/xp/dto/xp-response.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/xp/dto/award-xp.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/moments.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/moments.service.ts`
- Methods: `getLifetimeCounts`, `inferMediaType`, `createStory`, `createMoment`, `createLanguageQuestion`, `getFeed`, `getQuestions`, `getActiveStories`, `answerLanguageQuestion`, `likeMoment`, `getMomentLikes`, `addComment`, `getComments`, `getVoiceUploadUrl`, `getMediaUploadUrl`, `editMomentText`, `pinMoment`, `voteOnCorrection`

### `backend/src/moments/timeline.worker.ts`
- Methods: `fanOutMoment`

### `backend/src/moments/moments.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/interfaces/story.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/interfaces/moment.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/dto/create-story.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/dto/create-language-question.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/dto/edit-text.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/dto/vote-correction.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/dto/moment.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moments/dto/answer-language-question.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/users.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/users.service.ts`
- Methods: `proficiencyAssessment`, `getProfile`, `searchUsers`, `getUserXp`, `getVisitors`, `getStatusViewersByStatusId`, `getDefaultStatusId`, `followUser`, `unfollowUser`, `likeProfile`, `unlikeProfile`, `touchLastActiveAt`, `getNotificationPreferences`, `updateDoNotDisturbSettings`, `getMockProfile`, `updateProfile`, `updateNotificationPreferences`, `updateGreetingMessage`, `updateAwayMessage`, `scheduleDeletion`, `cancelDeletion`, `blockUser`, `unblockUser`, `reportUser`, `exportUserData`, `getPrivacySettings`, `getBusinessProfile`, `updateBusinessProfile`, `awardCoins`, `getMessageFilters`, `setMessageFilters`, `getFollowers`, `getFollowing`, `generateDeviceLink`, `updatePrivacySettings`, `getAvailableHobbies`, `getAvailableInterests`, `getBadges`, `shareContact`, `permanentDeleteAccount`

### `backend/src/users/constants.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/data-export.worker.ts`
- Methods: `exportUserData`

### `backend/src/users/users.controller.ts`
- Methods: `getAvailableHobbies`, `getAvailableInterests`

### `backend/src/users/device-link.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/cron/account-deletion.cron.ts`
- Methods: `handleAccountDeletions`

### `backend/src/users/interfaces/user.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/interfaces/user-profile.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/update-away-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/update-business-profile.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/do-not-disturb.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/privacy-settings.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/update-notification-preferences.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/update-status-visibility.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/update-greeting-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/dto/update-profile.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/users/interceptors/last-active.interceptor.ts`
- Methods: `intercept`, `firstHeaderValue`

### `backend/src/users/entities/user.entity.ts`
- *(No methods found or interface/type definition)*

### `backend/src/streak/streak.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/streak/streak.service.ts`
- Methods: `resetStreaksForInactiveUsers`, `resetStreaksForTesting`, `handleStreakResetCron`

### `backend/src/livekit/livekit.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/livekit/livekit.service.ts`
- Methods: `generateToken`, `buildIceServers`

### `backend/src/livekit/livekit.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/livekit/dto/livekit-token.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/pronunciation/pronunciation.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/pronunciation/pronunciation.service.ts`
- Methods: `analyse`, `computeAccuracy`, `fallbackAnalysis`, `processVoiceFeedback`

### `backend/src/pronunciation/pronunciation.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/pronunciation/dto/pronunciation-feedback.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/milestones/milestones.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/milestones/milestones.service.ts`
- Methods: `toMilestone`, `create`, `findAllForUser`, `findOneForUser`, `markCompleted`, `remove`, `getProgress`

### `backend/src/milestones/milestones.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/milestones/dto/update-milestone.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/milestones/dto/create-milestone.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cloudflare/cloudflare.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cloudflare/cache.service.ts`
- Methods: `purgeByCacheTags`

### `backend/src/ankii-integration/ankii-integration.service.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-intro/audio-intro.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-intro/audio-intro.service.ts`
- Methods: `getAudioIntro`, `updateAudioIntro`, `getPresignedUploadUrl`

### `backend/src/audio-intro/audio-intro.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-intro/dto/update-audio-intro.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/proficiency/proficiency.service.ts`
- Methods: `assess`, `setLanguages`, `mapScoreToLevel`

### `backend/src/proficiency/proficiency.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/proficiency/proficiency.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/proficiency/interfaces/proficiency.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/proficiency/dto/language-selection.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/proficiency/dto/assessment-result.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/transfer/transfer.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/transfer/transfer.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/transfer/transfer.service.ts`
- Methods: `generateTransferToken`, `consumeTransferToken`, `swapTokenForSession`

### `backend/src/lessons/lessons.controller.ts`
- Methods: `list`

### `backend/src/lessons/lessons.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/lessons/lessons.service.ts`
- Methods: `listLessons`, `getLesson`, `createLesson`, `updateLesson`, `deleteLesson`, `completeLesson`

### `backend/src/lessons/interfaces/lesson.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/lessons/dto/create-lesson.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/lessons/dto/update-lesson.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/centrifugo.service.ts`
- Methods: `onModuleInit`, `checkConnectionRateLimit`, `getRateWindowSec`, `parseLimit`, `generateConnectionToken`, `signJwt`, `publish`, `publishTranslated`

### `backend/src/chat/chat.service.ts`
- Methods: `generateConnectionToken`, `getRooms`, `sendMessage`, `getMessages`, `addFavourite`, `searchAllMessages`, `getFavourites`, `deleteFavourite`, `getSuggestedReplies`, `parseSuggestedReplies`, `createGroup`, `renameGroup`, `addGroupMembers`, `removeGroupMember`, `getGroupMembers`, `lockChat`, `unlockChat`, `getLockedChats`, `shareContact`, `setWallpaper`, `getWallpaper`, `replyToStatusUpdate`, `translateMessage`, `llmProxy`, `correctMessage`, `fixMessage`, `deleteMessage`, `updateMessageStatus`, `viewMessageMedia`, `exportChatHistory`, `addLabel`, `removeLabel`, `getUserLabels`, `getRoomsByLabel`, `getRoomGreeting`, `generateAiReply`

### `backend/src/chat/chat-backup.service.ts`
- Methods: `exportChannel`, `importChannel`

### `backend/src/chat/chat-settings.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/chat.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/chat-llm.service.ts`
- Methods: `generateText`, `chatCompletion`, `proxyMessage`, `proxyChatMessages`, `translateText`

### `backend/src/chat/chat-settings.service.ts`
- Methods: `getSettings`, `updateSettings`

### `backend/src/chat/chat.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/chat-llm-proxy.service.ts`
- Methods: `proxyChatMessage`, `proxyChatWithHistory`

### `backend/src/chat/translation.service.ts`
- Methods: `detectLanguage`, `translate`, `translateWithDetection`, `translateWithExplanations`

### `backend/src/chat/chat-backup.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/groups.service.ts`
- Methods: `createGroup`, `renameGroup`, `addGroupMembers`, `removeGroupMember`, `getGroupMembers`, `generateInviteCode`, `generateInviteLink`, `getInviteInfo`, `joinByInviteCode`, `createAnnouncementGroup`, `sendAnnouncement`

### `backend/src/chat/groups.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/conversation-starter.service.ts`
- Methods: `getSuggestions`

### `backend/src/chat/quick-replies/quick-replies.controller.ts`
- Methods: `getQuickReplies`

### `backend/src/chat/quick-replies/quick-replies.service.ts`
- Methods: `getQuickReplies`, `createQuickReply`

### `backend/src/chat/quick-replies/dto/create-quick-reply.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/services/system-message.service.ts`
- Methods: `publishToRoom`

### `backend/src/chat/interfaces/chat-message.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/send-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/forward-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/group.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/reply-to-status-update.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/conversation-starter.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/delete-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/set-wallpaper.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/add-favourite.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/suggested-replies-request.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/create-group.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/suggested-replies-response.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/llm-proxy.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/fix-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/add-member.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/react-to-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/edit-message.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/chat-settings.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/chat-backup.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/update-message-status.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/label.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/chat/dto/share-contact.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/curated-content/curated-content.service.ts`
- Methods: `getArticles`, `getArticleById`, `createArticle`, `getDialogues`, `getDialogueById`, `createDialogue`

### `backend/src/curated-content/curated-content.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/curated-content/curated-content.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/curated-content/interfaces/curated-content.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/curated-content/dto/create-dialogue.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/curated-content/dto/create-article.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/calls/calls.service.ts`
- Methods: `registerParticipant`, `generateE2eeKey`, `getActiveCalls`, `getActiveCall`, `holdCall`, `resumeCall`, `leaveCall`, `getWaitingCalls`, `acceptWaitingCall`, `switchCall`, `initiateCall`, `createGroupCall`

### `backend/src/calls/calls.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/calls/calls.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/calls/dto/switch-call.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/calls/dto/create-group-call.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/calls/dto/initiate-call.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/cloudflare-r2/r2.service.ts`
- Methods: `generateUploadUrl`, `uploadFromUrl`

### `backend/src/study-streak/study-streak.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/study-streak/study-streak.service.ts`
- Methods: `getStreak`, `updateStreak`

### `backend/src/study-streak/study-streak.controller.ts`
- Methods: `health`

### `backend/src/study-buddies/study-buddies.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/study-buddies/study-buddies.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/study-buddies/study-buddies.service.ts`
- Methods: `toBuddyRequest`, `requestBuddy`, `getIncomingRequests`, `respondToRequest`, `getPotentialBuddies`, `followUser`, `unfollowUser`, `getOrCreateChannel`

### `backend/src/study-buddies/dto/study-buddy.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/feed/feed.service.ts`
- Methods: `getFeed`, `getMomentById`, `createMoment`, `deleteMoment`

### `backend/src/config/env.validation.ts`
- *(No methods found or interface/type definition)*

### `backend/src/config/validation.schema.ts`
- *(No methods found or interface/type definition)*

### `backend/src/daily-tip/daily-tip.service.ts`
- Methods: `getTodayTipForUser`, `generateDailyTips`

### `backend/src/daily-tip/daily-tip.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/daily-tip/daily-tip.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/quiz/quiz.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/quiz/quiz.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/quiz/quiz.service.ts`
- Methods: `getQuestions`, `evaluateResults`, `submitResults`

### `backend/src/quests/quests.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/quests/quests.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/quests/quests.service.ts`
- Methods: `getDailyQuests`, `incrementProgress`

### `backend/src/hobby-tags/hobby-tags.controller.ts`
- Methods: `getAllTags`

### `backend/src/hobby-tags/hobby-tags.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/hobby-tags/hobby-tags.service.ts`
- Methods: `getBaseVocabulary`, `getAllTags`, `createTag`, `getUserTags`, `addUserTag`, `removeUserTag`, `updateProficiency`, `getVocabularyForUser`

### `backend/src/supabase/supabase.service.ts`
- Methods: `getClient`, `getRedisClient`, `onModuleDestroy`, `updateLastActivity`, `incrementXp`, `getUserXp`, `isVipUser`

### `backend/src/supabase/supabase.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/blocks/blocks.service.ts`
- Methods: `getBlockedUsers`, `unblockUser`

### `backend/src/blocks/blocks.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/blocks/blocks.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/linked-accounts/linked-accounts.service.ts`
- Methods: `getLinkedAccounts`, `linkAccount`, `unlinkAccount`

### `backend/src/linked-accounts/linked-accounts.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/linked-accounts/linked-accounts.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/shopping/shopping.service.ts`
- Methods: `getCatalog`, `getItem`, `decrementStock`

### `backend/src/shopping/cart.service.ts`
- Methods: `onModuleInit`, `onModuleDestroy`, `touchCart`, `getCart`, `addItem`, `removeItem`, `checkout`

### `backend/src/shopping/shopping.controller.ts`
- Methods: `getCatalog`

### `backend/src/shopping/cart.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/shopping/sanitise-shopping.helper.ts`
- *(No methods found or interface/type definition)*

### `backend/src/shopping/shopping.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/shopping/dto/add-to-cart.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/corrector-score/corrector-score.service.ts`
- Methods: `submitRating`, `getCorrectorScore`

### `backend/src/corrector-score/corrector-score.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/corrector-score/corrector-score.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/corrector-score/dto/rate-corrector.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/two-factor/two-factor.service.ts`
- Methods: `generateSecret`, `verifyToken`, `disable`, `isEnabled`

### `backend/src/two-factor/two-factor.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/two-factor/two-factor.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/two-factor/two-factor.guard.ts`
- Methods: `canActivate`, `extractRequest`, `isRequestWithUser`

### `backend/src/reading-engine/reading-engine.controller.ts`
- Methods: `getUserId`

### `backend/src/reading-engine/reading-engine.service.ts`
- Methods: `createResource`, `updateResource`, `getResource`, `listResources`, `deleteResource`, `tokenise`, `getProgress`, `recordSession`, `getCachedTranslation`, `cacheTranslation`, `clearUserCaches`, `toResource`

### `backend/src/reading-engine/reading-engine.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/reading-engine/reading-engine-cache.service.ts`
- Methods: `buildKey`, `buildUserPattern`, `set`, `delete`, `deletePattern`, `handleResourceMutated`, `handleFlashcardMutated`, `handleReadingCompleted`, `handleTranslationRequested`, `handleUserDataCleared`, `inferTtl`

### `backend/src/reading-engine/interfaces/cache-rules.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/reading-engine/interfaces/reading.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/reading-engine/dto/update-reading-resource.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/reading-engine/dto/create-reading-resource.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/video-calls/video-calls.service.ts`
- Methods: `createRoom`, `joinRoom`

### `backend/src/video-calls/video-calls.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/video-calls/video-calls-cache-invalidation.service.ts`
- Methods: `getRedis`, `invalidateRoomCaches`, `invalidateParticipantCaches`, `invalidateRecordingCaches`, `invalidateAllVideoClassroomCaches`, `handleRoomMutated`, `handleParticipantMutated`, `handleRecordingMutated`

### `backend/src/video-calls/video-calls-degradation.service.ts`
- Methods: `getBreaker`, `isAvailable`, `recordSuccess`, `recordFailure`, `cacheToken`, `getCachedToken`, `recordDegradationEvent`, `getRecentDegradationEvents`, `resetAllBreakers`, `getAllBreakerStates`

### `backend/src/video-calls/video-calls.controller.ts`
- Methods: `health`

### `backend/src/llm-proxy/llm-proxy.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/llm-proxy/llm-proxy.service.ts`
- Methods: `proxyMessage`, `chatCompletion`

### `backend/src/communities/communities.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/communities/communities.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/communities/communities.service.ts`
- Methods: `create`, `findById`, `listByOwner`, `update`, `delete`, `addGroup`, `removeGroup`, `getGroups`

### `backend/src/communities/dto/update-community.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/communities/dto/create-community.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/communities/dto/add-group.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/verify.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/seed.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/migrations/20260801000000-create-flashcard-decks.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/migrations/20260731000000-create-user-achievements.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/migrations/20260730_add_session_summary.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/migrations/20260731000003-create-curated-content.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/migrations/1723832325123-add-business-profiles.ts`
- *(No methods found or interface/type definition)*

### `backend/src/database/migrations/20260730000001-create-quick-polls.ts`
- *(No methods found or interface/type definition)*

### `backend/src/decks/decks.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/decks/decks.service.ts`
- Methods: `createDeck`, `getDecks`, `getDeck`, `updateDeck`, `deleteDeck`, `addFlashcardToDeck`, `removeFlashcardFromDeck`, `getDeckFlashcards`

### `backend/src/decks/decks.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/decks/interfaces/deck.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/decks/dto/deck.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/leaderboard/leaderboard.service.ts`
- Methods: `getTopCorrectors`

### `backend/src/leaderboard/leaderboard.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/leaderboard/leaderboard.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/user-statistics/user-statistics.service.ts`
- Methods: `getUserStatistics`

### `backend/src/user-statistics/user-statistics.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/user-statistics/user-statistics.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/user-statistics/dto/user-statistics-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/password-reset/password-reset.service.ts`
- Methods: `requestPasswordReset`, `resetPassword`

### `backend/src/password-reset/password-reset.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/password-reset/password-reset.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/password-reset/dto/request-password-reset.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/password-reset/dto/reset-password.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/word-of-the-day/word-of-the-day.controller.ts`
- Methods: `findOne`

### `backend/src/word-of-the-day/word-of-the-day.service.ts`
- Methods: `getTodayWord`, `getDayOfYear`

### `backend/src/word-of-the-day/word-of-the-day.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/nlp.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/nlp.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/nlp-rate-limiter.guard.ts`
- Methods: `canActivate`

### `backend/src/nlp/nlp.service.ts`
- Methods: `detectLanguage`, `checkRateLimit`, `translate`, `grammarCheck`, `explainGrammar`, `while`, `pronunciationScore`, `transcribeAudio`, `simplify`, `translateUi`, `translateBio`, `translateAndCorrect`, `transcribeVoiceOnly`, `transcribeVoice`, `generateSessionSummary`

### `backend/src/nlp/interfaces/nlp-results.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/translate-bio.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/grammar-check.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/explain-grammar.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/transcribe-voice.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/pronunciation-score.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/translate.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/simplify.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/translate-ui.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/nlp/dto/transcribe-audio.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/flashcards/suggest-flashcards.service.ts`
- Methods: `suggestFromMessage`

### `backend/src/flashcards/flashcards.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/flashcards/flashcards.service.ts`
- Methods: `getHealthStatus`, `isConnectivityError`, `createOrUpdateFlashcard`, `updateSrsLevel`, `applySm2Algorithm`, `getFlashcards`, `getDueReviews`, `markSuccessfulSync`, `createDegradedFlashcard`, `recordReviewMetrics`, `getCachedFlashcards`, `getCachedDueReviews`

### `backend/src/flashcards/suggest-flashcards.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/flashcards/srs-rate-limiter.guard.ts`
- Methods: `canActivate`

### `backend/src/flashcards/sanitise-flashcard.helper.ts`
- *(No methods found or interface/type definition)*

### `backend/src/flashcards/flashcards.controller.ts`
- Methods: `getHealth`

### `backend/src/flashcards/interfaces/flashcard.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/flashcards/dto/flashcard.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/flashcards/dto/suggest-flashcards.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/audio-rooms.service.ts`
- Methods: `archiveRecording`, `onModuleInit`, `createRoom`, `createLanguageParty`, `createPrivateRoom`, `generateToken`, `listActiveRooms`, `getRoom`, `getStage`, `reorderSpeakers`, `clearStage`, `raiseHand`, `approveSpeaker`, `muteSpeaker`, `demoteSpeaker`, `inviteCoHost`, `removeCoHost`, `sendCaption`, `broadcastAICaption`, `archiveRoom`, `getDistinctTopics`, `getDistinctLevels`, `getInvitedPrivateRooms`, `getActiveHostIds`, `createPoll`, `submitVote`, `getPollResults`, `addNote`, `getNotes`, `deleteNote`, `getTranscript`, `isAuthorizedInRoom`, `sendReaction`, `getCallLogs`, `getExclusiveEmojis`, `getSoundboardSounds`, `playSound`, `tipHost`, `invalidateAudioRoomCache`

### `backend/src/audio-rooms/transcript-egress.service.ts`
- Methods: `startEgress`, `stopEgress`, `generateTranscriptFromAudioUrl`, `while`

### `backend/src/audio-rooms/audio-rooms.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/audio-rooms.controller.ts`
- Methods: `getDistinctTopics`, `getDistinctLevels`, `getExclusiveEmojis`, `listSoundboardSounds`

### `backend/src/audio-rooms/interfaces/voice-room-note.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/interfaces/audio-room.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/interfaces/call-log.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/submit-vote.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/create-language-party.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/audio-room.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/get-call-logs-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/voice-room-note.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/audio-room-token.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/reorder-stage.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/tip-host.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/send-reaction.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/create-poll.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/create-private-party.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/audio-rooms/dto/play-sound.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/media/audio-compression.service.ts`
- Methods: `compressToOgg`, `compressToM4a`

### `backend/src/media/media.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/media/media.service.ts`
- Methods: `onModuleInit`, `generatePresignedUrl`, `generateCoverPresignedUrl`, `uploadAndCompressVoiceNote`, `confirmCoverUpload`, `processUploadedImage`, `uploadAndSetCoverImage`, `uploadAndSetAvatarImage`, `markMediaAsViewed`

### `backend/src/media/image-compression.service.ts`
- Methods: `compress`

### `backend/src/media/media.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/media/dto/presigned-url.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/resource-library/resource-library.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/resource-library/resource-library.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/resource-library/resource-library.service.ts`
- Methods: `toResource`, `create`, `findAll`, `findOne`, `update`, `remove`

### `backend/src/resource-library/interfaces/resource.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/resource-library/dto/update-resource.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/resource-library/dto/create-resource.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/metrics/metrics.interceptor.ts`
- Methods: `intercept`

### `backend/src/metrics/recommendations-metrics.aggregator.ts`
- Methods: `collectMatchmakingStats`

### `backend/src/metrics/srs-metrics.aggregator.ts`
- Methods: `collectSrsStats`

### `backend/src/metrics/escrow-metrics.aggregator.ts`
- Methods: `collectEscrowStats`

### `backend/src/metrics/metrics.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/metrics/metrics.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/metrics/ts-metrics.aggregator.ts`
- Methods: `collectTsStats`

### `backend/src/metrics/metrics.service.ts`
- Methods: `recordHttpRequest`, `incrementActiveConnections`, `decrementActiveConnections`, `recordSrsFlashcardCreated`, `recordSrsReviewCompleted`, `setSrsDueCards`, `setSrsAverageEasinessFactor`, `setSrsReviewSuccessRate`, `setSrsCardsPerLevel`, `setSrsCardsStuck`, `setSrsDecksTotal`, `recordSrsDeckCreated`, `recordTsReportSubmitted`, `recordTsBlockCreated`, `recordTsBlockRemoved`, `setTsPendingReports`, `setTsActiveBlocksTotal`, `recordTsModerationAction`, `recordTsDatingRiskScore`, `recordReadingEngineSession`, `recordReadingEngineWordsParsed`, `recordReadingEngineTokenisationDuration`, `recordReadingEngineAiRequest`, `recordReadingEngineAiRequestDuration`, `recordReadingEngineAiError`, `recordReadingEngineFlashcardSave`, `recordReadingEngineSessionDuration`, `recordReadingEngineWordLookup`, `setReadingEngineDailyActiveReaders`, `recordCoinPurchase`, `recordCoinPurchaseError`, `recordCoinFraudAttempt`, `setCoinBalanceTotal`, `setCoinHighBalanceUsers`, `recordDailyCheckInClaim`, `recordGiftSent`, `recordStickerPurchase`, `observeCoinTransactionLatency`, `recordMatchmakingRecommendationsGenerated`, `recordMatchmakingRecommendationsPerRequest`, `recordMatchmakingFallbackTierUsed`, `recordMatchmakingEmptyResults`, `recordMatchmakingRequestDuration`, `recordMatchmakingDailyCacheMiss`, `setMatchmakingTierSuccessRate`, `recordEscrowCreated`, `recordEscrowReleased`, `recordEscrowRefunded`, `recordEscrowCancelled`, `recordEscrowAutoRefunded`, `recordEscrowDegradedOperation`, `setEscrowDegradedQueueSize`, `setEscrowStaleHeldCount`, `recordAdminBanAction`, `recordAdminWarnAction`, `recordAdminVipToggle`, `recordAdminBlockRemoval`, `recordAdminReportResolution`, `recordAdminApiError`, `observeAdminApiLatency`, `setAdminPendingReports`, `setAdminActiveBlocks`, `recordAdminLoginHistoryRequest`, `recordVideoClassroomCreated`, `recordVideoClassroomCreationFailed`, `recordVideoClassroomJoined`, `recordVideoClassroomJoinFailed`, `setVideoClassroomsActiveRooms`, `recordVideoClassroomTokenGenerationDuration`, `recordVideoClassroomRoomDuration`, `setVideoClassroomParticipantMax`, `getRegister`, `getMetrics`

### `backend/src/moderation/moderation.service.ts`
- Methods: `getItems`, `reportUser`, `approveItem`, `rejectItem`, `analyseUserForDatingBehaviour`

### `backend/src/moderation/moderation.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moderation/moderation.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moderation/dto/report-user.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/moderation/dto/moderation-action.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notification-preferences/notification-preferences.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notification-preferences/notification-preferences.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/notification-preferences/notification-preferences.service.ts`
- Methods: `getPreferences`, `updatePreferences`, `resetToDefaults`, `getDefaultPreferences`

### `backend/src/notification-preferences/dto/update-notification-preferences.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/discovery/discovery-cache-invalidation.service.ts`
- Methods: `getRedis`, `handlePartnerOfWeekUpdated`, `handleDailyRecommendationsUpdated`, `handleUserProfileUpdated`, `handleUserVipUpdated`, `handleUserLocationUpdated`, `handleUserMetricsUpdated`, `handleNewUserOnboarded`, `handleUserDiscoveryCleared`, `deleteKey`, `deleteByPattern`, `buildUserCacheKey`

### `backend/src/discovery/sanitise-discovery.helper.ts`
- *(No methods found or interface/type definition)*

### `backend/src/discovery/cache.interceptor.ts`
- Methods: `intercept`

### `backend/src/discovery/discovery.service.ts`
- Methods: `calculatePartnerOfWeek`, `calculateDailyRecommendations`, `getPartnerOfWeekIds`, `searchPartners`, `searchPartnersWithDegradation`, `getAudioIntros`, `getRecentNativeSpeakers`, `getSpotlightUsers`, `findByLanguagePair`, `getMockDiscoveryData`, `applyAdvancedFilters`, `sortUsers`, `searchByCountryCity`, `parseStringArray`

### `backend/src/discovery/discovery.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/discovery/discovery-degradation.service.ts`
- Methods: `getBreaker`, `isAvailable`, `recordSuccess`, `recordFailure`, `recordDegradationEvent`, `getRecentDegradationEvents`, `resetAllBreakers`, `getAllBreakerStates`

### `backend/src/discovery/discovery-rate-limiter.guard.ts`
- Methods: `canActivate`

### `backend/src/discovery/discovery.controller.ts`
- Methods: `getPartnerOfWeek`, `getDegradationStatus`

### `backend/src/discovery/interfaces/cache-rules.interface.ts`
- *(No methods found or interface/type definition)*

### `backend/src/discovery/dto/search-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/discovery/dto/discovery-profile.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/discovery/dto/language-pair-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-islands/language-islands.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-islands/language-islands.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-islands/language-islands.service.ts`
- Methods: `list`, `getById`, `create`, `update`, `remove`, `join`, `leave`, `getMyIslands`

### `backend/src/language-islands/dto/query-language-islands.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-islands/dto/update-language-island.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/language-islands/dto/create-language-island.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/favourites/favourites.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/favourites/favourites.controller.ts`
- *(No methods found or interface/type definition)*

### `backend/src/favourites/favourites.service.ts`
- Methods: `addFavourite`, `removeFavourite`, `getUserFavourites`

### `backend/src/events/events.service.ts`
- Methods: `onModuleInit`, `onModuleDestroy`, `createEvent`, `listEvents`, `getUserEvents`, `getEvent`, `getCategories`, `getUserRsvp`, `createRsvp`, `removeRsvp`

### `backend/src/events/events.module.ts`
- *(No methods found or interface/type definition)*

### `backend/src/events/events.controller.ts`
- Methods: `getCategories`

### `backend/src/events/dto/create-event.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/events/dto/rsvp.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/events/dto/events-query.dto.ts`
- *(No methods found or interface/type definition)*

### `backend/src/events/entities/rsvp.entity.ts`
- *(No methods found or interface/type definition)*

### `backend/src/events/entities/event.entity.ts`
- *(No methods found or interface/type definition)*

## Frontend (Angular)
### `frontend/src/main.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/test.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/main.server.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/environments/environment.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/environments/environment.development.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/environments/environment.prod.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/app.routes.server.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/app.config.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/app.component.ts`
- Methods: `startProductTour`, `prepareRoute`, `ngOnInit`, `isRecord`, `isValidPayload`, `isIncomingCallPayload`, `onAcceptCall`, `onDeclineCall`, `toggleBiometricLock`

### `frontend/src/app/app.routes.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/app.config.server.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/version.constants.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/models/settings.model.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/models/faq.model.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/monetisation/services/subscription-plans.service.ts`
- Methods: `getPlans`, `getPlanById`

### `frontend/src/app/rooms/room-chat/room-chat.component.ts`
- Methods: `sendMessage`, `onInput`, `scrollToBottom`

### `frontend/src/app/ai-conversation/ai-conversation.component.ts`
- Methods: `startScenario`, `backToScenarios`, `send`, `buildConversationHistory`

### `frontend/src/app/achievements/achievements.component.ts`
- Methods: `progressPercent`

### `frontend/src/app/admin/user-management/user-management.component.ts`
- Methods: `ngOnInit`, `loadUsers`, `toggleVip`

### `frontend/src/app/interests-select/interests-select.component.ts`
- Methods: `toggleInterest`, `confirmSelection`

### `frontend/src/app/audio-intro/audio-intro-recorder.component.ts`
- Methods: `uploadAudio`, `setError`, `startRecording`, `stopRecording`, `togglePlayback`

### `frontend/src/app/audio-intro/audio-intro.service.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/theme.service.ts`
- Methods: `initTheme`, `setTheme`, `applyTheme`

### `frontend/src/app/services/stripe.service.ts`
- Methods: `createCheckoutSession`

### `frontend/src/app/services/audio-compression.service.ts`
- Methods: `compressAudio`, `audioBufferToWav`, `while`

### `frontend/src/app/services/centrifugo.service.ts`
- Methods: `connect`, `disconnect`, `unsubscribe`, `publish`, `unsubscribeLiveRoom`, `unsubscribeLiveLocation`, `isLiveLocationPayload`, `isRoomMessage`, `isVoiceRoomPayload`

### `frontend/src/app/services/legal.service.ts`
- Methods: `fetchTermsOfService`, `fetchPrivacyPolicy`

### `frontend/src/app/services/proficiency.service.ts`
- Methods: `assess`, `setLanguagePreferences`

### `frontend/src/app/services/srs-onboarding-tour.service.ts`
- Methods: `loadTourCompletionState`, `startTour`, `closeTour`, `resetTour`, `markTourCompleted`

### `frontend/src/app/services/chat.service.ts`
- Methods: `getLabels`, `addLabel`, `removeLabel`, `assignLabelToRoom`, `removeLabelFromRoom`, `addBlockedUser`, `removeBlockedUser`, `getBlockedUsers`, `getHeaders`, `sendMessage`, `syncOfflineMessages`, `getMessages`, `getRooms`, `replyToStatusUpdate`, `lockChat`, `unlockChat`, `getLockedRoomIds`, `addFavourite`, `reportMessage`, `searchMessages`, `getFavourites`, `removeFavourite`, `loadBlockedUsers`, `isBlocked`, `correctMessage`, `fixMessage`, `createGroup`, `renameGroup`, `addGroupMembers`, `removeGroupMember`, `getGroupMembers`, `getRoomMembers`, `translateText`, `transcribeVoice`, `getSuggestedReplies`, `getConversationStarters`, `translateVoiceroomText`, `exportChatHistory`, `downloadChatHistory`, `setChatWallpaper`, `getChatWallpaper`, `deleteMessage`, `deleteMessageForEveryone`, `forwardMessage`, `markMessageStatus`

### `frontend/src/app/services/video-call.service.ts`
- Methods: `startCall`, `acceptCall`, `endCall`, `toggleMute`, `toggleVideo`, `switchCamera`, `setupRoomListeners`, `handleRemoteParticipantTracks`, `startDurationTimer`, `stopDurationTimer`

### `frontend/src/app/services/media.service.ts`
- Methods: `uploadAvatar`, `uploadVoiceNote`, `markMediaAsViewed`, `clearMediaCache`

### `frontend/src/app/services/onboarding.service.ts`
- Methods: `setNativeLanguage`, `toggleTargetLanguage`, `setDisplayName`, `setQuizResult`, `nextStep`, `prevStep`, `finish`, `completeOnboarding`

### `frontend/src/app/services/moderation.service.ts`
- Methods: `getItemsResource`, `getHeaders`, `getItems`, `approveItem`, `rejectItem`, `reportUser`, `getUserRiskAnalysis`

### `frontend/src/app/services/chat-backup.service.ts`
- Methods: `exportChannel`, `importChannel`

### `frontend/src/app/services/srs-circuit-breaker.service.ts`
- Methods: `getBreaker`, `isAvailable`, `recordSuccess`, `recordFailure`, `getState`, `reset`

### `frontend/src/app/services/linked-accounts.service.ts`
- Methods: `getLinkedAccounts`, `linkAccount`, `unlinkAccount`

### `frontend/src/app/services/haptic-feedback.service.ts`
- Methods: `trigger`, `tap`, `success`

### `frontend/src/app/services/livekit.service.ts`
- Methods: `createRoom`, `getToken`, `startRoom`, `getLiveKitUrl`, `joinRoom`, `publishTracks`, `toggleMute`, `toggleSpeakerphone`, `toggleScreenShare`, `leaveRoom`

### `frontend/src/app/services/transliteration.service.ts`
- Methods: `transliterate`, `toRomaji`, `toPinyin`

### `frontend/src/app/services/matchmaking-onboarding.service.ts`
- Methods: `startTour`, `closeTour`, `markComplete`, `isCompleted`, `reset`

### `frontend/src/app/services/confirm.service.ts`
- Methods: `confirm`, `dismiss`

### `frontend/src/app/services/2fa.service.ts`
- Methods: `enable`, `verify`, `disable`, `checkStatus`

### `frontend/src/app/services/gdpr.service.ts`
- Methods: `requestArchive`, `deleteAccount`, `cancelDeletion`

### `frontend/src/app/services/supabase.service.ts`
- Methods: `getRecentlyJoinedNativeSpeakers`, `linkAccount`, `unlinkAccount`, `getLinkedAccounts`, `getDailyStreak`, `updateDailyStreak`, `getClient`, `getUserAudioIntro`, `getEarnedBadges`, `upgrade`, `saveContentOffline`, `getOfflineContent`, `getAllOfflineContent`, `deleteOfflineContent`, `clearOfflineCache`, `deleteOldMedia`, `uploadFile`, `uploadAvatar`, `listFiles`, `deleteFile`, `getStatusViewers`

### `frontend/src/app/services/unread-counter.service.ts`
- Methods: `set`, `increment`, `decrement`, `resetAll`, `setChatUnread`, `setNotificationUnread`, `incrementChatUnread`, `decrementChatUnread`, `incrementNotificationUnread`, `decrementNotificationUnread`, `signalFor`, `updateAppBadge`

### `frontend/src/app/services/audio-rooms.store.ts`
- Methods: `isHostTipPayload`, `isRoomEvent`, `findRemoteVideoTrack`, `getHeaders`, `loadActiveRooms`, `loadRoomsByLanguage`, `createRoom`, `createPrivateParty`, `loadPrivateRooms`, `joinRoom`, `unpublishLocalCamera`, `onTrackSubscribed`, `onTrackUnsubscribed`, `raiseHand`, `approveSpeaker`, `demoteSpeaker`, `dismissRaisedHand`, `muteSpeaker`, `unmuteSpeaker`, `kickSpeaker`, `inviteCoHost`, `removeCoHost`, `sendCaption`, `broadcastAICaption`, `tipHost`, `tipAnimationForAmount`, `tipIconForAmount`, `sendRoomChatMessage`, `archiveRoom`, `leaveRoom`

### `frontend/src/app/services/blocked-users.service.ts`
- Methods: `getHeaders`, `loadBlockedUsers`, `unblockUser`

### `frontend/src/app/services/economy-error-handler.service.ts`
- Methods: `getHeaders`, `reportEconomyCrash`

### `frontend/src/app/services/video-classroom-onboarding.service.ts`
- Methods: `startMarketplaceTour`, `startRoomTour`, `markComplete`, `isCompleted`, `reset`

### `frontend/src/app/services/draft.service.ts`
- Methods: `isAvailable`, `getUserPrefix`, `chatKey`, `chatV2Key`, `momentKey`, `saveChatDraft`, `loadChatDraft`, `clearChatDraft`, `saveChatDraftV2`, `loadChatDraftV2`, `clearChatDraftV2`, `saveMomentDraft`, `loadMomentDraft`, `clearMomentDraft`

### `frontend/src/app/services/escrow-offline.service.ts`
- Methods: `initDB`, `isAvailable`, `cacheEscrows`, `getCachedEscrow`, `getCachedEscrows`, `clearEscrowCache`, `enqueueOperation`, `getPendingOperations`, `removeOperation`, `clearOperationQueue`

### `frontend/src/app/services/suggest-flashcards.service.ts`
- Methods: `suggestFromMessage`

### `frontend/src/app/services/deck.service.ts`
- Methods: `getHeaders`, `getDecks`, `getDeck`, `createDeck`, `updateDeck`, `deleteDeck`, `addFlashcardToDeck`, `removeFlashcardFromDeck`, `getDeckFlashcards`

### `frontend/src/app/services/monetisation.service.ts`
- Methods: `createCheckoutSession`, `generateApiKey`, `getAnalytics`, `getDiagnosticLogs`, `createDiagnosticLog`, `validateAppleReceipt`, `restorePurchases`, `getCoinsBalance`

### `frontend/src/app/services/sharing.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/cover-photo.service.ts`
- Methods: `upload`

### `frontend/src/app/services/image-compression.service.ts`
- Methods: `compressImage`

### `frontend/src/app/services/centrifuge.service.ts`
- Methods: `calculateBackoffDelay`, `getRetryAfterMs`, `scheduleReconnect`, `connect`, `unsubscribe`, `publish`, `disconnect`

### `frontend/src/app/services/help-centre.service.ts`
- Methods: `getArticles`, `getCategories`

### `frontend/src/app/services/flashcard.service.ts`
- Methods: `checkDegradedHeader`, `getHealth`, `createFlashcard`, `updateSrsLevel`, `getFlashcards`, `getDueReviews`, `syncOfflineReviews`

### `frontend/src/app/services/upload.service.ts`
- Methods: `uploadAvatar`

### `frontend/src/app/services/translate.pipe.ts`
- Methods: `transform`

### `frontend/src/app/services/notification.service.ts`
- Methods: `getHeaders`, `getNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `getFallbackNotifications`

### `frontend/src/app/services/quick-poll.service.ts`
- Methods: `createPoll`, `submitVote`, `getPollResults`

### `frontend/src/app/services/firebase-messaging.service.ts`
- Methods: `requestPermissionAndGetToken`, `persistFcmToken`

### `frontend/src/app/services/user.service.ts`
- Methods: `getHeaders`, `enableLocationSpoofing`, `getMyProfile`, `getUserProfile`, `followUser`, `unfollowUser`, `getFollowers`, `getFollowing`, `likeProfile`, `updateCustomAvatar`, `updateAboutStatus`, `updateMyProfile`, `setDefaultTranslationLanguage`, `updateNativeLanguages`, `updateTargetLanguages`, `getMyVisitors`, `getProfileVisitors`, `recordVisit`, `getPresignedUploadUrl`, `getPresignedCoverPhotoUrl`, `getPresignedAvatarUrl`, `uploadAvatar`, `updateCoverPhotoUrl`, `uploadCoverPhoto`, `downloadMyData`, `rateCorrector`, `getLinkedAccounts`, `getMyPrivacySettings`, `linkAccount`, `unlinkAccount`, `getMilestoneForStreak`, `getStudyStreak`, `getAvailableHobbies`, `getAvailableInterests`, `searchUsers`, `queryUsersByLanguagePairs`, `getMyBadges`, `assessProficiency`, `getOverviewStats`, `getMyXpTotal`, `updatePrivacySettings`, `getBusinessProfile`, `updateBusinessProfile`, `blockUser`, `unblockUser`, `reportUser`, `subscribeToFcmTopic`, `unsubscribeFromFcmTopic`, `deleteMyAccount`, `restoreMyAccount`, `getMessageFilters`, `setMessageFilters`, `setDoNotDisturbSchedule`, `getLastActiveFormatted`

### `frontend/src/app/services/escrow.service.ts`
- Methods: `listEscrows`, `createEscrow`, `releaseEscrow`, `refundEscrow`, `disputeEscrow`, `getEscrow`, `listUserEscrows`, `syncOfflineOperations`

### `frontend/src/app/services/subscription-plans.service.ts`
- Methods: `getAllPlans`, `getPlanById`, `getHighlightedBenefits`, `getShowcasePlans`

### `frontend/src/app/services/vocabulary.store.ts`
- Methods: `sanitiseFlashcard`, `getHeaders`, `loadAllFlashcards`, `loadDueReviews`, `getWordStatus`, `saveWord`, `updateSrsLevel`, `estimateNewLevel`, `syncOfflineReviews`, `translateWordOrSentence`, `checkGrammar`, `scorePronunciation`, `reportSrsError`, `triggerHapticFeedback`

### `frontend/src/app/services/mock-data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/streak-milestone.service.ts`
- Methods: `celebrate`, `clear`

### `frontend/src/app/services/permission.service.ts`
- Methods: `requestMicrophonePermission`, `requestCameraPermission`

### `frontend/src/app/services/call-logs.service.ts`
- Methods: `getCallLogs`

### `frontend/src/app/services/ai-conversation.service.ts`
- Methods: `getScenarios`, `sendMessage`

### `frontend/src/app/services/subscription.service.ts`
- Methods: `getSubscriptionDetails`, `cancelSubscription`, `resumeSubscription`, `getInvoices`, `createBillingPortalSession`

### `frontend/src/app/services/restore-purchases.service.ts`
- Methods: `restorePurchases`

### `frontend/src/app/services/faq.service.ts`
- Methods: `getFaqs`

### `frontend/src/app/services/host-dashboard.service.ts`
- Methods: `getDashboardStats`

### `frontend/src/app/services/coin-economy-onboarding.service.ts`
- Methods: `markComplete`, `isCompleted`, `reset`

### `frontend/src/app/services/offline-queue.service.ts`
- Methods: `initDB`, `isIndexedDBAvailable`, `enqueueMessage`, `getQueuedMessages`, `removeMessage`, `clearQueue`

### `frontend/src/app/services/font-scale.service.ts`
- Methods: `setScale`, `reset`, `loadInitialScale`, `saveToStorage`, `applyScale`

### `frontend/src/app/services/milestone.service.ts`
- Methods: `getMilestones`, `getProgress`, `createMilestone`, `markCompleted`, `deleteMilestone`

### `frontend/src/app/services/study-buddy.service.ts`
- Methods: `requestBuddy`, `getMatches`, `getIncomingRequests`, `acceptRequest`, `declineRequest`

### `frontend/src/app/services/escrow-onboarding.service.ts`
- Methods: `startTour`, `markComplete`, `resetTour`, `isCompleted`

### `frontend/src/app/services/safety.service.ts`
- Methods: `persistMutedWords`, `addMutedWord`, `removeMutedWord`, `isMutedWord`, `clearMutedWords`, `loadBlockedUsers`, `isUserBlockedCached`, `setBlockedUserLocal`, `reportUser`, `reportUserAsync`, `blockUser`, `blockUserAsync`, `unblockUser`, `unblockUserAsync`, `getBlockedIds`, `getBlockedIdsAsync`, `setSilenceUnknownCallers`, `getSilenceUnknownCallers`, `getReportCategories`, `getCategories`, `getStaticReportCategories`, `getBlockedUserIds`, `getBlockerUserIds`, `getBlockedAndBlockerIds`, `isBlocked`

### `frontend/src/app/services/http-retry.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/version.service.ts`
- Methods: `getVersion`

### `frontend/src/app/services/discovery.service.ts`
- Methods: `getHeaders`, `findPartners`, `searchByCountryCity`, `getAudioIntros`, `getRecentNativeSpeakers`, `getSpotlightUsers`, `findByLanguagePair`, `translateBio`, `sendMessageToPartner`, `followPartner`

### `frontend/src/app/services/favourite.service.ts`
- Methods: `addFavourite`, `removeFavourite`, `getFavourites`

### `frontend/src/app/services/help.service.ts`
- Methods: `fetchArticles`, `fetchCategories`

### `frontend/src/app/services/communities.service.ts`
- Methods: `create`, `listMine`, `get`, `update`, `remove`, `addGroup`, `removeGroup`, `getGroups`

### `frontend/src/app/services/auth.service.ts`
- Methods: `loadBiometricLockPreference`, `arrayBufferToBase64Url`, `base64UrlToArrayBuffer`, `isBiometricSupported`, `lockApp`, `unlockApp`, `enableBiometricLock`, `disableBiometricLock`, `toAppUser`, `updateAuthState`, `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signInWithApple`, `signOut`, `enableTwoFactor`, `verifyTwoFactor`, `disableTwoFactor`, `checkTwoFactorStatus`, `getAccessToken`, `getBearerHeaders`, `isTwoFactorEnabled`, `signInWithTwoFactor`, `generateDeviceLink`, `consumeDeviceLink`, `swapDeviceLink`, `requestPasswordReset`, `resetPassword`, `changePassword`

### `frontend/src/app/services/flashcard-context-menu.directive.ts`
- Methods: `onContextMenu`, `onTouchStart`, `showOverlay`, `removeOverlay`, `reportError`

### `frontend/src/app/services/error-handler.service.ts`
- Methods: `handleError`, `reportError`, `reportStringError`, `reportHttpError`, `reportUnknown`, `sendPayload`

### `frontend/src/app/services/text-to-speech.service.ts`
- Methods: `isSpeaking`, `speak`, `stop`, `toggle`, `clearIfCurrent`

### `frontend/src/app/services/chat-settings.service.ts`
- Methods: `loadSettings`, `updateSetting`, `resetToDefaults`, `setLocal`

### `frontend/src/app/services/block.service.ts`
- Methods: `loadBlockedUsers`, `blockUser`, `unblockUser`

### `frontend/src/app/services/quiz.service.ts`
- Methods: `getQuestions`, `submitResults`

### `frontend/src/app/services/lesson.service.ts`
- Methods: `getHeaders`, `listLessons`, `getLesson`, `createLesson`, `updateLesson`, `deleteLesson`, `uploadFile`

### `frontend/src/app/services/study-streak.service.ts`
- Methods: `getHeaders`, `getStreak`, `checkin`

### `frontend/src/app/services/quick-replies.service.ts`
- Methods: `getQuickReplies`, `createQuickReply`

### `frontend/src/app/services/economy.store.ts`
- Methods: `getHeaders`, `loadInitialData`, `getDefaultCatalog`, `getDefaultCoinPackages`, `claimDailyCheckIn`, `loadCoinPackages`, `checkEconomyHealth`, `buyCoins`, `confirmCoinPurchase`, `sendGift`, `upgradeVip`, `loadDeveloperAnalytics`, `loadDiagnosticLogs`, `createDiagnosticLog`, `generateApiKey`, `reportUser`, `blockUser`, `triggerGiftAnimation`, `sanitiseAnimationType`, `isAnimationType`, `triggerPublicGiftAnimation`, `loadTransactionHistory`, `loadStickerPacks`, `unlockStickerPack`, `mapDiagnosticLog`

### `frontend/src/app/services/cultural-guide.service.ts`
- Methods: `fetchGuide`

### `frontend/src/app/services/offline-economy.service.ts`
- Methods: `syncOnlineStatus`, `initDB`, `cacheBalance`, `getCachedBalance`, `cacheCatalog`, `getCachedCatalog`, `cacheCoinPackages`, `getCachedCoinPackages`, `cacheStickerPacks`, `getCachedStickerPacks`, `enqueuePendingAction`, `getPendingActions`, `removePendingAction`, `clearPendingActions`, `clearAll`, `putInStore`, `deleteFromStore`, `clearStore`

### `frontend/src/app/services/audio-intro.service.ts`
- Methods: `getHeaders`, `getPresignedUploadUrl`, `uploadAudioBlob`, `updateAudioIntro`, `getAudioIntro`

### `frontend/src/app/services/offline-reading-engine.service.ts`
- Methods: `initDB`, `isAvailable`, `cacheArticles`, `getCachedArticles`, `getCachedArticle`, `clearAll`, `clearArticles`

### `frontend/src/app/services/admin.service.ts`
- Methods: `getHeaders`, `checkAdminAccess`, `listUsers`, `setVipStatus`, `getLoginHistory`, `banUser`, `warnUser`, `listAllBlocks`, `removeBlock`, `listBlockedUsers`, `adminUnblockUser`

### `frontend/src/app/services/livekit-e2ee.worker.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/version-check.service.ts`
- Methods: `isVersionLower`, `checkVersion`

### `frontend/src/app/services/pronunciation.service.ts`
- Methods: `submitVoiceFeedback`, `analyse`

### `frontend/src/app/services/hobby-tags.service.ts`
- Methods: `getAllTags`, `createGlobalTag`, `getMyTags`, `addMyTag`, `removeMyTag`, `updateProficiency`, `getVocabulary`

### `frontend/src/app/services/matchmaking-algorithm.service.ts`
- Methods: `scoreAndRank`, `applyOfflineFilters`, `getMatchReasonLabel`, `passesOfflineFilters`, `recordMatchmakingError`, `scorePartner`, `scoreLanguageComplementarity`, `scoreSharedInterests`, `scoreActivityStreak`, `scoreSeriousLearner`

### `frontend/src/app/services/events.service.ts`
- Methods: `listEvents`, `createGroupChat`, `getGroupChat`, `updateGroupChat`, `deleteGroupChat`, `addLabelToChat`, `removeLabelFromChat`, `getEvent`, `createEvent`, `shareContact`, `getCategories`, `getMyEvents`, `getRsvp`, `rsvp`, `removeRsvp`

### `frontend/src/app/services/data-storage.service.ts`
- Methods: `clearLocalCache`, `estimateCacheSize`, `toggleCellularAutoDownload`

### `frontend/src/app/services/srs-offline.service.ts`
- Methods: `initDB`, `isAvailable`, `cacheFlashcards`, `getCachedFlashcards`, `cacheDueReviews`, `getCachedDueReviews`, `queueSrsReview`, `putInStore`, `deleteFromStore`, `clearStore`

### `frontend/src/app/services/language-islands.service.ts`
- Methods: `listIslands`, `getIsland`, `createIsland`, `updateIsland`, `deleteIsland`, `joinIsland`, `leaveIsland`, `getMyIslands`

### `frontend/src/app/services/crash-report.service.ts`
- Methods: `initDB`, `isIndexedDBAvailable`, `reportCrash`, `getAllCrashesRaw`, `syncPendingCrashes`, `getUnsyncedCrashes`, `markCrashSynced`, `getCrashHistory`, `clearAllCrashes`

### `frontend/src/app/services/fcm.service.ts`
- Methods: `registerToken`, `unregisterToken`, `requestPermission`, `persistFcmToken`

### `frontend/src/app/services/offline-admin-storage.service.ts`
- Methods: `initDB`, `isAvailable`, `cacheUsers`, `getCachedUsers`, `cacheBlocks`, `getCachedBlocks`, `cacheLoginHistory`, `getCachedLoginHistory`, `cacheModerationItems`, `getCachedModerationItems`, `clearAll`, `usersKey`, `blocksKey`

### `frontend/src/app/services/offline-discovery-cache.service.ts`
- Methods: `initDB`, `isAvailable`, `cachePartner`, `cachePartners`, `getCachedPartner`, `getAllCachedPartners`, `cacheSearchResults`, `getCachedSearchResults`, `buildFiltersKey`, `clearAll`, `evictStaleEntries`

### `frontend/src/app/services/notification-preferences.service.ts`
- Methods: `getPreferences`, `updatePreferences`, `toggleCategoryChannel`, `resetToDefaults`, `getLegacyPreferences`, `updateLegacyPreferences`, `updateCustomizationPreferences`, `getCustomizationPreferences`

### `frontend/src/app/services/hobby-tags.store.ts`
- Methods: `loadAllTags`, `loadUserTags`, `addTag`, `removeTag`, `updateProficiency`, `loadVocabulary`

### `frontend/src/app/services/help-faq.service.ts`
- Methods: `getFAQs`, `getCategories`, `getQuickReplies`

### `frontend/src/app/services/resource-library.service.ts`
- Methods: `getAll`, `getById`, `create`, `update`, `delete`

### `frontend/src/app/services/study-buddies.service.ts`
- Methods: `follow`, `unfollow`, `getOrCreateChannel`

### `frontend/src/app/services/app-lock.service.ts`
- Methods: `isBiometricSupported`, `enableBiometricLock`, `disableBiometricLock`, `unlock`, `lockNow`, `arrayBufferToBase64Url`, `base64UrlToArrayBuffer`

### `frontend/src/app/services/discovery-onboarding.service.ts`
- Methods: `startTour`, `markComplete`, `hasCompletedTour`, `isCompleted`, `resetTour`

### `frontend/src/app/services/deep-link.service.ts`
- Methods: `registerRuntimeListener`, `processInitialDeepLink`, `handleDeepLink`, `toInternalPath`

### `frontend/src/app/services/sw-update.service.ts`
- Methods: `initialise`, `checkForUpdate`, `activateUpdate`

### `frontend/src/app/services/offline-reading.service.ts`
- Methods: `syncOnlineStatus`, `initDB`, `isAvailable`, `cacheArticles`, `getCachedArticles`, `recordReadingHistory`, `getReadingHistory`, `clearAll`, `putInStore`, `getAllFromStore`, `deleteFromStore`, `clearStore`

### `frontend/src/app/services/groups.service.ts`
- Methods: `createGroup`, `restrictSendMessages`, `restrictEditInfo`, `renameGroup`, `getMyGroups`, `addMember`, `removeMember`, `generateInviteCode`, `generateInviteLink`, `getInviteInfo`, `joinGroupByCode`, `sendAnnouncement`, `getAnnouncements`, `createAnnouncementGroup`, `broadcastMessage`

### `frontend/src/app/services/chat-cache.service.ts`
- Methods: `initDB`, `isAvailable`, `cacheMessages`, `getCachedMessages`, `invalidateMessages`, `appendCachedMessage`, `cacheRooms`, `getCachedRooms`, `invalidateRooms`, `cacheFavourites`, `getCachedFavourites`, `invalidateFavourites`, `evictStaleEntries`

### `frontend/src/app/services/html-sanitisation.service.ts`
- Methods: `sanitiseText`, `sanitiseUrl`

### `frontend/src/app/services/typing.service.ts`
- Methods: `connect`, `disconnect`, `sendTyping`, `isTypingPayload`, `handleTypingEvent`, `removeUser`, `clearAllTimers`

### `frontend/src/app/services/saved-content.service.ts`
- Methods: `getSavedContent`, `clearCache`

### `frontend/src/app/services/lessons.service.ts`
- Methods: `getLessons`

### `frontend/src/app/services/location.service.ts`
- Methods: `getCurrentLocation`, `shareCurrentLocation`, `startLiveShare`, `updateLiveLocation`, `stopLiveShare`, `getLiveLocation`

### `frontend/src/app/services/offline-video-classroom.service.ts`
- Methods: `syncOnlineStatus`, `initDB`, `isAvailable`, `cacheClassroomListing`, `getCachedClassroomListing`, `cacheRoomDetail`, `getCachedRoomDetail`, `evictStaleEntries`, `purgeStaleInStore`, `clearAll`, `getAllFromStore`

### `frontend/src/app/services/toast.service.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/cache.service.ts`
- Methods: `clearCache`, `deleteOldMedia`

### `frontend/src/app/services/api.service.ts`
- Methods: `getAuthHeaders`

### `frontend/src/app/services/quests.store.ts`
- Methods: `fetchQuests`

### `frontend/src/app/services/network-status.service.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/video-classroom-error-handler.service.ts`
- Methods: `getHeaders`, `reportVideoClassroomCrash`

### `frontend/src/app/services/tour.service.ts`
- Methods: `startEconomyTour`

### `frontend/src/app/services/media-upload.service.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/services/soundboard.service.ts`
- Methods: `getSounds`, `playSound`

### `frontend/src/app/services/moments.store.ts`
- Methods: `getHeaders`, `loadFeed`, `createMoment`, `toggleLike`, `loadComments`, `addComment`, `togglePin`

### `frontend/src/app/services/gift-animation.service.ts`
- Methods: `playAnimation`, `dismiss`, `cancelParticles`, `cleanup`

### `frontend/src/app/services/i18n.service.ts`
- Methods: `initLanguageFromStorage`, `applyDocumentRtlAndLocale`, `setLanguage`, `translate`

### `frontend/src/app/services/profile-visits.service.ts`
- Methods: `getHeaders`, `getMyVisitors`, `recordVisit`

### `frontend/src/app/services/user-interests.service.ts`
- Methods: `getUserTags`, `updateUserTags`, `getVocabulary`

### `frontend/src/app/services/feed.service.ts`
- Methods: `getHeaders`, `getFeed`, `getMomentById`, `createMoment`, `deleteMoment`, `likeMoment`, `unlikeMoment`, `getComments`, `addComment`

### `frontend/src/app/chat/threaded-reply/threaded-reply.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/chat/context-menu/chat-context-menu.component.ts`
- Methods: `close`, `handleAction`

### `frontend/src/app/chat/sticker-picker/sticker-picker.component.ts`
- Methods: `closeDrawer`, `onSelect`

### `frontend/src/app/chat/wallpaper-picker/wallpaper-picker.component.ts`
- Methods: `open`, `close`, `select`, `applyCustomUrl`

### `frontend/src/app/interfaces/profile-visit.interface.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/guards/admin.guard.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pipes/sanitise-html.pipe.ts`
- Methods: `transform`

### `frontend/src/app/directives/focus-trap.directive.ts`
- Methods: `trapFocus`, `restoreFocus`, `getFocusableElements`

### `frontend/src/app/directives/admin-error-catcher.directive.ts`
- Methods: `onChildError`

### `frontend/src/app/interceptors/http-retry.interceptor.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/interceptors/retry.interceptor.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/core/auth.service.ts`
- Methods: `signIn`, `resumeSession`

### `frontend/src/app/core/models/settings.model.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/core/services/settings.service.ts`
- Methods: `loadSettings`, `updatePrivacySettings`, `updateProfileSettings`, `updateAccountSettings`

### `frontend/src/app/animations/route.animations.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/animations/premium.data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/animations/sparkle.data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/animations/float.data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/animations/confetti.data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/animations/hearts.data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/audio-rooms/audio-room.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/location-privacy-toggle.component.ts`
- Methods: `setLocationPrivacy`

### `frontend/src/app/components/user-spotlight.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/language-selector/language-selector.component.ts`
- Methods: `toggle`, `selectLanguage`, `onSearch`

### `frontend/src/app/components/incoming-call-modal/incoming-call-modal.service.ts`
- Methods: `showCall`, `dismissCall`

### `frontend/src/app/components/incoming-call-modal/index.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/incoming-call-modal/incoming-call-modal.component.ts`
- Methods: `playRingtone`, `playFallbackBeep`, `stopRingtone`, `onAccept`, `onDecline`

### `frontend/src/app/components/chat-room/chat-room.component.ts`
- Methods: `isChatEventPayload`, `unlockRoom`, `toggleLock`, `resolvePartnerLanguage`, `loadRoomDetails`, `isOwnMessage`, `loadBlockedUsers`, `ngOnDestroy`, `saveChatDrafts`, `restoreDraft`, `clearChatDrafts`, `loadMessages`, `setupRealTime`, `onWordClicked`, `onComposerInput`, `onComposerKeydown`, `selectMention`, `sendTextMessage`, `sendCorrection`, `requestCorrection`, `onDoodleSaved`, `onVoiceUploaded`, `sendSticker`, `bookmark`, `startCorrection`, `onBlockToggle`, `saveSentenceToLingq`, `transliterateMessage`, `speakMessage`, `toggleTranslation`, `onTranscribeVoice`, `onSearch`, `onSearchResultSelect`, `toggleParticipantDrawer`, `loadParticipants`, `handleHeaderAction`, `sendCorrectionFromInput`, `scrollToMessage`, `parentMessageFor`, `startReply`, `cancelReply`, `openDoodlePreview`, `renameGroup`, `addMember`, `removeMember`, `playNextVoiceNote`

### `frontend/src/app/components/account-deletion/account-deletion.component.ts`
- Methods: `requestDeletion`, `restoreAccount`, `exportData`

### `frontend/src/app/components/moment-translate/moment-translate.component.ts`
- Methods: `toggle`

### `frontend/src/app/components/doodle-pad/doodle-pad.component.ts`
- Methods: `startDrawing`, `draw`, `stopDrawing`, `clearCanvas`, `setColor`, `setBrushWidth`, `save`, `cancel`, `getPos`

### `frontend/src/app/components/visitor-logs/visitor-logs.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/visitor-logs/visitor-logs.component.ts`
- Methods: `toggleHideBlurred`

### `frontend/src/app/components/audio-intro-recorder/audio-intro-recorder.component.ts`
- Methods: `formatTime`, `startRecording`, `startTimer`, `cleanupTimer`, `stopRecording`, `uploadRecording`, `playPreview`, `ngOnDestroy`

### `frontend/src/app/components/document-viewer/document-viewer.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/cover-photo-uploader/cover-photo-uploader.component.ts`
- Methods: `onFileSelected`, `onImageLoad`, `startCropping`, `applyCrop`, `cancelCrop`, `uploadCropped`, `reset`, `onCropBoxMouseDown`, `onCropBoxTouchStart`, `onHandleMouseDown`, `onHandleTouchStart`, `resizeCropBox`, `dataUrlToBlob`

### `frontend/src/app/components/cart/cart.component.ts`
- Methods: `removeItem`, `checkout`

### `frontend/src/app/components/room-chat/room-chat.component.ts`
- Methods: `send`, `sendSubtitle`, `broadcastAICaption`

### `frontend/src/app/components/error-boundary/error-boundary.component.ts`
- Methods: `resetError`, `reportCrash`, `handleBoundaryError`

### `frontend/src/app/components/events-feed/events-feed.component.ts`
- Methods: `ngOnInit`, `onStatusChange`, `onLanguageChange`, `loadMore`

### `frontend/src/app/components/streak-celebration-overlay/streak-celebration-overlay.component.ts`
- Methods: `generatePieces`, `dismiss`

### `frontend/src/app/components/language-questions/language-questions.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/change-password/change-password.component.ts`
- Methods: `onSubmit`

### `frontend/src/app/components/chat-list/chat-list.component.ts`
- Methods: `notImplemented`, `loadLabels`, `addLabel`, `removeLabel`, `assignLabelToRoom`, `removeLabelFromRoom`, `onFilterSelect`, `ngOnInit`, `loadPreviews`, `toggleLockedFolder`, `isRoomLocked`, `toggleRoomLock`, `toPreview`, `getFlagEmoji`, `toMessagePreview`

### `frontend/src/app/components/media-attachments/media-attachments.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/daily-login-modal/daily-login-modal.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/voip-active-call/voip-active-call.component.ts`
- Methods: `toggleMute`, `toggleSpeaker`, `formattedDuration`

### `frontend/src/app/components/tip-host-modal/tip-host-modal.component.ts`
- Methods: `selectAmount`, `onCustomAmountChange`, `onBackdropClick`, `confirmSend`

### `frontend/src/app/components/video-call/video-call.component.ts`
- Methods: `ngOnInit`, `ngOnDestroy`, `onTrackSubscribed`, `onTrackUnsubscribed`, `onLocalTrackPublished`, `onLocalTrackUnpublished`, `onParticipantDisconnected`, `onDisconnected`, `toggleAudio`, `toggleVideo`, `toggleScreenShare`, `endCall`, `togglePip`, `cleanup`

### `frontend/src/app/components/link-preview-card/link-preview-card.component.ts`
- Methods: `onImageError`

### `frontend/src/app/components/events-calendar/events-calendar.component.ts`
- Methods: `isToday`, `formatEventTime`, `selectDate`, `previousMonth`, `nextMonth`

### `frontend/src/app/components/notification-customization/notification-customization.component.ts`
- Methods: `onToneChange`, `onVibrationChange`, `save`

### `frontend/src/app/components/reset-password/reset-password.component.ts`
- Methods: `onSubmit`

### `frontend/src/app/components/profile-edit/profile-edit.component.ts`
- Methods: `onFileSelected`, `onSaveCroppedCover`, `saveProfile`

### `frontend/src/app/components/age-range-slider/age-range-slider.component.ts`
- Methods: `emitRange`, `onMinChange`, `onMaxChange`

### `frontend/src/app/components/chat-message/chat-message.component.ts`
- Methods: `isOwnMessage`, `playVoice`, `fetchTranscription`, `simplifyText`, `onCopy`, `onFavourite`, `onBlockToggle`, `onReport`

### `frontend/src/app/components/active-call/active-call.component.ts`
- Methods: `onToggleMute`, `onToggleSpeaker`, `onEndCall`, `ngOnDestroy`

### `frontend/src/app/components/restore-purchases-button/restore-purchases-button.component.ts`
- Methods: `onRestore`

### `frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts`
- Methods: `handleBan`, `handleWarn`

### `frontend/src/app/components/moments-feed/moments-feed.component.ts`
- Methods: `addMutedWord`, `removeMutedWord`, `onTargetLanguageSelected`, `getLanguageDisplayName`, `getLanguageFlag`, `getTargetLanguageTitle`, `setFilter`, `addTempImageUrl`, `removeMedia`, `onVoiceUploaded`, `submitMoment`, `onWordClicked`, `toggleInlineTranslation`, `saveMomentSentenceToLingq`, `toggleComments`, `startReply`, `cancelReply`, `submitComment`, `isMomentLong`, `getMomentDisplayText`, `toggleMomentExpansion`, `onCommentInput`, `onCommentKeydown`, `selectMention`, `openGhostCorrection`, `quoteTextToComment`, `onCorrectionModalSubmitted`, `copyMomentText`, `openLikedBy`, `closeLikedBy`, `openLightbox`, `closeLightbox`, `saveMomentDraft`, `restoreMomentDraft`

### `frontend/src/app/components/subscription-success/subscription-success.component.ts`
- Methods: `goToDashboard`

### `frontend/src/app/components/quick-replies/quick-replies.component.ts`
- Methods: `onSelect`

### `frontend/src/app/components/host-dashboard/host-dashboard.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts`
- Methods: `submitAssessment`

### `frontend/src/app/components/tokenised-text/tokenised-text.component.ts`
- Methods: `onTokenClick`

### `frontend/src/app/components/create-event-modal/create-event-modal.component.ts`
- Methods: `onTitleChange`, `onDatetimeChange`, `onLocationChange`, `onDescriptionChange`, `submit`

### `frontend/src/app/components/settings/settings.component.ts`
- Methods: `ngOnInit`, `goBack`, `goToMySubscription`, `toggleInterest`, `removeInterest`, `toggleGenderFilter`, `toggleLanguageFilter`, `toggleSoundEffects`, `toggleVibration`, `updateAutoDownloadMode`, `saveSettings`, `clearCache`, `deleteOldMedia`, `downloadData`, `openVersionCheck`

### `frontend/src/app/components/private-party-create-modal/private-party-create-modal.component.ts`
- Methods: `ngOnInit`, `getFriendById`, `toggleFriend`, `closeModal`, `submit`, `resetForm`

### `frontend/src/app/components/daily-learning-tip/daily-learning-tip.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/admin-portal/admin-portal.component.ts`
- Methods: `loadUsers`, `onSearchInput`, `runSearch`, `goToPage`, `toggleVip`, `onLoginHistoryToggle`, `displayNameFor`, `handleWarn`, `handleBan`

### `frontend/src/app/components/topic-following/topic-following.ts`
- Methods: `toggleFollow`

### `frontend/src/app/components/word-definition-modal/word-definition-modal.component.ts`
- Methods: `handleRetry`, `fetchDefinition`, `playAudio`, `setLevel`, `close`, `handleError`

### `frontend/src/app/components/subscription-cancel/subscription-cancel.component.ts`
- Methods: `goBack`

### `frontend/src/app/components/soundboard/soundboard.component.ts`
- Methods: `playSound`, `playRemoteSound`

### `frontend/src/app/components/my-stats/my-stats.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/version-check/version-check.component.ts`
- Methods: `ngOnInit`, `checkUpdate`

### `frontend/src/app/components/audio-player/audio-player.component.ts`
- Methods: `togglePlay`, `onTimeUpdate`, `onLoadedMetadata`, `onEnded`, `onSeek`, `formatTime`, `extractPeaks`, `generateFallbackPeaks`

### `frontend/src/app/components/classrooms-marketplace/classrooms-marketplace.ts`
- Methods: `ngOnInit`, `loadRooms`, `subscribeToUpdates`, `selectLanguage`, `createClassroom`, `joinRoom`, `getHeaders`, `startOnboardingTour`

### `frontend/src/app/components/coins-cancel/coins-cancel.component.ts`
- Methods: `goBack`

### `frontend/src/app/components/virtual-gift-modal/virtual-gift-modal.component.ts`
- Methods: `ensureDataLoaded`, `toggleCoinPackages`, `buyCoins`, `selectGift`, `confirmSend`

### `frontend/src/app/components/admin-error-boundary/admin-error-boundary.component.ts`
- Methods: `handleError`, `retry`, `goHome`, `toggleDetails`, `buildCrashContext`

### `frontend/src/app/components/language-parties/language-parties.component.ts`
- Methods: `openCreateModal`, `closeCreateModal`, `onCreateParty`, `joinParty`, `clearFilters`

### `frontend/src/app/components/language-parties/language-party-create-modal.component.ts`
- Methods: `closeModal`, `submit`, `resetForm`

### `frontend/src/app/components/text-to-speech/text-to-speech.component.ts`
- Methods: `toggleSpeech`

### `frontend/src/app/components/onboarding/onboarding-wizard.component.ts`
- Methods: `onNativeLanguageChange`, `onDisplayNameInput`, `onQuizComplete`, `handleNext`

### `frontend/src/app/components/profile-discovery-card/profile-discovery-card.component.ts`
- Methods: `toggleTranslation`

### `frontend/src/app/components/lesson-manager/lesson-manager.component.ts`
- Methods: `refresh`, `startCreate`, `startEdit`, `cancelEdit`, `save`, `delete`, `getFile`, `onCoverFileSelected`, `onAudioFileSelected`

### `frontend/src/app/components/chat-backup/chat-backup.component.ts`
- Methods: `onExport`, `onFileSelected`

### `frontend/src/app/components/split-screen-video/split-screen-video.component.ts`
- Methods: `onInviteClick`, `onRetryClick`

### `frontend/src/app/components/flashcard-deck/flashcard-deck.component.ts`
- Methods: `sanitiseDeck`, `handleRetry`, `reportDeckError`, `loadDecks`, `toggleCreateForm`, `createDeck`, `openDeckDetail`, `loadDeckDetail`, `addCardToDeck`, `removeCardFromDeck`, `deleteDeckById`, `startDeckReview`, `toggleEditForm`, `saveDeckEdits`

### `frontend/src/app/components/chat-system-bubble/chat-system-bubble.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/pronunciation-feedback/pronunciation-feedback.component.ts`
- Methods: `startRecording`, `stopRecording`, `sendForAnalysis`

### `frontend/src/app/components/live-chat-overlay/live-chat-overlay.component.ts`
- Methods: `ngOnInit`, `addMessage`, `scrollToBottom`

### `frontend/src/app/components/long-press-context-menu/long-press-context-menu.component.ts`
- Methods: `onTouchStart`, `onTouchEnd`, `onTouchCancel`, `onMouseDown`, `onMouseUp`, `onMouseCancel`, `startTimer`, `cancelTimer`, `closeMenu`, `doReply`, `doCopy`, `doFavourite`, `doReport`, `doTranslate`, `doTransliterate`, `doSpeak`, `doCorrect`, `doRequestCorrection`, `doBlockToggle`

### `frontend/src/app/components/long-press-context-menu/index.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/voip-call/voip-call.component.ts`
- Methods: `acceptCall`, `rejectCall`, `endCall`, `toggleMute`, `toggleVideo`, `startDurationTimer`, `stopDurationTimer`, `cleanup`, `ngOnDestroy`

### `frontend/src/app/components/voip-call/index.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/theme-selector/theme-selector.component.ts`
- Methods: `setTheme`

### `frontend/src/app/components/sticker-picker/sticker-picker.component.ts`
- Methods: `getPackStickers`, `onSelectSticker`

### `frontend/src/app/components/milestone/milestone.component.ts`
- Methods: `addMilestone`, `complete`, `remove`

### `frontend/src/app/components/profile-visitors/profile-visitors.component.ts`
- Methods: `onUpgradeClick`

### `frontend/src/app/components/vocabulary-display/vocabulary-display.component.ts`
- Methods: `handleRetry`, `refreshVocabulary`, `getTagIcon`, `addToFlashcards`, `handleError`

### `frontend/src/app/components/emoji-picker/emoji-picker.component.ts`
- Methods: `selectEmoji`

### `frontend/src/app/components/forced-update-modal/forced-update-modal.component.ts`
- Methods: `ngOnInit`, `ngOnDestroy`, `onDocumentClick`, `preventScroll`, `blockEvent`, `onKeydown`

### `frontend/src/app/components/incoming-call/incoming-call.component.ts`
- Methods: `playRingtone`, `playFallbackRingtone`, `stopRingtone`, `acceptCall`, `rejectCall`, `ngOnDestroy`

### `frontend/src/app/components/create-group/create-group.component.ts`
- Methods: `searchUsers`, `addMember`, `removeMember`, `createGroup`

### `frontend/src/app/components/gift-animation-overlay/gift-animation-overlay.component.ts`
- Methods: `loadLottieAnimation`, `destroyLottie`

### `frontend/src/app/components/sticker-store/sticker-store.component.ts`
- Methods: `getPackIllustration`, `getPackColour`, `purchasePack`

### `frontend/src/app/components/profile/profile.component.ts`
- Methods: `ngOnInit`, `loadProfile`, `loadVisitors`, `checkMilestone`, `sanitizePrivacyVisibility`, `toggleEdit`, `onVisibilityChange`, `onIncognitoVisitsChange`, `onAvatarFileSelected`, `onCustomAvatarFileSelected`, `onAvatarClick`, `saveProfile`, `onAudioIntroSaved`, `blockProfile`, `unblockProfile`, `reportUser`, `onCoverUploaded`, `getLanguageName`, `getLanguageFlagIcon`, `addNativeLanguage`, `removeNativeLanguage`, `addTargetLanguage`, `removeTargetLanguage`, `addCatalogItem`, `removeCatalogItem`, `updateCatalogItem`

### `frontend/src/app/components/chat-view/chat-view.component.ts`
- Methods: `ngOnInit`, `onMessageTextChange`, `onMessageBlocked`, `sendTextMessage`

### `frontend/src/app/components/profile-interests/profile-interests.component.ts`
- Methods: `toggle`

### `frontend/src/app/components/coin-economy-dashboard/coin-economy-dashboard.component.ts`
- Methods: `ngAfterViewInit`, `getTransactionTypeLabel`, `maybeStartTour`, `claimDailyReward`, `startTour`

### `frontend/src/app/components/liked-by-modal/liked-by-modal.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/developer-dashboard/developer-dashboard.component.ts`
- Methods: `setTab`, `upgrade`, `generateKey`, `runPostGisSearch`, `toggleCentrifugo`, `simulateRedisTimelineFanout`, `simulateStageHandRaise`, `simulateStageDemote`, `toggleRecordingArchive`

### `frontend/src/app/components/moderation-queue/moderation-queue.component.ts`
- Methods: `setTab`, `approveItem`, `rejectItem`, `refreshItems`, `itemsForTab`

### `frontend/src/app/components/forgot-password/forgot-password.component.ts`
- Methods: `sendResetRequest`, `doPasswordReset`

### `frontend/src/app/components/report-user-modal/report-button.component.ts`
- Methods: `openReportModal`

### `frontend/src/app/components/report-user-modal/report-user-modal.service.ts`
- Methods: `registerModal`, `open`

### `frontend/src/app/components/report-user-modal/report-user-modal.component.ts`
- Methods: `open`, `categoryLabel`, `categoryDescription`, `loadCategories`, `cancel`, `submitReport`

### `frontend/src/app/components/confirm-dialog/confirm-dialog.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/voiceroom-notes/voiceroom-notes.component.ts`
- Methods: `onContentInput`, `onVocabularyInput`, `addNote`, `deleteNote`

### `frontend/src/app/components/audio-room/quick-poll-display.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/audio-room/approve-speaker-modal.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/audio-room/quick-poll-form.component.ts`
- Methods: `addOption`, `removeOption`, `submit`

### `frontend/src/app/components/audio-room/audio-room.component.ts`
- Methods: `ngOnInit`, `selectLanguageGroup`, `toggleViewMode`, `selectExclusiveEmoji`, `createRoom`, `createPrivateParty`, `join`, `leave`, `raiseHand`, `approve`, `handleApproveSpeaker`, `demote`, `mute`, `kick`, `archive`, `openPollForm`, `closePollForm`, `submitPollForm`, `sendExclusiveReaction`, `viewPollResults`, `voteInPoll`

### `frontend/src/app/components/quests/quests.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/video-room/video-room.component.ts`
- Methods: `attach`, `selectCoHost`, `removeCoHost`, `startOnboardingTour`

### `frontend/src/app/components/gdpr/gdpr.component.ts`
- Methods: `goBack`, `requestArchive`, `deleteAccount`, `cancelDeletion`

### `frontend/src/app/components/hobby-tags/hobby-tags.component.ts`
- Methods: `isTagAdded`, `addTag`, `removeTag`, `createGlobalTag`, `updateProficiency`, `getTagName`, `getCurrentProficiency`, `getProficiencyLabel`

### `frontend/src/app/components/suggest-flashcards/suggest-flashcards.component.ts`
- Methods: `handleRetry`, `manualSuggest`, `handleError`

### `frontend/src/app/components/external-profile/external-profile.component.ts`
- Methods: `follow`, `unfollow`, `sendMessage`

### `frontend/src/app/components/trust-safety-modal/trust-safety-modal.component.ts`
- Methods: `focusInitialElement`, `switchTab`, `onTabKeydown`, `onKeydown`, `submitReport`, `confirmBlock`

### `frontend/src/app/components/avatar-upload/avatar-upload.component.ts`
- Methods: `onFileSelected`, `onImageLoad`, `onImageMouseDown`, `onImageMouseMove`, `onImageMouseUp`, `confirmCrop`

### `frontend/src/app/components/audio-recorder/audio-recorder.component.ts`
- Methods: `startRecording`, `stopRecording`, `discardRecording`, `uploadRecording`, `stopTimer`, `ngOnDestroy`

### `frontend/src/app/components/device-transfer/device-transfer.component.ts`
- Methods: `copyLink`

### `frontend/src/app/components/audio-stage/audio-stage.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/srs-error-boundary/srs-error-boundary.component.ts`
- Methods: `captureError`, `resetError`, `reportCrash`, `reportErrorInternal`

### `frontend/src/app/components/study-buddy/study-buddy.component.ts`
- Methods: `requestBuddy`, `accept`, `decline`

### `frontend/src/app/components/coins-success/coins-success.component.ts`
- Methods: `goToDashboard`

### `frontend/src/app/components/social-login-buttons/social-login-buttons.component.ts`
- Methods: `loginWith`

### `frontend/src/app/components/chat-search/chat-search.component.ts`
- Methods: `onSearch`, `selectMessage`

### `frontend/src/app/components/device-lock/device-lock.component.ts`
- Methods: `unlock`

### `frontend/src/app/components/gift-picker/gift-picker.component.ts`
- Methods: `toggleCoinPackages`, `buyCoins`, `selectGift`, `confirmSend`

### `frontend/src/app/components/message-context-menu/message-context-menu.component.ts`
- Methods: `close`, `onCopy`, `onFavourite`, `onReport`

### `frontend/src/app/components/group-participant-drawer/group-participant-drawer.component.ts`
- Methods: `close`

### `frontend/src/app/components/reading-engine/reading-engine.component.ts`
- Methods: `setTab`, `onTabKeydown`, `selectArticle`, `backToList`, `setFilter`, `setTopicFilter`, `clearFilters`, `retryLoad`, `loadReadingHistory`, `formatReadDate`

### `frontend/src/app/components/study-streak-widget/study-streak-widget.component.ts`
- Methods: `checkIn`

### `frontend/src/app/components/business-profile/business-profile.component.ts`
- Methods: `addItem`, `removeItem`, `updateCatalogItem`, `onBusinessNameInput`, `onBusinessHoursInput`, `onWebsiteInput`, `onCatalogNameInput`, `onCatalogDescriptionInput`, `onCatalogPriceInput`, `onCatalogImageInput`, `save`

### `frontend/src/app/components/user-detail/user-detail.component.ts`
- Methods: `goBack`, `loadProfile`, `toggleTranslation`, `toggleFollow`, `toggleLike`, `playAudioIntro`

### `frontend/src/app/components/font-scale-slider/font-scale-slider.component.ts`
- Methods: `onInput`

### `frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/communities/communities.component.ts`
- Methods: `create`, `delete`

### `frontend/src/app/components/admin-actions/admin-actions.component.ts`
- Methods: `ban`, `warn`

### `frontend/src/app/components/cultural-tip/cultural-tip.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/earned-badges/earned-badges.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/share-modal/share-modal.ts`
- Methods: `copyLink`, `shareToFeed`, `shareToDirectMessage`

### `frontend/src/app/components/celebration-overlay/celebration-overlay.component.ts`
- Methods: `ngOnDestroy`, `startAnimation`, `dismiss`, `cancelPendingWork`

### `frontend/src/app/components/notifications-inbox/notifications-inbox.component.ts`
- Methods: `goBack`, `setTab`, `markAllAsRead`, `onNotificationClick`, `getBadgeIcon`, `getNotificationMessageKey`

### `frontend/src/app/components/leaderboard/leaderboard.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/subscription-plans/subscription-plans.component.ts`
- Methods: `getPlanCardClass`, `getDisplayPrice`, `onSelectPlan`

### `frontend/src/app/components/word-of-the-day/word-of-the-day.component.ts`
- Methods: `getFallbackWord`

### `frontend/src/app/components/audio-sync-reader/audio-sync-reader.component.ts`
- Methods: `parseTokens`, `togglePlay`, `playHtml5Audio`, `playSpeechSynthesis`, `stopPlayback`, `isTokenActive`, `getWordClass`, `onTokenClick`, `ngOnDestroy`

### `frontend/src/app/components/lightbox/lightbox.component.ts`
- Methods: `handleKeyDown`, `next`, `prev`, `goTo`, `onTouchStart`, `onTouchEnd`

### `frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts`
- Methods: `getReactionEntries`, `toggleReaction`

### `frontend/src/app/components/desktop-sidebar/desktop-sidebar.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/legal-document-viewer/legal-document-viewer.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/voiceroom-create-modal/voiceroom-create-modal.component.ts`
- Methods: `closeModal`, `submit`, `resetForm`

### `frontend/src/app/components/follow-list/follow-list.component.ts`
- Methods: `goBack`, `canToggleFollow`, `isPending`, `toggleFollow`

### `frontend/src/app/components/resource-library/resource-library.component.ts`
- Methods: `ngOnInit`, `applyFilter`, `onSubmit`, `onEdit`, `onDelete`, `resetForm`

### `frontend/src/app/components/primitives/a11y-clickable.ts`
- Methods: `onEnter`, `onSpace`

### `frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/typing-indicator/typing-indicator.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/button-primary/button-primary.component.ts`
- Methods: `onClick`

### `frontend/src/app/components/primitives/button/button.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/skeleton-loader/skeleton-loader.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/chip/chip.component.ts`
- Methods: `onClick`, `onClickKey`, `onRemove`

### `frontend/src/app/components/primitives/empty-state/empty-state.component.ts`
- Methods: `onAction`

### `frontend/src/app/components/primitives/language-picker/language-picker.component.ts`
- Methods: `openModal`, `closeModal`, `selectLanguage`, `onSearchInput`

### `frontend/src/app/components/primitives/card/card.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/textarea/textarea.component.ts`
- Methods: `onInput`, `onBlur`, `onFocus`

### `frontend/src/app/components/primitives/no-network-banner/no-network-banner.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/fluency-indicator/fluency-indicator.component.ts`
- Methods: `getFlag`

### `frontend/src/app/components/primitives/pill/pill.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/toast/toast.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/toast/toast.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/primitives/button-secondary/button-secondary.component.ts`
- Methods: `onClick`

### `frontend/src/app/components/primitives/input/input.component.ts`
- Methods: `onInput`, `onBlur`, `onFocus`

### `frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts`
- Methods: `onClick`

### `frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts`
- Methods: `getAnimation`, `loadAnimation`, `destroyAnimation`

### `frontend/src/app/components/app-language-selector/app-language-selector.component.ts`
- Methods: `toggleModal`, `closeModal`, `selectLanguage`

### `frontend/src/app/components/streak-counter/streak-counter.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/voice-recorder/voice-recorder.component.ts`
- Methods: `startRecording`, `stopRecording`, `uploadAndSend`, `cancel`, `formatDuration`, `ngOnDestroy`

### `frontend/src/app/components/streak-congratulations/streak-congratulations.component.ts`
- Methods: `startConfetti`, `onOverlayKeydown`, `onOverlayClick`

### `frontend/src/app/components/visual-diff/visual-diff.component.ts`
- Methods: `while`

### `frontend/src/app/components/moderation/moderation-panel.component.ts`
- Methods: `filterByType`, `approve`, `reject`, `analyseUserProfile`

### `frontend/src/app/components/vocabulary-dashboard/vocabulary-dashboard.component.ts`
- Methods: `handleRetry`, `flipCard`, `grade`, `restart`, `handleComponentError`

### `frontend/src/app/components/vocabulary-dashboard/vocab-mock-data.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/correction-modal/correction-modal.component.ts`
- Methods: `ngOnInit`, `onOriginalClick`, `submitCorrection`, `closeModal`

### `frontend/src/app/components/cover-photo-cropper/cover-photo-cropper.component.ts`
- Methods: `onImageCropped`, `onLoadImageFailed`, `save`

### `frontend/src/app/components/notification-preferences/notification-preferences.component.ts`
- Methods: `categoryPref`, `channelEnabled`, `categoryLabel`, `channelLabel`, `toggle`, `toggleDnd`, `reset`, `save`

### `frontend/src/app/components/diagnostic-quiz/diagnostic-quiz.component.ts`
- Methods: `reloadQuestions`, `selectOption`, `next`, `previous`

### `frontend/src/app/components/password-policy-reset/password-policy-reset.component.ts`
- Methods: `onCurrentPasswordChange`, `onNewPasswordChange`, `onConfirmPasswordChange`, `resetPassword`

### `frontend/src/app/components/discovery/discovery-skeleton-card.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/discovery/discovery.component.ts`
- Methods: `setSort`, `onAgeRangeChanged`, `onDistanceChanged`, `onFilterSelect`, `setLanguage`, `setGender`, `ngOnInit`, `searchPartners`, `scheduleSearch`, `retrySearch`, `toggleVoiceRoomActive`, `toggleSeriousLearnerMode`, `formatDistanceHelper`, `toggleAudioIntro`, `stopAudioIntro`, `getActiveStatus`, `ngOnDestroy`, `onGlobalSearch`, `resetFilters`, `startMatchmakingTour`, `isMatchmakingTourActive`, `closeMatchmakingTour`

### `frontend/src/app/components/discovery/discovery-map-error-boundary.component.ts`
- Methods: `captureError`, `resetError`, `reportCrash`

### `frontend/src/app/components/discovery/global-search/global-search.component.ts`
- Methods: `applyFilters`

### `frontend/src/app/components/video-classroom-error-boundary/video-classroom-error-boundary.component.ts`
- Methods: `captureError`, `resetError`, `reportCrash`, `reportErrorInternal`

### `frontend/src/app/components/favourites/favourites.component.ts`
- Methods: `loadFavourites`, `setTab`, `deleteFavourite`, `toggleAudio`, `stopAudio`, `isChatMessage`, `getPayloadMessage`

### `frontend/src/app/components/escrow-payments/escrow-payments.component.ts`
- Methods: `handleRelease`, `handleRefund`, `handleDispute`, `handleSync`, `startOnboardingTour`, `setStatusFilter`, `statusBadgeClass`, `goBack`, `maybeStartTour`

### `frontend/src/app/components/shop/shop.component.ts`
- Methods: `addToCart`

### `frontend/src/app/components/study-streak-counter/study-streak-counter.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/components/groups-discovery/groups-discovery.component.ts`
- Methods: `joinGroup`

### `frontend/src/app/components/flashcard-review/flashcard-review.component.ts`
- Methods: `handleRetry`, `flipCard`, `gradeReview`, `restart`, `playAudio`, `computeNewLevel`

### `frontend/src/app/components/profile-cover-photo/profile-cover-photo.component.ts`
- Methods: `onFileSelected`, `cancel`

### `frontend/src/app/moderation/moderation-dashboard.component.ts`
- Methods: `approve`, `reject`, `analyse`

### `frontend/src/app/moderation/moderation.routes.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/moderation/moderation-queue.component.ts`
- Methods: `setType`, `setStatus`, `approve`, `reject`, `analyse`, `reportCrash`

### `frontend/src/app/features/settings/components/profile-settings/profile-settings.component.ts`
- Methods: `ngOnInit`, `while`, `addTargetLanguage`, `removeTargetLanguage`, `onDistanceChange`, `persist`

### `frontend/src/app/features/settings/components/privacy-settings/privacy-settings.component.ts`
- Methods: `setVisibility`, `toggleAllowDm`, `setImageFilter`, `persist`

### `frontend/src/app/discovery/audio-intro-feed/audio-intro-feed.component.ts`
- Methods: `togglePlay`

### `frontend/src/app/events/create-event-modal/create-event-modal.component.ts`
- Methods: `onSubmit`

### `frontend/src/app/pages/help-centre/help-centre.component.ts`
- Methods: `updateSearch`, `updateCategory`, `nextPage`, `prevPage`

### `frontend/src/app/pages/escrow/escrow.component.ts`
- Methods: `getStatusCount`, `startOnboardingTour`, `onFilterChange`, `reload`, `goBack`

### `frontend/src/app/pages/chat-settings/chat-settings.component.ts`
- Methods: `toggleAutoTranslate`, `toggleReadReceipts`, `toggleEnterToSend`, `resetToDefaults`

### `frontend/src/app/pages/support-centre/support-centre.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/language-settings/language-settings.component.ts`
- Methods: `setTargetSearchQuery`, `setNativeSearchQuery`, `selectUiLang`, `getFlagForCode`, `getLanguageName`, `toggleTargetPicker`, `toggleNativePicker`, `addTargetLanguage`, `removeTargetLanguage`, `addNativeLanguage`, `removeNativeLanguage`, `saveChanges`, `discardChanges`, `goBack`

### `frontend/src/app/pages/settings/backup-restore.component.ts`
- Methods: `onRoomChange`, `exportChat`, `onFileSelected`, `importChat`

### `frontend/src/app/pages/settings/account/account.component.ts`
- Methods: `ngOnInit`, `passwordMatchValidator`, `updateTwoFactorSetting`, `changePassword`, `terminateSession`

### `frontend/src/app/pages/settings/linked-accounts/linked-accounts.component.ts`
- Methods: `isLinked`, `getLinkedAccount`, `canUnlink`, `link`, `unlink`, `goBack`

### `frontend/src/app/pages/settings/message-filter-settings/message-filter-settings.component.ts`
- Methods: `ngOnInit`, `toggleLanguage`, `toggleGender`, `saveFilters`, `getLanguageName`, `goBack`

### `frontend/src/app/pages/settings/privacy-settings/privacy-settings.component.ts`
- Methods: `saveSettings`, `requestArchive`, `downloadMyData`, `goBack`

### `frontend/src/app/pages/settings/appearance-settings/appearance-settings.component.ts`
- Methods: `setTheme`, `setAccentColor`, `onCustomColorChange`, `saveSettings`, `changeUiLanguage`, `onLanguageSelect`, `goBack`

### `frontend/src/app/pages/settings/notification-settings/notification-settings.component.ts`
- Methods: `toggleValue`, `channelLabel`, `toggle`

### `frontend/src/app/pages/subscription/subscription-page.component.ts`
- Methods: `loadPlans`, `subscribe`

### `frontend/src/app/pages/legal/terms.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/legal/privacy.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/join-group/join-group.component.ts`
- Methods: `join`

### `frontend/src/app/pages/home/home.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/my-subscription/my-subscription.component.ts`
- Methods: `formatDate`, `reload`, `goBack`

### `frontend/src/app/pages/admin/admin-blocks.component.ts`
- Methods: `retry`, `changePage`, `removeBlock`, `reportCrash`

### `frontend/src/app/pages/admin/admin-users.component.ts`
- Methods: `onSearchInput`, `changePage`, `toggleVip`, `openHistory`, `closeHistory`, `banUser`, `warnUser`, `reportCrash`

### `frontend/src/app/pages/admin/blocks/admin-blocks.component.ts`
- Methods: `isUnblocking`, `onUnblock`, `onRetry`, `reportCrash`

### `frontend/src/app/pages/call-logs/call-logs.component.ts`
- Methods: `onFilterChange`

### `frontend/src/app/pages/lessons/lessons.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/lessons/lessons.model.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/chat/ai-conversation.service.ts`
- Methods: `getScenarios`, `sendMessage`

### `frontend/src/app/pages/chat/chat-page.component.ts`
- Methods: `ngOnInit`, `selectRoom`, `handleCentrifugoEvent`, `exportChat`, `sendMessage`, `openCorrection`, `cancelCorrection`, `openFix`, `cancelFix`, `submitFix`, `submitCorrection`, `requestCorrection`, `viewMedia`, `replyToStatus`, `startAiPartner`, `closeAiPartner`, `selectAiScenario`, `sendAiMessage`

### `frontend/src/app/pages/vip-subscription/vip-subscription.component.ts`
- Methods: `loadPlans`, `getPriceDisplay`, `getPlanIcon`, `getFeatureCategories`, `scrollToPlans`, `onSubscribe`

### `frontend/src/app/pages/communities/communities.component.ts`
- Methods: `createCommunity`, `selectCommunity`

### `frontend/src/app/pages/message-filter-settings/message-filter-settings.component.ts`
- Methods: `ngOnInit`, `toggleGender`, `toggleNativeLanguage`, `clearAgeFilters`, `clearAllFilters`, `coerceNumber`

### `frontend/src/app/pages/escrow-detail/escrow-detail.component.ts`
- Methods: `formatDate`, `reload`, `goBack`

### `frontend/src/app/pages/vip/vip.component.ts`
- Methods: `scrollToPlans`, `onStartFree`, `onContinueFree`, `onSubscribe`, `toggleFaq`

### `frontend/src/app/pages/help-about/help-about.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/data-storage/data-storage.component.ts`
- Methods: `computeCacheSize`, `clearCache`, `deleteOldMedia`, `toggleCellular`, `goBack`

### `frontend/src/app/pages/voiceroom-preview/voiceroom-preview.component.ts`
- Methods: `applyMeta`

### `frontend/src/app/pages/language-islands/language-islands.component.ts`
- *(No methods found or interface/type definition)*

### `frontend/src/app/pages/block-management/block-management.component.ts`
- Methods: `hasTargetLanguages`, `getTargetLanguagesText`, `onUnblock`, `retryLoad`

