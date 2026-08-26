import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { PremiumAiService } from './premium-ai.service';
import { environment } from '../../environments/environment';

const baseUrl = `${environment.apiUrl}/economy/premium-ai`;
const roomId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';

describe('PremiumAiService', () => {
  let service: PremiumAiService;
  let httpMock: HttpTestingController;
  let getAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getAccessToken = vi.fn().mockReturnValue('test-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken } as unknown as AuthService,
        },
      ],
    });
    service = TestBed.inject(PremiumAiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the server-priced service catalog with authentication', async () => {
    const promise = service.getServices();
    const request = httpMock.expectOne(`${baseUrl}/services`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([
      {
        key: 'conversation_analysis_report',
        name: 'Conversation Analysis Report',
        description: 'Learner-focused feedback.',
        cost_coins: 30,
      },
    ]);

    await expect(promise).resolves.toEqual([
      expect.objectContaining({ key: 'conversation_analysis_report', cost_coins: 30 }),
    ]);
  });

  it('rejects malformed catalog responses', async () => {
    const promise = service.getServices();
    httpMock.expectOne(`${baseUrl}/services`).flush([
      {
        key: 'conversation_analysis_report',
        name: 'Conversation Analysis Report',
        description: 'Learner-focused feedback.',
        cost_coins: -1,
      },
    ]);

    await expect(promise).rejects.toThrow('Invalid premium AI service catalog response');
  });

  it('posts a caller-owned idempotency key and validates a successful report', async () => {
    const promise = service.runConversationAnalysis(roomId, requestId);
    const request = httpMock.expectOne(`${baseUrl}/conversation-analysis`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({
      room_id: roomId,
      idempotency_key: requestId,
    });
    request.flush({
      run_id: '33333333-3333-4333-8333-333333333333',
      service_key: 'conversation_analysis_report',
      cost_coins: 30,
      coins_remaining: 70,
      status: 'completed',
      report: 'Strengths\nClear communication.',
      message_count: 12,
      reused: false,
    });

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ coins_remaining: 70, message_count: 12, reused: false }),
    );
  });

  it('rejects invalid identifiers before network I/O', async () => {
    await expect(service.runConversationAnalysis('not-a-room', requestId)).rejects.toThrow(
      'Invalid conversation room id',
    );
    await expect(service.runConversationAnalysis(roomId, 'not-a-key')).rejects.toThrow(
      'Invalid premium AI idempotency key',
    );
  });

  it('fails closed without an access token', async () => {
    getAccessToken.mockReturnValue(null);
    await expect(service.getServices()).rejects.toThrow('Authentication required');
  });

  it('rejects an oversized or malformed report response', async () => {
    const promise = service.runConversationAnalysis(roomId, requestId);
    httpMock.expectOne(`${baseUrl}/conversation-analysis`).flush({
      run_id: '33333333-3333-4333-8333-333333333333',
      service_key: 'conversation_analysis_report',
      cost_coins: 30,
      coins_remaining: 70,
      status: 'completed',
      report: 'x'.repeat(8001),
      message_count: 12,
      reused: false,
    });

    await expect(promise).rejects.toThrow('Invalid conversation analysis response');
  });

  it('creates RFC 4122 version-4 idempotency identifiers', () => {
    expect(service.createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
