export interface CrashReportPayload {
  /** The escrow operation that was attempted when the crash occurred */
  operation: string;
  /** The escrow ID involved, if any */
  escrow_id?: string | null;
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

export interface CrashReport extends CrashReportPayload {
  id: string;
  /** When the crash was reported */
  created_at: string;
  /** Whether the crash has been acknowledged by an admin */
  acknowledged: boolean;
  /** ISO timestamp of when it was resolved */
  resolved_at?: string | null;
}
