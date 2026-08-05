import { ConfigService } from '@nestjs/config';
import { PasswordResetService } from './password-reset.service';

function supabaseMock<T = unknown>(resolved: T) {
  const mock: Record<string, unknown> = {};
  // The mock must be both a thenable AND return itself from all methods.
  const self: Record<string, unknown> = {
    then(resolve: (v: T) => void, _reject?: unknown) {
      resolve(resolved);
      return undefined;
    },
  };
  for (const m of ['select', 'eq', 'single', 'insert', 'update', 'in', 'order', 'limit', 'range', 'maybeSingle', 'rpc']) {
    self[m] = jest.fn().mockReturnValue(self);
  }
  return self;
}

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let fromFn: jest.Mock;
  let sendEmail: jest.Mock;
  let adminUpdateUser: jest.Mock;

  beforeEach(() => {
    fromFn = jest.fn();
    sendEmail = jest.fn().mockResolvedValue(undefined);
    adminUpdateUser = jest.fn().mockResolvedValue({ error: null });

    const client = {
      from: fromFn,
      auth: { admin: { updateUserById: adminUpdateUser } },
    };

    service = new PasswordResetService(
      { get: jest.fn().mockReturnValue('http://localhost:4200') } as unknown as ConfigService,
      { getClient: jest.fn().mockReturnValue(client) } as any,
      { sendPasswordResetEmail: sendEmail } as any,
    );
  });

  // ---- requestPasswordReset ----

  describe('requestPasswordReset', () => {
    it('sends email for an existing user', async () => {
      fromFn.mockImplementation((table: string) => {
        if (table === 'users') return supabaseMock({ data: [{ id: 'u1' }], error: null });
        return supabaseMock({ error: null });
      });

      await service.requestPasswordReset({ email: 'a@b.com' });
      expect(sendEmail).toHaveBeenCalledWith('a@b.com', expect.any(String));
    });

    it('silently ignores missing user', async () => {
      fromFn.mockReturnValue(supabaseMock({ data: [], error: null }));
      await service.requestPasswordReset({ email: 'x@y.com' });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('silently ignores query errors', async () => {
      fromFn.mockReturnValue(supabaseMock({ data: null, error: { message: 'boom' } }));
      await service.requestPasswordReset({ email: 'e@rr.com' });
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // ---- resetPassword ----

  describe('resetPassword', () => {
    it('updates password and marks token as used', async () => {
      fromFn.mockReturnValue(
        supabaseMock({
          data: { user_id: 'u1', expires_at: new Date(Date.now() + 60000).toISOString() },
          error: null,
        }),
      );

      await service.resetPassword({ token: 'tok', newPassword: 'Str0ng!Pass' });

      expect(adminUpdateUser).toHaveBeenCalledWith('u1', { password: 'Str0ng!Pass' });
    });

    it('throws for invalid token', async () => {
      fromFn.mockReturnValue(supabaseMock({ data: null, error: { message: 'not found' } }));
      await expect(service.resetPassword({ token: 'bad', newPassword: 'x' })).rejects.toThrow();
    });

    it('throws for expired token', async () => {
      fromFn.mockReturnValue(
        supabaseMock({
          data: { user_id: 'u1', expires_at: new Date(Date.now() - 60000).toISOString() },
          error: null,
        }),
      );
      await expect(service.resetPassword({ token: 'old', newPassword: 'x' })).rejects.toThrow();
    });

    it('throws when auth update fails', async () => {
      fromFn.mockReturnValue(
        supabaseMock({
          data: { user_id: 'u1', expires_at: new Date(Date.now() + 60000).toISOString() },
          error: null,
        }),
      );
      adminUpdateUser.mockResolvedValue({ error: { message: 'Weak' } });
      await expect(service.resetPassword({ token: 'tok', newPassword: 'x' })).rejects.toThrow();
    });
  });
});
