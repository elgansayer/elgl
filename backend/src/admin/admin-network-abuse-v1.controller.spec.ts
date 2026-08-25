import { Request } from 'express';
import { AdminAuditService } from './admin-audit.service';
import { AdminNetworkAbuseV1Controller } from './admin-network-abuse-v1.controller';
import { AdminNetworkAbuseService } from './admin-network-abuse.service';
import { AdminRateLimitControlService } from './admin-rate-limit-control.service';

const actorId = 'e34db0e9-4af0-4bbd-b7fe-37a27223a544';
const controlId = 'e056c664-a1a8-4e87-aa54-75bca9ea1d14';

function request(): Request & { user: { id: string } } {
  return {
    user: { id: actorId },
    headers: { 'x-request-id': 'req-3613' },
  } as unknown as Request & { user: { id: string } };
}

describe('AdminNetworkAbuseV1Controller emergency throttles', () => {
  let rateLimits: {
    list: ReturnType<typeof vi.fn>;
    inspect: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let controller: AdminNetworkAbuseV1Controller;

  beforeEach(() => {
    rateLimits = {
      list: vi.fn().mockResolvedValue([]),
      inspect: vi.fn().mockResolvedValue({
        network: '8.8.8.0/24',
        scope: 'all',
        activeControl: null,
        currentCount: 0,
        remaining: null,
        retryAfter: null,
      }),
      create: vi.fn().mockResolvedValue({
        id: controlId,
        network: '8.8.8.0/24',
        scope: 'all',
        maxRequests: 20,
        windowSeconds: 60,
        reasonCode: 'spam',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-08-25T00:00:00.000Z',
        revokedAt: null,
      }),
      revoke: vi.fn(),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    controller = new AdminNetworkAbuseV1Controller(
      {} as AdminNetworkAbuseService,
      rateLimits as unknown as AdminRateLimitControlService,
      audit as unknown as AdminAuditService,
    );
  });

  it('audits inspection without persisting the submitted raw IP', async () => {
    const result = await controller.inspectRateLimit(
      { ip: '8.8.8.8', scope: 'all' },
      request(),
    );

    expect(result.network).toBe('8.8.8.0/24');
    expect(rateLimits.inspect).toHaveBeenCalledWith('8.8.8.8', 'all');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: actorId,
        action: 'security.network.rate_limit.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        correlationId: 'req-3613',
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('8.8.8.8');
  });

  it('records reason and target when a stricter throttle is created', async () => {
    const input = {
      cidr: '8.8.8.0/24',
      scope: 'all' as const,
      maxRequests: 20,
      windowSeconds: 60,
      reasonCode: 'spam' as const,
      operatorNote: 'Observed automated signup burst',
      expiresAt: '2099-01-01T00:00:00.000Z',
      idempotencyKey: '0df7500e-6268-420f-bb08-7dad67755a71',
    };

    await controller.createRateLimit(input, request());

    expect(rateLimits.create).toHaveBeenCalledWith(actorId, input);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: actorId,
        action: 'security.network.rate_limit.create',
        capabilityKey: 'security.network.manage',
        targetType: 'network-rate-limit',
        targetId: controlId,
        reasonCode: 'spam',
        operatorNote: 'Observed automated signup burst',
        outcome: 'success',
        correlationId: 'req-3613',
      }),
    );
  });
});
