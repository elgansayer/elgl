import { vi } from 'vitest';

process.env.TRANSFER_SECRET = 'test-transfer-secret';

vi.mock('jwks-rsa', () => ({
  default: vi.fn().mockImplementation(() => ({
    getSigningKey: vi.fn().mockResolvedValue({
      getPublicKey: vi.fn().mockReturnValue('mock-public-key'),
    }),
  })),
}));
