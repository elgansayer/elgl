import {
  assertMockBackendActivationBoundary,
  isMockBackendEnabled,
  resolveMockBackendMode,
} from './mock-backend-mode';

describe('mock backend activation boundary', () => {
  it('defaults to disabled when the profile is not explicitly configured', () => {
    expect(resolveMockBackendMode({ NODE_ENV: 'development' })).toBe('disabled');
    expect(isMockBackendEnabled({ NODE_ENV: 'development' })).toBe(false);
  });

  it.each(['local', 'test', 'demo'] as const)(
    'allows the explicit %s profile in development',
    (mode) => {
      expect(
        assertMockBackendActivationBoundary({
          NODE_ENV: 'development',
          MOCK_BACKEND_MODE: mode,
        }),
      ).toBe(mode);
    },
  );

  it('allows explicit mock mode in the test runtime', () => {
    expect(
      assertMockBackendActivationBoundary({
        NODE_ENV: 'test',
        MOCK_BACKEND_MODE: 'test',
      }),
    ).toBe('test');
  });

  it.each(['production', 'provision'])(
    'refuses fixture-enabled profiles in %s',
    (nodeEnv) => {
      expect(() =>
        assertMockBackendActivationBoundary({
          NODE_ENV: nodeEnv,
          MOCK_BACKEND_MODE: 'demo',
        }),
      ).toThrow(/not allowed/);
    },
  );

  it('keeps disabled mode valid in production', () => {
    expect(
      assertMockBackendActivationBoundary({
        NODE_ENV: 'production',
        MOCK_BACKEND_MODE: 'disabled',
      }),
    ).toBe('disabled');
  });

  it('rejects unknown or non-string modes', () => {
    expect(() =>
      resolveMockBackendMode({
        NODE_ENV: 'development',
        MOCK_BACKEND_MODE: 'automatic',
      }),
    ).toThrow(/must be one of/);
    expect(() =>
      resolveMockBackendMode({
        NODE_ENV: 'development',
        MOCK_BACKEND_MODE: true,
      }),
    ).toThrow(/must be a string/);
  });

  it('normalises explicit mode casing and whitespace', () => {
    expect(
      resolveMockBackendMode({
        NODE_ENV: 'development',
        MOCK_BACKEND_MODE: '  DEMO  ',
      }),
    ).toBe('demo');
  });
});
