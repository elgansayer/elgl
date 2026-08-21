import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { CrashReportService, AdminCrashContext } from './crash-report.service';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class LoggingService {
  private readonly crashReportService = inject(CrashReportService);
  private readonly minLevel: LogLevel = environment.production ? LogLevel.WARN : LogLevel.DEBUG;

  debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  fatal(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.FATAL, message, context, data);
  }

  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };

    // In development, output to console with appropriate method
    if (!environment.production) {
      const prefix = context ? `[${context}]` : '';
      const args = data !== undefined ? [prefix, message, data] : [prefix, message];
      switch (level) {
        case LogLevel.DEBUG:
          // eslint-disable-next-line no-console
          console.debug(...args);
          break;
        case LogLevel.INFO:
          // eslint-disable-next-line no-console
          console.info(...args);
          break;
        case LogLevel.WARN:
          console.warn(...args);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(...args);
          break;
      }
    }

    // For ERROR and FATAL in production, forward to crash reporting
    if (level >= LogLevel.ERROR) {
      this.forwardToCrashReporting(entry);
    }
  }

  private forwardToCrashReporting(entry: LogEntry): void {
    const error = new Error(entry.message);
    error.name = entry.context ?? 'LoggingService';

    const adminContext: AdminCrashContext = {
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      component: entry.context ?? 'unknown',
      adminRole: 'user',
      action: typeof entry.data === 'string' ? entry.data : undefined,
      offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    };

    this.crashReportService.reportCrash(error, adminContext).catch(() => {
      // Last resort - crash reporting itself failed
    });
  }
}
