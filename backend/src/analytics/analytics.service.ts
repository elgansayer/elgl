import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ClientErrorDto,
  ClientErrorStackFrameDto,
} from './dto/client-error.dto';

const BEARER_TOKEN_RE = /\bBearer\s+[^\s,;]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SECRET_PARAM_RE =
  /\b(authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|password)=([^\s&#]+)/gi;

function sanitiseText(value: string, maxLength: number): string {
  return value
    .replace(BEARER_TOKEN_RE, 'Bearer [redacted]')
    .replace(JWT_RE, '[redacted-jwt]')
    .replace(SECRET_PARAM_RE, '$1=[redacted]')
    .slice(0, maxLength);
}

function sanitiseUrl(value?: string): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.origin}${parsed.pathname}`.slice(0, 2048);
  } catch {
    return null;
  }
}

function sanitiseMetadata(
  metadata?: Record<string, unknown>,
): Record<string, string | number | boolean> | null {
  if (!metadata) return null;

  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 20)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)) continue;

    if (typeof value === 'string') {
      safe[key] = sanitiseText(value, 256);
    } else if (typeof value === 'boolean') {
      safe[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

function sanitiseStackFrames(
  frames?: ClientErrorStackFrameDto[],
): ClientErrorStackFrameDto[] | null {
  if (!frames?.length) return null;

  return frames.slice(0, 20).map((frame) => ({
    fileName: frame.fileName
      ? sanitiseText(frame.fileName, 512)
      : undefined,
    functionName: frame.functionName
      ? sanitiseText(frame.functionName, 512)
      : undefined,
    source: frame.source ? sanitiseText(frame.source, 512) : undefined,
    lineNumber: frame.lineNumber,
    columnNumber: frame.columnNumber,
  }));
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordClientError(payload: ClientErrorDto): Promise<void> {
    let result: { error: { message?: string } | null };

    try {
      const supabase = this.supabaseService.getClient();
      result = await supabase.from('client_errors').insert({
        message: sanitiseText(payload.message || 'Client runtime error', 1000),
        name: sanitiseText(payload.name || 'Error', 100),
        stack: payload.stack ? sanitiseText(payload.stack, 12000) : null,
        component_stack: payload.componentStack
          ? sanitiseText(payload.componentStack, 8000)
          : null,
        url: sanitiseUrl(payload.url),
        user_agent: payload.userAgent
          ? sanitiseText(payload.userAgent, 512)
          : null,
        metadata: sanitiseMetadata(payload.metadata),
        stack_frames: sanitiseStackFrames(payload.stackFrames),
        client_timestamp: payload.timestamp ?? new Date().toISOString(),
      } as never);
    } catch {
      this.logger.warn('client_error_persist_exception');
      throw new ServiceUnavailableException(
        'Client error reporting is temporarily unavailable',
      );
    }

    if (result.error) {
      this.logger.warn('client_error_persist_failed');
      throw new ServiceUnavailableException(
        'Client error reporting is temporarily unavailable',
      );
    }
  }
}
