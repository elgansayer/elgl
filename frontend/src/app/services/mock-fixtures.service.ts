import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigurationService } from '../core/config/configuration.service';

export interface MockFixtureSummary {
  users: number;
  linkedAccounts: number;
  totalRecords: number;
}

export interface MockFixtureOperationResult {
  namespace: string;
  seed: number;
  seedId: string;
  summary: MockFixtureSummary;
  operation?: 'reset' | 'reseed' | 'snapshot' | 'restore';
  checkpoint?: string;
}

@Injectable({ providedIn: 'root' })
export class MockFixturesService {
  private readonly http = inject(HttpClient);
  private readonly configuration = inject(ConfigurationService);

  reset(namespace = 'default'): Observable<MockFixtureOperationResult> {
    return this.post('reset', { namespace });
  }

  reseed(
    seed: number,
    namespace = 'default',
  ): Observable<MockFixtureOperationResult> {
    return this.post('reseed', { namespace, seed });
  }

  captureSnapshot(
    checkpoint: string,
    namespace = 'default',
  ): Observable<MockFixtureOperationResult> {
    return this.post('snapshot', { namespace, checkpoint });
  }

  restoreSnapshot(
    checkpoint: string,
    namespace = 'default',
  ): Observable<MockFixtureOperationResult> {
    return this.post('restore', { namespace, checkpoint });
  }

  private post(
    action: string,
    body: Record<string, string | number>,
  ): Observable<MockFixtureOperationResult> {
    this.assertMockBackendEnabled();
    return this.http.post<MockFixtureOperationResult>(
      `${this.endpoint}/${action}`,
      body,
    );
  }

  private get endpoint(): string {
    return `${this.configuration.config.apiEndpoint.replace(/\/$/, '')}/mock/fixtures`;
  }

  private assertMockBackendEnabled(): void {
    if (!this.configuration.isMockBackend) {
      throw new Error(
        'Mock fixture controls are available only in an explicit mock backend profile',
      );
    }
  }
}
