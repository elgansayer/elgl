import { initConfig } from './app.config';
import { ConfigurationService } from './core/config/configuration.service';

describe('app configuration initialisation', () => {
  it('does not perform browser-only configuration I/O during SSR', async () => {
    const service = { loadConfiguration: vi.fn().mockResolvedValue(undefined) };

    await initConfig(service as unknown as ConfigurationService, 'server' as unknown as object)();

    expect(service.loadConfiguration).not.toHaveBeenCalled();
  });

  it('loads runtime configuration in the browser', async () => {
    const service = { loadConfiguration: vi.fn().mockResolvedValue(undefined) };

    await initConfig(service as unknown as ConfigurationService, 'browser' as unknown as object)();

    expect(service.loadConfiguration).toHaveBeenCalledOnce();
  });
});
