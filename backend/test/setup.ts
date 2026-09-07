import 'reflect-metadata';
import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.MOCK_BACKEND_MODE = 'test';
process.env.TRANSFER_SECRET = 'test-transfer-secret';
process.env.FRONTEND_URL = 'http://localhost:4200';

vi.mock('jwks-rsa', () => ({
  default: vi.fn().mockImplementation(() => ({
    getSigningKey: vi.fn().mockResolvedValue({
      getPublicKey: vi.fn().mockReturnValue('mock-public-key'),
    }),
  })),
}));
