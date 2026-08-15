import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  it('persists an allow-listed, scrubbed audit event', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await service.record({
      actorUserId: 'admin-1',
      action: 'users.login_history.read',
      capabilityKey: 'users.sessions.read',
      targetType: 'user',
      targetId: 'user-1',
      outcome: 'success',
      correlationId: 'request-1',
      metadata: {
        resultCount: 2,
        source: 'admin-v1',
        authorization: 'Bearer secret',
        token: 'secret',
        nested: { password: 'secret' },
      },
    });

    expect(from).toHaveBeenCalledWith('admin_audit_events');
    expect(insert).toHaveBeenCalledWith({
      actor_user_id: 'admin-1',
      action: 'users.login_history.read',
      capability_key: 'users.sessions.read',
      target_type: 'user',
      target_id: 'user-1',
      reason_code: null,
      operator_note: null,
      outcome: 'success',
      correlation_id: 'request-1',
      metadata: { resultCount: 2, source: 'admin-v1' },
    });
  });

  it('persists a structured reason and normalized private operator note', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await service.record({
      actorUserId: 'admin-1',
      action: 'users.restriction.apply',
      reasonCode: 'fraud_or_abuse',
      operatorNote: '  Repeated automated abuse confirmed by case review.  ',
      outcome: 'success',
      correlationId: 'request-2',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reason_code: 'fraud_or_abuse',
        operator_note: 'Repeated automated abuse confirmed by case review.',
      }),
    );
  });

  it('rejects operator notes that appear to contain credentials', async () => {
    const insert = vi.fn();
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.record({
        actorUserId: 'admin-1',
        action: 'users.restriction.apply',
        reasonCode: 'incident_response',
        operatorNote: 'Authorization: Bearer very-secret-value',
        outcome: 'success',
      }),
    ).rejects.toThrow('appears to contain a secret');
    expect(insert).not.toHaveBeenCalled();
  });

  it('fails closed when audit persistence fails', async () => {
    const error = new Error('audit unavailable');
    const insert = vi.fn().mockResolvedValue({ error });
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.record({
        actorUserId: 'admin-1',
        action: 'users.login_history.read',
        outcome: 'failed',
      }),
    ).rejects.toBe(error);
  });
});
