import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminUserSummary {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  native_languages: string[] | null;
  target_languages: string[] | null;
  is_vip: boolean | null;
  vip_tier: string | null;
  is_admin: boolean | null;
  coins_balance: number | null;
  study_streak_days: number | null;
  last_active_at: string | null;
  created_at: string | null;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserSearchQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface AdminLoginHistoryEntry {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 120;
const MAX_USER_ID_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
const MAX_LANGUAGE_COUNT = 10;
const MAX_LANGUAGE_LENGTH = 32;
const MAX_VIP_TIER_LENGTH = 64;
const MAX_LOGIN_HISTORY_ENTRIES = 50;
const MAX_IP_ADDRESS_LENGTH = 64;
const MAX_USER_AGENT_LENGTH = 512;
const USER_DATA_UNAVAILABLE = 'Admin user data unavailable';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function nullableBoundedString(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  const stringValue = boundedString(value, maxLength);
  return stringValue === null ? undefined : stringValue;
}

function nullableBoolean(value: unknown): boolean | null | undefined {
  return value === null ? null : typeof value === 'boolean' ? value : undefined;
}

function nullableNonNegativeInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function nullableLanguageList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > MAX_LANGUAGE_COUNT) return undefined;
  if (
    value.some(
      (language) =>
        typeof language !== 'string' ||
        language.length === 0 ||
        language.length > MAX_LANGUAGE_LENGTH,
    )
  ) {
    return undefined;
  }
  return [...value];
}

function nullableHttpUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  const raw = boundedString(value, MAX_URL_LENGTH);
  if (raw === null) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? raw : undefined;
  } catch {
    return undefined;
  }
}

function nullableIsoDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  const raw = boundedString(value, 64);
  if (raw === null || Number.isNaN(Date.parse(raw))) return undefined;
  return raw;
}

function requirePositiveInteger(value: unknown, maximum?: number): number | null {
  if (!Number.isSafeInteger(value) || Number(value) < 1) return null;
  const integer = Number(value);
  return maximum === undefined || integer <= maximum ? integer : null;
}

function validateAdminUser(value: unknown): AdminUserSummary | null {
  if (!isRecord(value)) return null;

  const id = boundedString(value['id'], MAX_USER_ID_LENGTH);
  const displayName = nullableBoundedString(value['display_name'], MAX_DISPLAY_NAME_LENGTH);
  const avatarUrl = nullableHttpUrl(value['avatar_url']);
  const nativeLanguages = nullableLanguageList(value['native_languages']);
  const targetLanguages = nullableLanguageList(value['target_languages']);
  const isVip = nullableBoolean(value['is_vip']);
  const vipTier = nullableBoundedString(value['vip_tier'], MAX_VIP_TIER_LENGTH);
  const isAdmin = nullableBoolean(value['is_admin']);
  const coinsBalance = nullableNonNegativeInteger(value['coins_balance']);
  const studyStreakDays = nullableNonNegativeInteger(value['study_streak_days']);
  const lastActiveAt = nullableIsoDate(value['last_active_at']);
  const createdAt = nullableIsoDate(value['created_at']);

  if (
    !id ||
    displayName === undefined ||
    avatarUrl === undefined ||
    nativeLanguages === undefined ||
    targetLanguages === undefined ||
    isVip === undefined ||
    vipTier === undefined ||
    isAdmin === undefined ||
    coinsBalance === undefined ||
    studyStreakDays === undefined ||
    lastActiveAt === undefined ||
    createdAt === undefined
  ) {
    return null;
  }

  return {
    id,
    display_name: displayName,
    avatar_url: avatarUrl,
    native_languages: nativeLanguages,
    target_languages: targetLanguages,
    is_vip: isVip,
    vip_tier: vipTier,
    is_admin: isAdmin,
    coins_balance: coinsBalance,
    study_streak_days: studyStreakDays,
    last_active_at: lastActiveAt,
    created_at: createdAt,
  };
}

