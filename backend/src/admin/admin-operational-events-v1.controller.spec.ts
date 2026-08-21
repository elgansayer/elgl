import { Request } from 'express';
import { AdminAuditService } from './admin-audit.service';
import { AdminOperationalEventsService } from './admin-operational-events.service';
import { AdminOperationalEventsV1Controller } from './admin-operational-events-v1.controller';

function request(userId = 'admin-1', requestId = 'req-123') {
  return {
    user: { id: userId },
    headers: { 'x-request-id': requestId },
  } as unknown as Request & { user: { id: string } };
}

describe('AdminOperationalEventsV1Controller', () => {
  it('audits successful bounded operational log reads', async () => {
    const result = { events: [], total: 0, page: 1, pageSize: 25 };
    const events = { list: vi.fn().mockResolvedValue(result) };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const controller = new AdminOperationalEventsV1Controller(
      events as unknown as AdminOperationalEventsService,
      audit as unknown as AdminAuditService,
    );
    const query = { page: 1, pageSize: 25, severity: 'warning' as const };

    await expect(controller.list(query, request() as never)).resolves.toEqual(
      result,
    );
    expect(events.list).toHaveBeenCalledWith(query);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'operational.events.read',
      capabilityKey: 'logs.read',
      targetType: 'operational-event-log',
      outcome: 'success',
      correlationId: 'req-123',
      metadata: {
        resultCount: 0,
        total: 0,
        source: 'admin-operational-events-v1',
      },
    });
  });

  it('audits failed operational log queries without leaking failure details', async () => {
    const failure = new Error('database password should not be copied');
    const events = { list: vi.fn().mockRejectedValue(failure) };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const controller = new AdminOperationalEventsV1Controller(
      events as unknown as AdminOperationalEventsService,
      audit as unknown as AdminAuditService,
    );

    await expect(
      controller.list({ page: 1, pageSize: 25 }, request() as never),
    ).rejects.toBe(failure);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'operational.events.read',
      capabilityKey: 'logs.read',
      targetType: 'operational-event-log',
      outcome: 'failed',
      correlationId: 'req-123',
      metadata: { source: 'admin-operational-events-v1' },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      'database password',
    );
  });

  it('fails closed when the privileged-read audit event cannot be persisted', async () => {
    const events = {
      list: vi
        .fn()
        .mockResolvedValue({ events: [], total: 0, page: 1, pageSize: 25 }),
    };
    const audit = {
      record: vi.fn().mockRejectedValue(new Error('audit unavailable')),
    };
    const controller = new AdminOperationalEventsV1Controller(
      events as unknown as AdminOperationalEventsService,
      audit as unknown as AdminAuditService,
    );

    await expect(
      controller.list({ page: 1, pageSize: 25 }, request() as never),
    ).rejects.toThrow('audit unavailable');
  });
});
