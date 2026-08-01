import { VersionService } from './version.service';

describe('VersionService', () => {
  let fetchMock: jest.Mock;
  const originalFetch = (global as any).fetch;

  beforeAll(() => {
    process.env.npm_package_version = '1.2.3';
    process.env.GITHUB_REPO = '';
  });

  afterAll(() => {
    delete process.env.npm_package_version;
    delete process.env.GITHUB_REPO;
    if (originalFetch) {
      (global as any).fetch = originalFetch;
    } else {
      delete (global as any).fetch;
    }
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/username/repo/releases/latest',
      {
        method: 'GET',
        headers: { Accept: 'application/vnd.github.v3+json' },
      },
    );
    expect(service.getVersion()).toEqual({
      current: '1.2.3',
      latest: '2.3.4',
      updateUrl: 'https://github.com/username/repo/releases/tag/v2.3.4',
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
});
