export interface MatchmakingCrashReportPayload {
  /** The matchmaking operation that was attempted when the crash occurred */
  operation: string;
  /** The matchmaking tier / service that crashed */
  service_name: string;
  /** The user ID that triggered the operation */
  user_id?: string | null;
  /** The error type / class name */
  error_type: string;
  /** The error message */
  error_message: string;
  /** Stack trace, if available */
  stack_trace?: string | null;
  /** Additional contextual data */
  context?: Record<string, unknown> | null;
}

export interface MatchmakingCrashReport extends MatchmakingCrashReportPayload {
  id: string;
  /** When the crash was reported */
  created_at: string;
  /** Whether the crash has been acknowledged by an admin */
  acknowledged: boolean;
  /** ISO timestamp of when it was resolved */
  resolved_at?: string | null;
}

export interface MatchmakingErrorContext {
  operation: string;
  service_name: string;
  user_id?: string;
  params?: Record<string, unknown>;
  /** The tier that was being attempted (interest, language_exchange, active_users, mock) */
  tier?: string;
  /** Whether this was a degraded / fallback execution */
  degraded?: boolean;
  /** Reason for fallback */
  fallback_reason?: string;
  /** Latency in milliseconds */
  latency_ms?: number;
}

export interface ErrorBoundaryResult<T> {
  success: boolean;
  data?: T;
  degraded: boolean;
  fallback_reason?: string;
  /** The tier that ultimately produced the result */
  resolved_tier?: string;
  /** Whether any errors were captured during execution */
  error_captured: boolean;
}