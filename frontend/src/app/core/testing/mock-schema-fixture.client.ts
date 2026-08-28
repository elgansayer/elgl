import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigurationService } from '../config/configuration.service';

export interface MockResponseFactoryDescriptor {
  id: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
  path: string;
  status: string;
  mediaType: string;
  operationId?: string;
}

export interface MockResponseFixtureRequest {
  method: MockResponseFactoryDescriptor['method'];
  path: string;
  status: string;
  seed?: number;
  overrides?: Record<string, unknown>;
}

export interface MockResponseFixtureResult {
  descriptor: MockResponseFactoryDescriptor;
  seed: number;
  seedId: string;
  payload: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDescriptor(value: unknown): value is MockResponseFactoryDescriptor {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['method'] === 'string' &&
    ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(value['method']) &&
    typeof value['path'] === 'string' &&
    /^2\d\d$/.test(String(value['status'])) &&
    typeof value['mediaType'] === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class MockSchemaFixtureClient {
  private readonly http = inject(HttpClient);
  private readonly configuration = inject(ConfigurationService);

  async listResponseFactories(): Promise<MockResponseFactoryDescriptor[]> {
    this.assertMockMode();
    const response = await firstValueFrom(
      this.http.get<unknown>(
        `${this.configuration.config.apiEndpoint}/mock/schema-fixtures/responses`,
      ),
    );
    if (!isRecord(response) || !Array.isArray(response['factories'])) {
      throw new Error('Invalid mock response factory index');
    }
    const factories = response['factories'];
    if (!factories.every(isDescriptor)) {
      throw new Error('Invalid mock response factory descriptor');
    }
    return factories;
  }

  async createResponseFixture(
    request: MockResponseFixtureRequest,
  ): Promise<MockResponseFixtureResult> {
    this.assertMockMode();
    if (!/^\/[A-Za-z0-9_{}./:-]{0,255}$/.test(request.path) || !/^2\d\d$/.test(request.status)) {
      throw new Error('Invalid mock response fixture request');
    }

    const response = await firstValueFrom(
      this.http.post<unknown>(
        `${this.configuration.config.apiEndpoint}/mock/schema-fixtures/responses`,
        request,
      ),
    );
    if (
      !isRecord(response) ||
      !isDescriptor(response['descriptor']) ||
      typeof response['seed'] !== 'number' ||
      !Number.isSafeInteger(response['seed']) ||
      typeof response['seedId'] !== 'string' ||
      !('payload' in response)
    ) {
      throw new Error('Invalid mock response fixture payload');
    }

    return response as unknown as MockResponseFixtureResult;
  }

  private assertMockMode(): void {
    if (!this.configuration.isMockBackend) {
      throw new Error('Mock schema fixtures are available only in explicit mock mode');
    }
  }
}
