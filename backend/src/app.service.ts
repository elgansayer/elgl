import { BadRequestException, Injectable } from '@nestjs/common';
import { MOCK_FIXTURE_EPOCH_MS } from './mock/deterministic-fixtures';

const DEFAULT_MOCK_CLOCK_NAMESPACE = 'default';
const DEFAULT_MOCK_CLOCK_TIME_ZONE = 'UTC';
const MAX_TIME_TRAVEL_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const MOCK_CLOCK_NAMESPACE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

interface MockClockState {
  nowMs: number;
  timeZone: string;
}

export interface MockClockSnapshot {
  namespace: string;
  now: string;
  localDateTime: string;
  timeZone: string;
  utcOffsetMinutes: number;
  epoch: string;
  offsetMs: number;
}

@Injectable()
export class AppService {
  private readonly mockClocks = new Map<string, MockClockState>();

  getHello(): string {
    return 'Hey there!';
  }

  getMockClock(namespace?: string): MockClockSnapshot {
    const normalizedNamespace = this.normalizeMockClockNamespace(namespace);
    return this.snapshotMockClock(
      normalizedNamespace,
      this.getMockClockState(normalizedNamespace),
    );
  }

  freezeMockClock(
    now: string,
    namespace?: string,
    timeZone?: string,
  ): MockClockSnapshot {
    const normalizedNamespace = this.normalizeMockClockNamespace(namespace);
    const nowMs = this.parseMockClockInstant(now);
    const current = this.getMockClockState(normalizedNamespace);
    const normalizedTimeZone =
      timeZone === undefined
        ? current.timeZone
        : this.normalizeMockClockTimeZone(timeZone);

    const next = { nowMs, timeZone: normalizedTimeZone };
    this.mockClocks.set(normalizedNamespace, next);
    return this.snapshotMockClock(normalizedNamespace, next);
  }

  advanceMockClock(
    milliseconds: number,
    namespace?: string,
  ): MockClockSnapshot {
    return this.shiftMockClock(milliseconds, namespace);
  }

  rewindMockClock(milliseconds: number, namespace?: string): MockClockSnapshot {
    return this.shiftMockClock(-milliseconds, namespace);
  }

  resetMockClock(namespace?: string): MockClockSnapshot {
    const normalizedNamespace = this.normalizeMockClockNamespace(namespace);
    this.mockClocks.delete(normalizedNamespace);
    return this.snapshotMockClock(
      normalizedNamespace,
      this.getMockClockState(normalizedNamespace),
    );
  }

  private shiftMockClock(
    deltaMs: number,
    namespace?: string,
  ): MockClockSnapshot {
    const normalizedNamespace = this.normalizeMockClockNamespace(namespace);
    const absoluteDelta = Math.abs(deltaMs);
    if (!Number.isSafeInteger(deltaMs) || absoluteDelta > MAX_TIME_TRAVEL_MS) {
      throw new BadRequestException(
        'Mock clock delta must be a safe integer no greater than 10 years',
      );
    }

    const current = this.getMockClockState(normalizedNamespace);
    const nowMs = current.nowMs + deltaMs;
    if (
      !Number.isSafeInteger(nowMs) ||
      !Number.isFinite(new Date(nowMs).getTime())
    ) {
      throw new BadRequestException(
        'Mock clock result is outside the supported date range',
      );
    }

    const next = { ...current, nowMs };
    this.mockClocks.set(normalizedNamespace, next);
    return this.snapshotMockClock(normalizedNamespace, next);
  }

  private getMockClockState(namespace: string): MockClockState {
    return (
      this.mockClocks.get(namespace) ?? {
        nowMs: MOCK_FIXTURE_EPOCH_MS,
        timeZone: DEFAULT_MOCK_CLOCK_TIME_ZONE,
      }
    );
  }

  private normalizeMockClockNamespace(namespace?: string): string {
    if (namespace === undefined || namespace.trim() === '') {
      return DEFAULT_MOCK_CLOCK_NAMESPACE;
    }

    const normalized = namespace.trim();
    if (!MOCK_CLOCK_NAMESPACE_PATTERN.test(normalized)) {
      throw new BadRequestException(
        'Mock clock namespace must be 1-64 letters, digits, dots, underscores or hyphens',
      );
    }
    return normalized;
  }

  private normalizeMockClockTimeZone(timeZone: string): string {
    const normalized = timeZone.trim();
    if (normalized === '' || normalized.length > 64) {
      throw new BadRequestException(
        'Mock clock timeZone must be a valid IANA time zone',
      );
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(
        new Date(MOCK_FIXTURE_EPOCH_MS),
      );
    } catch {
      throw new BadRequestException(
        'Mock clock timeZone must be a valid IANA time zone',
      );
    }
    return normalized;
  }

  private parseMockClockInstant(now: string): number {
    if (typeof now !== 'string' || !ISO_INSTANT_PATTERN.test(now.trim())) {
      throw new BadRequestException(
        'Mock clock now must be an ISO-8601 timestamp with an explicit UTC offset',
      );
    }

    const nowMs = Date.parse(now.trim());
    if (!Number.isFinite(nowMs)) {
      throw new BadRequestException('Mock clock now must be a valid timestamp');
    }
    return nowMs;
  }

  private snapshotMockClock(
    namespace: string,
    state: MockClockState,
  ): MockClockSnapshot {
    const date = new Date(state.nowMs);
    const localParts = this.getLocalDateTimeParts(date, state.timeZone);
    const localEpochMs = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second,
    );
    const utcSecondMs = Math.floor(state.nowMs / 1000) * 1000;

    return {
      namespace,
      now: date.toISOString(),
      localDateTime: `${String(localParts.year).padStart(4, '0')}-${String(localParts.month).padStart(2, '0')}-${String(localParts.day).padStart(2, '0')}T${String(localParts.hour).padStart(2, '0')}:${String(localParts.minute).padStart(2, '0')}:${String(localParts.second).padStart(2, '0')}`,
      timeZone: state.timeZone,
      utcOffsetMinutes: Math.round((localEpochMs - utcSecondMs) / 60_000),
      epoch: new Date(MOCK_FIXTURE_EPOCH_MS).toISOString(),
      offsetMs: state.nowMs - MOCK_FIXTURE_EPOCH_MS,
    };
  }

  private getLocalDateTimeParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    };
  }
}