function validateUserList(value: unknown): AdminUserListResult {
  if (!isRecord(value) || !Array.isArray(value['users'])) {
    throw new Error(USER_DATA_UNAVAILABLE);
  }

  const page = requirePositiveInteger(value['page']);
  const pageSize = requirePositiveInteger(value['pageSize'], MAX_PAGE_SIZE);
  const total =
    Number.isSafeInteger(value['total']) && Number(value['total']) >= 0
      ? Number(value['total'])
      : null;

  if (
    page === null ||
    pageSize === null ||
    total === null ||
    value['users'].length > pageSize ||
    value['users'].length > MAX_PAGE_SIZE ||
    total < value['users'].length
  ) {
    throw new Error(USER_DATA_UNAVAILABLE);
  }

  const users = value['users'].map(validateAdminUser);
  if (users.some((user) => user === null)) {
    throw new Error(USER_DATA_UNAVAILABLE);
  }

  return {
    users: users as AdminUserSummary[],
    total,
    page,
    pageSize,
  };
}

function validateLoginHistory(value: unknown): AdminLoginHistoryEntry[] {
  if (!Array.isArray(value) || value.length > MAX_LOGIN_HISTORY_ENTRIES) {
    throw new Error(USER_DATA_UNAVAILABLE);
  }

  const entries = value.map((entry): AdminLoginHistoryEntry | null => {
    if (!isRecord(entry)) return null;
    const id = boundedString(entry['id'], MAX_USER_ID_LENGTH);
    const userId = boundedString(entry['user_id'], MAX_USER_ID_LENGTH);
    const ipAddress = nullableBoundedString(entry['ip_address'], MAX_IP_ADDRESS_LENGTH);
    const userAgent = nullableBoundedString(entry['user_agent'], MAX_USER_AGENT_LENGTH);
    const createdAt = boundedString(entry['created_at'], 64);
    if (
      !id ||
      !userId ||
      ipAddress === undefined ||
      userAgent === undefined ||
      !createdAt ||
      Number.isNaN(Date.parse(createdAt))
    ) {
      return null;
    }
    return {
      id,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: createdAt,
    };
  });

  if (entries.some((entry) => entry === null)) {
    throw new Error(USER_DATA_UNAVAILABLE);
  }
  return entries as AdminLoginHistoryEntry[];
}

function validateUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized || normalized.length > MAX_USER_ID_LENGTH) {
    throw new Error('Invalid admin user identifier');
  }
  return normalized;
}

function normalizePage(value: number | undefined): number {
  return requirePositiveInteger(value ?? DEFAULT_PAGE) ?? DEFAULT_PAGE;
}

function normalizePageSize(value: number | undefined): number {
  return requirePositiveInteger(value ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  search(query: AdminUserSearchQuery): Observable<AdminUserListResult> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    const page = normalizePage(query.page);
    const pageSize = normalizePageSize(query.pageSize);
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    const search = query.search?.trim();
    if (search && search.length > MAX_SEARCH_LENGTH) {
      return throwError(() => new Error('Admin user search is too long'));
    }
    if (search) {
      params = params.set('search', search);
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<unknown>(`${apiBaseUrl}/admin/v1/users`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          params,
        }),
      ),
      map(validateUserList),
      catchError(() => throwError(() => new Error(USER_DATA_UNAVAILABLE))),
    );
  }

  getUser(userId: string): Observable<AdminUserSummary> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    let normalizedUserId: string;
    try {
      normalizedUserId = validateUserId(userId);
    } catch (error) {
      return throwError(() => error);
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<unknown>(
          `${apiBaseUrl}/admin/v1/users/${encodeURIComponent(normalizedUserId)}`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        ),
      ),
      map((value) => {
        const user = validateAdminUser(value);
        if (!user) throw new Error(USER_DATA_UNAVAILABLE);
        return user;
      }),
      catchError(() => throwError(() => new Error(USER_DATA_UNAVAILABLE))),
    );
  }

  getLoginHistory(userId: string): Observable<AdminLoginHistoryEntry[]> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    let normalizedUserId: string;
    try {
      normalizedUserId = validateUserId(userId);
    } catch (error) {
      return throwError(() => error);
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<unknown>(
          `${apiBaseUrl}/admin/v1/users/${encodeURIComponent(normalizedUserId)}/login-history`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        ),
      ),
      map(validateLoginHistory),
      catchError(() => throwError(() => new Error(USER_DATA_UNAVAILABLE))),
    );
  }
}
