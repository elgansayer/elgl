import { vi } from 'vitest';

vi.mock('jwks-rsa', () => ({
  default: vi.fn().mockImplementation(() => ({
    getSigningKey: vi.fn().mockResolvedValue({
      getPublicKey: vi.fn().mockReturnValue('mock-public-key'),
    }),
  })),
}));
