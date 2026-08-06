// Canonical ModerationService is @app/moderation/moderation.service.ts
// All new code should import from that location.
// Re-export for backward compatibility with existing import paths.
export {
  ModerationService,
  ModerationItem,
  ModerationAnalysis,
  ModerationActionResponse,
  UserAnalysisResult,
} from '../moderation/moderation.service';
