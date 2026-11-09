import { describe, expect, it, vi } from 'vitest';
import {
  initialiseDeepLinks,
  initialiseRuntimeConfiguration,
} from './app.config';

describe('Angular application initializers', () => {
  describe('initialiseRuntimeConfiguration', () => {
    it('awaits runtime configuration loading in the browser', async () => {
      let resolveConfiguration!: () => void;
      const loadConfiguration = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveConfiguration = resolve;
          }),
      );

      let settled = false;
      const initialisation = initialiseRuntimeConfiguration(
        { loadConfiguration },
        'browser',
      ).then(() => {
        settled = true;
      });

      expect(loadConfiguration).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);

      resolveConfiguration();
      await initialisation;

      expect(settled).toBe(true);
    });

    it('does not load browser runtime configuration during SSR', async () => {
      const loadConfiguration = vi.fn(async () => undefined);

      await initialiseRuntimeConfiguration({ loadConfiguration }, 'server');

      expect(loadConfiguration).not.toHaveBeenCalled();
    });

    it('preserves rejected configuration loads as bootstrap failures', async () => {
      const loadConfiguration = vi.fn(async () => {
        throw new Error('configuration unavailable');
      });

      await expect(
        initialiseRuntimeConfiguration({ loadConfiguration }, 'browser'),
      ).rejects.toThrow('configuration unavailable');
    });
  });

  describe('initialiseDeepLinks', () => {
    const createService = () => ({
      processInitialDeepLink: vi.fn(),
      registerRuntimeListener: vi.fn(),
    });

    it('processes the initial URL, registers runtime listeners and the web protocol handler', () => {
      const service = createService();
      const registerProtocolHandler = vi.fn();
      const document = {
        defaultView: {
          location: {
            href: 'https://app.example.test/moments',
            origin: 'https://app.example.test',
          },
          navigator: { registerProtocolHandler },
        },
      } as unknown as Document;

      initialiseDeepLinks(service, document);

      expect(service.processInitialDeepLink).toHaveBeenCalledOnce();
      expect(service.registerRuntimeListener).toHaveBeenCalledOnce();
      expect(registerProtocolHandler).toHaveBeenCalledWith(
        'web+hellotalk',
        'https://app.example.test/%s',
      );
    });

    it('continues when protocol-handler registration is unavailable', () => {
      const service = createService();
      const document = {
        defaultView: {
          location: {
            href: 'hellotalk://profile/user-1',
            origin: 'https://app.example.test',
          },
          navigator: {},
        },
      } as unknown as Document;

      expect(() => initialiseDeepLinks(service, document)).not.toThrow();
      expect(service.processInitialDeepLink).toHaveBeenCalledOnce();
      expect(service.registerRuntimeListener).toHaveBeenCalledOnce();
    });

    it('treats browser protocol-handler rejection as best effort', () => {
      const service = createService();
      const document = {
        defaultView: {
          location: {
            href: 'https://app.example.test/',
            origin: 'https://app.example.test',
          },
          navigator: {
            registerProtocolHandler: vi.fn(() => {
              throw new DOMException('Not allowed', 'SecurityError');
            }),
          },
        },
      } as unknown as Document;

      expect(() => initialiseDeepLinks(service, document)).not.toThrow();
      expect(service.processInitialDeepLink).toHaveBeenCalledOnce();
      expect(service.registerRuntimeListener).toHaveBeenCalledOnce();
    });

    it('does nothing when no browser view exists', () => {
      const service = createService();
      const document = { defaultView: null } as unknown as Document;

      initialiseDeepLinks(service, document);

      expect(service.processInitialDeepLink).not.toHaveBeenCalled();
      expect(service.registerRuntimeListener).not.toHaveBeenCalled();
    });
  });
});