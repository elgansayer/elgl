import { Logger } from '@nestjs/common';
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

  it('bounds caller-controlled correlation IDs and metadata strings', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await service.record({
      actorUserId: 'admin-1',
      action: 'users.login_history.read',
      outcome: 'success',
      correlationId: `  ${'r'.repeat(200)}  `,
      metadata: {
        source: 's'.repeat(200),
        operation: 'o'.repeat(200),
      },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: 'r'.repeat(128),
        metadata: {
          source: 's'.repeat(128),
          operation: 'o'.repeat(128),
        },
      }),
    );
  });

  it('replaces unsafe correlation IDs and drops unsafe target identifiers', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await service.record({
      actorUserId: 'admin-1',
      action: 'users.read',
      targetType: 'user',
      targetId: 'Bearer secret-target',
      outcome: 'success',
      correlationId: 'Bearer secret-request-id',
    });

    const row = insert.mock.calls[0][0];
    expect(row.target_id).toBeNull();
    expect(row.correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(JSON.stringify(row)).not.toContain('secret-request-id');
    expect(JSON.stringify(row)).not.toContain('secret-target');
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

  it('applies configured retention opportunistically at most once per day', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ data: 4, error: null });
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
        rpc,
      }),
    } as unknown as SupabaseService);

    await service.record({
      actorUserId: 'admin-1',
      action: 'users.read',
      outcome: 'success',
    });
    await service.record({
      actorUserId: 'admin-1',
      action: 'users.read',
      outcome: 'success',
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('prune_admin_audit_events');
  });

  it('does not fail a completed audit write when retention cleanup fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('retention unavailable'),
    });
    const errorLog = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
        rpc,
      }),
    } as unknown as SupabaseService);

    await expect(
      service.record({
        actorUserId: 'admin-1',
        action: 'users.read',
        outcome: 'success',
      }),
    ).resolves.toBeUndefined();

    const logged = errorLog.mock.calls
      .map((call) => String(call[0]))
      .join('\n');
    expect(logged).toContain('admin_audit_retention_failed');
    expect(logged).not.toContain('retention unavailable');
  });

  it('fails closed and logs only sanitized audit persistence context', async () => {
    const error = new Error('audit unavailable with sensitive backend detail');
    const insert = vi.fn().mockResolvedValue({ error });
    const errorLog = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const service = new AdminAuditService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.record({
        actorUserId: 'admin-1',
        action: 'users.restriction.apply',
        capabilityKey: 'users.restrictions.manage',
        targetType: 'user',
        targetId: 'sensitive-user-id',
        operatorNote: 'private investigation detail',
        outcome: 'failed',
        correlationId: 'request-failure-1',
        metadata: { source: 'admin-v1' },
      }),
    ).rejects.toBe(error);

    expect(errorLog).toHaveBeenCalledOnce();
    const logged = String(errorLog.mock.calls[0]?.[0]);
    expect(logged).toContain('admin_audit_persistence_failed');
    expect(logged).toContain('users.restriction.apply');
    expect(logged).toContain('users.restrictions.manage');
    expect(logged).toContain('request-failure-1');
    expect(logged).not.toContain('sensitive-user-id');
    expect(logged).not.toContain('private investigation detail');
    expect(logged).not.toContain(
      'audit unavailable with sensitive backend detail',
    );
  });
});
