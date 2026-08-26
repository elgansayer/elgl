import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export type NetworkBlockScope = 'all' | 'auth' | 'write';

export interface NetworkReputation {
  network: string;
  riskLevel: 'low' | 'medium' | 'high';
  signals: string[];
  loginEvents24h: number;
  loginEvents7d: number;
  uniqueAccounts7d: number;
  latestSeenAt: string | null;
  allowlisted: boolean;
  activeBlocks: Array<{
    id: string;
    network: string;
    scope: NetworkBlockScope;
    expiresAt: string;
  }>;
}

export interface NetworkImpactPreview {
  network: string;
  scope: NetworkBlockScope;
  observedLoginEvents30d: number;
  observedAccounts30d: number;
  allowlistConflicts: string[];
}

export interface NetworkBlock {
  id: string;
  network: string;
  scope: NetworkBlockScope;
  reasonCode: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface NetworkAllowlistEntry {
  id: string;
  network: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface NetworkProviderReputation {
  asn: number;
  provider: string;
  isHostingProvider: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  signals: string[];
  requestsToday: number;
  requests7d: number;
  activeDays7d: number;
  latestSeenAt: string | null;
  allowlisted: boolean;
  activeBlocks: Array<{
    id: string;
    scope: NetworkBlockScope;
    expiresAt: string;
  }>;
}

export interface NetworkProviderImpactPreview {
  asn: number;
  provider: string;
  isHostingProvider: boolean;
  scope: NetworkBlockScope;
  observedRequests30d: number;
  observedDays30d: number;
  latestSeenAt: string | null;
  allowlisted: boolean;
}

export interface NetworkProviderBlock {
  id: string;
  asn: number;
  providerSnapshot: string | null;
  scope: NetworkBlockScope;
  reasonCode: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface NetworkProviderAllowlistEntry {
  id: string;
  asn: number;
  providerSnapshot: string | null;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminNetworkSecurityService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  lookup(ip: string): Observable<NetworkReputation> {
    return this.post<NetworkReputation>('reputation', { ip });
  }

  preview(
    cidr: string,
    scope: NetworkBlockScope,
  ): Observable<NetworkImpactPreview> {
    return this.post<NetworkImpactPreview>('impact', { cidr, scope });
  }

  listBlocks(): Observable<NetworkBlock[]> {
    return this.request<NetworkBlock[]>('GET', 'blocks');
  }

  listAllowlist(): Observable<NetworkAllowlistEntry[]> {
    return this.request<NetworkAllowlistEntry[]>('GET', 'allowlist');
  }

  createBlock(input: {
    cidr: string;
    scope: NetworkBlockScope;
    reasonCode: string;
    operatorNote?: string;
    expiresAt: string;
    idempotencyKey: string;
  }): Observable<NetworkBlock> {
    return this.post<NetworkBlock>('blocks', input);
  }

  revokeBlock(id: string): Observable<NetworkBlock> {
    return this.request<NetworkBlock>('DELETE', `blocks/${encodeURIComponent(id)}`);
  }

  createAllowlist(input: {
    cidr: string;
    reason: string;
    expiresAt?: string;
    idempotencyKey: string;
  }): Observable<NetworkAllowlistEntry> {
    return this.post<NetworkAllowlistEntry>('allowlist', input);
  }

  revokeAllowlist(id: string): Observable<NetworkAllowlistEntry> {
    return this.request<NetworkAllowlistEntry>(
      'DELETE',
      `allowlist/${encodeURIComponent(id)}`,
    );
  }

  lookupProvider(asn: number): Observable<NetworkProviderReputation> {
    return this.post<NetworkProviderReputation>('provider/reputation', { asn });
  }

  previewProvider(
    asn: number,
    scope: NetworkBlockScope,
  ): Observable<NetworkProviderImpactPreview> {
    return this.post<NetworkProviderImpactPreview>('provider/impact', {
      asn,
      scope,
    });
  }

  listProviderBlocks(): Observable<NetworkProviderBlock[]> {
    return this.request<NetworkProviderBlock[]>('GET', 'provider/blocks');
  }

  listProviderAllowlist(): Observable<NetworkProviderAllowlistEntry[]> {
    return this.request<NetworkProviderAllowlistEntry[]>(
      'GET',
      'provider/allowlist',
    );
  }

  createProviderBlock(input: {
    asn: number;
    scope: NetworkBlockScope;
    reasonCode: string;
    operatorNote?: string;
    expiresAt: string;
    idempotencyKey: string;
  }): Observable<NetworkProviderBlock> {
    return this.post<NetworkProviderBlock>('provider/blocks', input);
  }

  revokeProviderBlock(id: string): Observable<NetworkProviderBlock> {
    return this.request<NetworkProviderBlock>(
      'DELETE',
      `provider/blocks/${encodeURIComponent(id)}`,
    );
  }

  createProviderAllowlist(input: {
    asn: number;
    reason: string;
    expiresAt?: string;
    idempotencyKey: string;
  }): Observable<NetworkProviderAllowlistEntry> {
    return this.post<NetworkProviderAllowlistEntry>(
      'provider/allowlist',
      input,
    );
  }

  revokeProviderAllowlist(
    id: string,
  ): Observable<NetworkProviderAllowlistEntry> {
    return this.request<NetworkProviderAllowlistEntry>(
      'DELETE',
      `provider/allowlist/${encodeURIComponent(id)}`,
    );
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.request<T>('POST', path, body);
  }

  private request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Observable<T> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }
    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.request<T>(
          method,
          `${apiBaseUrl}/admin/v1/security/network/${path}`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
            body,
          },
        ),
      ),
    );
  }
}
