import type { Mock } from 'vitest';
import { VersionService } from './version.service';

describe('VersionService', () => {
  let fetchMock: Mock;
  const originalFetch = (global as any).fetch;

  beforeAll(() => {
    process.env.npm_package_version = '1.2.3';
    process.env.GITHUB_REPO = '';
    process.env.MINIMUM_SUPPORTED_APP_VERSION = '1.1.0';
  });

  afterAll(() => {
    delete process.env.npm_package_version;
    delete process.env.GITHUB_REPO;
    delete process.env.MINIMUM_SUPPORTED_APP_VERSION;
    if (originalFetch) {
      (global as any).fetch = originalFetch;
    } else {
      delete (global as any).fetch;
    }
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have currentVersion from environment', () => {
    const service = new VersionService();
    expect(service.getVersion().current).toBe('1.2.3');
  });

  it('should default currentVersion to 0.0.0 when npm_package_version missing', () => {
    const saved = process.env.npm_package_version;
    delete process.env.npm_package_version;
    const service = new VersionService();
    expect(service.getVersion().current).toBe('0.0.0');
    process.env.npm_package_version = saved;
  });

  it('should return current version when no GitHub repo configured', () => {
    process.env.GITHUB_REPO = '';
    const service = new VersionService();
    expect(service.getVersion()).toEqual({
      current: '1.2.3',
      latest: '1.2.3',
      updateUrl: undefined,
      minimumSupported: '1.1.0',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should no-op onModuleInit when no GitHub repo configured', async () => {
    process.env.GITHUB_REPO = '';
    const service = new VersionService();
    await service.onModuleInit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.getVersion().latest).toBe('1.2.3');
  });

  it('should fetch release tag when GitHub repo configured', async () => {
    process.env.GITHUB_REPO = 'username/repo';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        Promise.resolve({
          tag_name: 'v2.3.4',
          html_url: 'https://github.com/username/repo/releases/tag/v2.3.4',
        }),
    });

    const service = new VersionService();
    await service.onModuleInit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      'https://api.github.com/repos/username/repo/releases/latest',
    );
    expect(calledOptions.method).toBe('GET');
    expect(service.getVersion()).toEqual({
      current: '1.2.3',
      latest: '2.3.4',
      updateUrl: 'https://github.com/username/repo/releases/tag/v2.3.4',
      minimumSupported: '1.1.0',
    });
  });

  it('should keep current version when response is not ok', async () => {
    process.env.GITHUB_REPO = 'username/repo';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const service = new VersionService();
    await service.onModuleInit();

    expect(service.getVersion()).toEqual({
      current: '1.2.3',
      latest: '1.2.3',
      updateUrl: undefined,
      minimumSupported: '1.1.0',
    });
  });

  it('should keep current version when fetch rejects', async () => {
    process.env.GITHUB_REPO = 'username/repo';
    fetchMock.mockRejectedValue(new Error('network error'));

    const service = new VersionService();
    await service.onModuleInit();

    expect(service.getVersion()).toEqual({
      current: '1.2.3',
      latest: '1.2.3',
      updateUrl: undefined,
      minimumSupported: '1.1.0',
    });
  });

  it('should keep current version when tag_name is missing', async () => {
    process.env.GITHUB_REPO = 'username/repo';
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const service = new VersionService();
    await service.onModuleInit();

    expect(service.getVersion().latest).toBe('1.2.3');
    expect(service.getVersion().updateUrl).toBeUndefined();
  });

  it('should not set updateUrl when html_url missing', async () => {
    process.env.GITHUB_REPO = 'username/repo';
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v9.9.9' }),
    });

    const service = new VersionService();
    await service.onModuleInit();

    const version = service.getVersion();
    expect(version.latest).toBe('9.9.9');
    expect(version.updateUrl).toBeUndefined();
  });

  it('should get minimumSupportedVersion from env and return in getMinimumSupportedVersion', () => {
    const service = new VersionService();
    expect(service.getMinimumSupportedVersion()).toEqual({
      minimumSupported: '1.1.0',
    });
  });

  it('should default minimumSupportedVersion to 1.0.0 when MINIMUM_SUPPORTED_APP_VERSION missing', () => {
    const saved = process.env.MINIMUM_SUPPORTED_APP_VERSION;
    delete process.env.MINIMUM_SUPPORTED_APP_VERSION;
    const service = new VersionService();
    expect(service.getMinimumSupportedVersion()).toEqual({
      minimumSupported: '1.0.0',
    });
    process.env.MINIMUM_SUPPORTED_APP_VERSION = saved;
  });
});
