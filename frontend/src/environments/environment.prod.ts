interface ProductionRuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  centrifugoUrl: string;
  liveKitUrl: string;
}

declare global {
  var __HELLOTALK_CONFIG__: unknown;
}

function readRequiredString(
  config: Record<string, unknown>,
  field: keyof ProductionRuntimeConfig,
): string {
  const value = config[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing production runtime configuration: ${field}`);
  }
  return value;
}

function readRequiredUrl(
  config: Record<string, unknown>,
  field: keyof ProductionRuntimeConfig,
  protocol: 'https:' | 'wss:',
): string {
  const value = readRequiredString(config, field);
  const url = URL.parse(value);
  if (!url || url.protocol !== protocol) {
    throw new Error(`Invalid production runtime URL: ${field}`);
  }
  return url.href;
}

function loadRuntimeConfig(value: unknown): ProductionRuntimeConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Production runtime configuration is unavailable');
  }

  const config: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    config[key] = entry;
  }

  return {
    supabaseUrl: readRequiredUrl(config, 'supabaseUrl', 'https:'),
    supabaseAnonKey: readRequiredString(config, 'supabaseAnonKey'),
    centrifugoUrl: readRequiredUrl(config, 'centrifugoUrl', 'wss:'),
    liveKitUrl: readRequiredUrl(config, 'liveKitUrl', 'wss:'),
  };
}

export const environment = {
  production: true,
  apiUrl: '/api',
  get supabaseUrl(): string {
    return loadRuntimeConfig(globalThis.__HELLOTALK_CONFIG__).supabaseUrl;
  },
  get supabaseAnonKey(): string {
    return loadRuntimeConfig(globalThis.__HELLOTALK_CONFIG__).supabaseAnonKey;
  },
  get centrifugoUrl(): string {
    return loadRuntimeConfig(globalThis.__HELLOTALK_CONFIG__).centrifugoUrl;
  },
  get liveKitUrl(): string {
    return loadRuntimeConfig(globalThis.__HELLOTALK_CONFIG__).liveKitUrl;
  },
};
